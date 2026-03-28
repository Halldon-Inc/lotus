import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createDiscrepancySchema } from '@/lib/validations'
import { sendEmail } from '@/lib/email'
import { discrepancyAlert } from '@/lib/email-templates'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortDirection = (searchParams.get('sortDirection') || 'desc') as 'asc' | 'desc'
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const purchaseOrderId = searchParams.get('purchaseOrderId')

    const skip = (page - 1) * pageSize

    const where: Record<string, unknown> = {}

    if (type) {
      where.type = type
    }

    if (status) {
      where.status = status
    }

    if (purchaseOrderId) {
      where.purchaseOrderId = purchaseOrderId
    }

    const [discrepancies, total] = await Promise.all([
      prisma.discrepancy.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortBy]: sortDirection },
        include: {
          purchaseOrder: {
            select: {
              id: true,
              poNumber: true,
              totalAmount: true,
              client: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          purchaseOrderItem: {
            select: {
              id: true,
              quantity: true,
              receivedQuantity: true,
              status: true,
              quoteLineItem: {
                select: {
                  productName: true,
                },
              },
            },
          },
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              vendorName: true,
            },
          },
          reportedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          resolvedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.discrepancy.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        items: discrepancies,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Discrepancies GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validation = createDiscrepancySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const data = validation.data

    // Verify PO exists
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: data.purchaseOrderId },
      include: {
        client: { select: { name: true } },
      },
    })

    if (!purchaseOrder) {
      return NextResponse.json(
        { success: false, error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    // Verify PO item exists if specified
    if (data.purchaseOrderItemId) {
      const item = await prisma.purchaseOrderItem.findUnique({
        where: { id: data.purchaseOrderItemId },
      })
      if (!item || item.purchaseOrderId !== data.purchaseOrderId) {
        return NextResponse.json(
          { success: false, error: 'Purchase order item not found or does not belong to this PO' },
          { status: 404 }
        )
      }
    }

    // Verify invoice exists if specified
    if (data.invoiceId) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: data.invoiceId },
      })
      if (!invoice) {
        return NextResponse.json(
          { success: false, error: 'Invoice not found' },
          { status: 404 }
        )
      }
    }

    const discrepancy = await prisma.discrepancy.create({
      data: {
        purchaseOrderId: data.purchaseOrderId,
        purchaseOrderItemId: data.purchaseOrderItemId || null,
        invoiceId: data.invoiceId || null,
        type: data.type,
        expectedValue: data.expectedValue,
        actualValue: data.actualValue,
        reportedById: session.user.id,
        photoUrls: data.photoUrls ? JSON.stringify(data.photoUrls) : null,
      },
      include: {
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            client: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        reportedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Auto-create alert for managers and admins
    const managers = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'MANAGER'] },
        isActive: true,
      },
      select: { id: true, email: true },
    })

    await Promise.all(
      managers.map((manager) =>
        prisma.alert.create({
          data: {
            userId: manager.id,
            type: 'ATTENTION_REQUIRED',
            title: `New discrepancy: ${data.type.replace(/_/g, ' ').toLowerCase()}`,
            message: `A ${data.type.replace(/_/g, ' ').toLowerCase()} was reported for PO ${purchaseOrder.poNumber} (${purchaseOrder.client.name}). Expected: ${data.expectedValue}, Actual: ${data.actualValue}`,
            relatedEntityType: 'discrepancy',
            relatedEntityId: discrepancy.id,
            severity: 'WARNING',
          },
        })
      )
    )

    // Email all ADMIN users about the discrepancy
    try {
      const adminUsers = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { email: true },
      })
      const template = discrepancyAlert(purchaseOrder.poNumber, data.type)
      await Promise.all(
        adminUsers
          .filter((u) => u.email)
          .map((u) => sendEmail(u.email, template.subject, template.html))
      )
    } catch (emailError) {
      console.error('Failed to send discrepancy alert emails:', emailError)
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'discrepancy',
        entityId: discrepancy.id,
        action: 'created',
        details: JSON.stringify({
          type: data.type,
          poNumber: purchaseOrder.poNumber,
          expectedValue: data.expectedValue,
          actualValue: data.actualValue,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: discrepancy,
      message: 'Discrepancy reported successfully',
    })
  } catch (error) {
    console.error('Discrepancies POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
