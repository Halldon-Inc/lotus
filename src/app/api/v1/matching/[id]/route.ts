import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { updateMatchSchema } from '@/lib/validations'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const matchRecord = await prisma.matchRecord.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
                type: true,
                contactName: true,
                contactEmail: true,
              },
            },
            items: {
              include: {
                quoteLineItem: {
                  select: {
                    productName: true,
                    description: true,
                    quantity: true,
                    unitPrice: true,
                    totalPrice: true,
                  },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        invoice: {
          include: {
            lineItems: {
              orderBy: { id: 'asc' },
            },
          },
        },
      },
    })

    if (!matchRecord) {
      return NextResponse.json(
        { success: false, error: 'Match record not found' },
        { status: 404 }
      )
    }

    // Parse JSON details for easier frontend consumption
    const parsedDetails = matchRecord.details
      ? JSON.parse(matchRecord.details)
      : null

    return NextResponse.json({
      success: true,
      data: {
        ...matchRecord,
        parsedDetails,
      },
    })
  } catch (error) {
    console.error('Match GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validation = updateMatchSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const existingMatch = await prisma.matchRecord.findUnique({
      where: { id },
      include: {
        invoice: true,
      },
    })

    if (!existingMatch) {
      return NextResponse.json(
        { success: false, error: 'Match record not found' },
        { status: 404 }
      )
    }

    const data = validation.data

    // Parse existing details to append override info
    const existingDetails = existingMatch.details
      ? JSON.parse(existingMatch.details)
      : {}

    const updatedDetails = {
      ...existingDetails,
      manualOverride: {
        previousStatus: existingMatch.status,
        newStatus: data.status,
        reason: data.notes,
        overriddenBy: session.user.id,
        overriddenAt: new Date().toISOString(),
      },
    }

    const matchRecord = await prisma.matchRecord.update({
      where: { id },
      data: {
        status: data.status,
        notes: data.notes,
        matchedAt: data.status === 'MANUAL_OVERRIDE' ? new Date() : existingMatch.matchedAt,
        details: JSON.stringify(updatedDetails),
      },
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
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            vendorName: true,
            totalAmount: true,
          },
        },
      },
    })

    // Update invoice status to reflect the override
    if (data.status === 'MANUAL_OVERRIDE' || data.status === 'AUTO_MATCHED') {
      await prisma.invoice.update({
        where: { id: existingMatch.invoiceId },
        data: { status: 'MATCHED' },
      })
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'matchRecord',
        entityId: matchRecord.id,
        action: 'manual_override',
        details: JSON.stringify({
          previousStatus: existingMatch.status,
          newStatus: data.status,
          reason: data.notes,
          poNumber: matchRecord.purchaseOrder.poNumber,
          invoiceNumber: matchRecord.invoice.invoiceNumber,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: matchRecord,
      message: 'Match record updated successfully',
    })
  } catch (error) {
    console.error('Match PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
