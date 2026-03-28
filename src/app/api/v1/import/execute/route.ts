import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  applyMapping,
  validateRow,
  transformRow,
  getFieldsForEntity,
  type TransformedRow,
} from '@/lib/import-mapper'

const BATCH_SIZE = 50

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: ADMIN or MANAGER role required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { sessionId, entityType, columnMapping, skipInvalid } = body as {
      sessionId: string
      entityType: string
      columnMapping: Record<string, string>
      skipInvalid: boolean
    }

    if (!sessionId || !entityType || !columnMapping) {
      return NextResponse.json(
        { success: false, error: 'sessionId, entityType, and columnMapping are required' },
        { status: 400 }
      )
    }

    try {
      getFieldsForEntity(entityType)
    } catch {
      return NextResponse.json(
        { success: false, error: `Invalid entity type: ${entityType}` },
        { status: 400 }
      )
    }

    const importSession = await prisma.importSession.findUnique({
      where: { id: sessionId },
    })

    if (!importSession) {
      return NextResponse.json(
        { success: false, error: 'Import session not found' },
        { status: 404 }
      )
    }

    if (importSession.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'You do not own this import session' },
        { status: 403 }
      )
    }

    if (importSession.status === 'COMPLETED') {
      return NextResponse.json(
        { success: false, error: 'This import has already been executed' },
        { status: 400 }
      )
    }

    const rows = JSON.parse(importSession.data) as Record<string, string>[]

    const validEntries: Array<{ rowIndex: number; transformed: TransformedRow }> = []
    const skippedErrors: Array<{
      rowIndex: number
      errors: Array<{ field: string; message: string }>
    }> = []

    for (let i = 0; i < rows.length; i++) {
      const mapped = applyMapping(rows[i], columnMapping)
      const errors = validateRow(entityType, mapped)

      if (errors.length > 0) {
        if (skipInvalid) {
          skippedErrors.push({ rowIndex: i + 1, errors })
          continue
        }
        // If not skipping, fail the entire import
        await prisma.importSession.update({
          where: { id: sessionId },
          data: {
            status: 'FAILED',
            results: JSON.stringify({
              error: `Validation failed on row ${i + 1}`,
              errors,
            }),
          },
        })
        return NextResponse.json(
          {
            success: false,
            error: `Validation failed on row ${i + 1}. Enable skipInvalid to skip invalid rows.`,
            data: { rowIndex: i + 1, errors },
          },
          { status: 400 }
        )
      }

      validEntries.push({ rowIndex: i + 1, transformed: transformRow(entityType, mapped) })
    }

    let imported = 0
    const importErrors: Array<{ rowIndex: number; error: string }> = []

    // Process in batches
    for (let batch = 0; batch < validEntries.length; batch += BATCH_SIZE) {
      const chunk = validEntries.slice(batch, batch + BATCH_SIZE)

      await prisma.$transaction(async (tx) => {
        for (const entry of chunk) {
          try {
            await createRecord(tx, entityType, entry.transformed, session.user.id)
            imported++
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error'
            importErrors.push({ rowIndex: entry.rowIndex, error: message })
          }
        }
      })
    }

    const finalStatus = importErrors.length === 0 ? 'COMPLETED' : 'PARTIAL'
    await prisma.importSession.update({
      where: { id: sessionId },
      data: {
        entityType,
        status: finalStatus,
        results: JSON.stringify({
          imported,
          skipped: skippedErrors.length,
          errors: importErrors,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        imported,
        skipped: skippedErrors.length,
        errors: importErrors,
      },
    })
  } catch (error) {
    console.error('Import execute error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

type PrismaTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

async function createRecord(
  tx: PrismaTransaction,
  entityType: string,
  data: TransformedRow,
  userId: string
): Promise<void> {
  switch (entityType) {
    case 'clients': {
      const clientData = data as {
        name: string
        type: string
        contactName?: string
        contactEmail?: string
        contactPhone?: string
        address?: string
        city?: string
        state?: string
        zip?: string
        spendingLimit?: number
        fiscalYearStart?: Date
      }
      await tx.client.create({ data: clientData })
      break
    }
    case 'inventory': {
      const invData = data as {
        name: string
        sku?: string
        description?: string
        category?: string
        quantityOnHand: number
        reorderPoint: number
        location?: string
        unitCost?: number
      }
      await tx.inventoryItem.create({ data: invData })
      break
    }
    case 'requests': {
      const reqData = data as {
        clientName: string
        subject: string
        description: string
        priority: string
        source: string
      }
      // Look up client by name, or create one
      let client = await tx.client.findFirst({
        where: { name: { equals: reqData.clientName } },
      })
      if (!client) {
        client = await tx.client.create({
          data: { name: reqData.clientName, type: 'CORPORATE' },
        })
      }
      await tx.request.create({
        data: {
          clientId: client.id,
          createdById: userId,
          subject: reqData.subject,
          description: reqData.description,
          priority: reqData.priority,
          source: reqData.source,
        },
      })
      break
    }
    case 'purchase-orders': {
      const poData = data as {
        clientName: string
        poNumber: string
        totalAmount: number
        deliveryMethod?: string
        notes?: string
      }
      // Look up client by name, or create one
      let client = await tx.client.findFirst({
        where: { name: { equals: poData.clientName } },
      })
      if (!client) {
        client = await tx.client.create({
          data: { name: poData.clientName, type: 'CORPORATE' },
        })
      }
      await tx.purchaseOrder.create({
        data: {
          clientId: client.id,
          poNumber: poData.poNumber,
          totalAmount: poData.totalAmount,
          deliveryMethod: poData.deliveryMethod,
          notes: poData.notes,
        },
      })
      break
    }
    default:
      throw new Error(`Unknown entity type: ${entityType}`)
  }
}
