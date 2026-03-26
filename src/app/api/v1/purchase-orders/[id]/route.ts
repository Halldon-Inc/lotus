import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { updatePurchaseOrderSchema } from '@/lib/validations'

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

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            type: true,
            contactName: true,
            contactEmail: true,
            contactPhone: true,
          },
        },
        quote: {
          include: {
            request: {
              select: {
                id: true,
                subject: true,
                description: true,
                priority: true,
              },
            },
            lineItems: true,
          },
        },
        verifiedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            quoteLineItem: true,
            sourcedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            purchasedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!purchaseOrder) {
      return NextResponse.json(
        { success: false, error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: purchaseOrder,
    })
  } catch (error) {
    console.error('Purchase Order GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN', 'MANAGER', 'OPERATIONS'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validation = updatePurchaseOrderSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const data = validation.data

    // Check if purchase order exists
    const existingPO = await prisma.purchaseOrder.findUnique({
      where: { id },
    })

    if (!existingPO) {
      return NextResponse.json(
        { success: false, error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    const purchaseOrder = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: data.status,
        discrepancyNotes: data.discrepancyNotes,
        verifiedById: data.verifiedById || (data.status === 'VERIFIED' ? session.user.id : existingPO.verifiedById),
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        verifiedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        quote: {
          select: {
            id: true,
            quoteNumber: true,
          },
        },
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'purchaseOrder',
        entityId: purchaseOrder.id,
        action: 'updated',
        details: JSON.stringify({
          poNumber: purchaseOrder.poNumber,
          changes: Object.keys(data),
          newStatus: data.status,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: purchaseOrder,
      message: 'Purchase order updated successfully',
    })
  } catch (error) {
    console.error('Purchase Order PATCH error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Check if purchase order exists and can be deleted
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: true,
      },
    })

    if (!purchaseOrder) {
      return NextResponse.json(
        { success: false, error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    // Check if any items have been purchased
    const hasProgress = purchaseOrder.items.some(
      item => ['PURCHASED', 'SHIPPED', 'RECEIVED'].includes(item.status)
    )

    if (hasProgress) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete purchase order with items in progress' },
        { status: 400 }
      )
    }

    // Delete purchase order (items will be cascade deleted)
    await prisma.purchaseOrder.delete({
      where: { id },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'purchaseOrder',
        entityId: id,
        action: 'deleted',
        details: JSON.stringify({
          poNumber: purchaseOrder.poNumber,
          totalAmount: purchaseOrder.totalAmount,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Purchase order deleted successfully',
    })
  } catch (error) {
    console.error('Purchase Order DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
