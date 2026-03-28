import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { updatePurchaseOrderItemSchema } from '@/lib/validations'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN', 'MANAGER', 'PROCUREMENT', 'OPERATIONS'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validation = updatePurchaseOrderItemSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const data = validation.data

    // Check if item exists
    const existingItem = await prisma.purchaseOrderItem.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          include: {
            client: {
              select: {
                name: true,
              },
            },
          },
        },
        quoteLineItem: {
          select: {
            productName: true,
          },
        },
      },
    })

    if (!existingItem) {
      return NextResponse.json(
        { success: false, error: 'Purchase order item not found' },
        { status: 404 }
      )
    }

    // Validate workflow transitions
    const validTransitions: Record<string, string[]> = {
      'PENDING': ['SOURCED', 'CANCELLED'],
      'SOURCED': ['PURCHASED', 'CANCELLED'],
      'PURCHASED': ['SHIPPED', 'CANCELLED'],
      'SHIPPED': ['RECEIVED', 'MISSING'],
      'RECEIVED': [],
      'MISSING': ['SOURCED', 'CANCELLED'],
      'CANCELLED': [],
    }

    if (data.status && !validTransitions[existingItem.status].includes(data.status)) {
      return NextResponse.json(
        { success: false, error: `Cannot transition from ${existingItem.status} to ${data.status}` },
        { status: 400 }
      )
    }

    // Validate required fields for status transitions
    if (data.status === 'SOURCED') {
      if (!data.sourceUrl && !existingItem.sourceUrl) {
        return NextResponse.json(
          { success: false, error: 'Source URL is required when marking item as sourced' },
          { status: 400 }
        )
      }
      if (!data.vendorName && !existingItem.vendorName) {
        return NextResponse.json(
          { success: false, error: 'Vendor name is required when marking item as sourced' },
          { status: 400 }
        )
      }
    }

    if (data.status === 'PURCHASED') {
      if (!data.orderNumber && !existingItem.orderNumber) {
        return NextResponse.json(
          { success: false, error: 'Order number is required when marking item as purchased' },
          { status: 400 }
        )
      }
      if (!data.vendorName && !existingItem.vendorName) {
        return NextResponse.json(
          { success: false, error: 'Vendor name is required when marking item as purchased' },
          { status: 400 }
        )
      }
    }

    if (data.status === 'RECEIVED') {
      if (data.receivedQuantity === undefined && existingItem.receivedQuantity === 0) {
        return NextResponse.json(
          { success: false, error: 'Received quantity is required when marking item as received' },
          { status: 400 }
        )
      }
    }

    // Update item with automatic field population
    const updateData: Record<string, unknown> = {
      ...data,
    }

    // Set user and timestamp based on status
    if (data.status === 'SOURCED') {
      updateData.sourcedById = session.user.id
      updateData.sourcedAt = new Date()
    }

    if (data.status === 'PURCHASED') {
      updateData.purchasedById = session.user.id
      updateData.purchasedAt = new Date()
    }

    if (data.status === 'RECEIVED') {
      updateData.receivedAt = new Date()
    }

    // Convert dates if provided as strings
    if (data.expectedDeliveryDate) {
      updateData.expectedDeliveryDate = new Date(data.expectedDeliveryDate)
    }

    const purchaseOrderItem = await prisma.purchaseOrderItem.update({
      where: { id },
      data: updateData,
      include: {
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            client: {
              select: {
                name: true,
              },
            },
          },
        },
        quoteLineItem: {
          select: {
            productName: true,
          },
        },
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
    })

    // Create alerts for overdue items
    if (data.status === 'MISSING' || (data.expectedDeliveryDate && new Date(data.expectedDeliveryDate) < new Date())) {
      // Find procurement users to alert
      const procurementUsers = await prisma.user.findMany({
        where: {
          role: 'PROCUREMENT',
          isActive: true,
        },
      })

      // Create alerts
      await Promise.all(
        procurementUsers.map(user =>
          prisma.alert.create({
            data: {
              userId: user.id,
              type: data.status === 'MISSING' ? 'MISSING_ITEM' : 'OVERDUE',
              title: data.status === 'MISSING' ? 'Item Marked Missing' : 'Item Overdue',
              message: `${existingItem.quoteLineItem?.productName || 'Item'} for PO ${existingItem.purchaseOrder.poNumber} needs attention`,
              relatedEntityType: 'purchaseOrderItem',
              relatedEntityId: id,
              severity: data.status === 'MISSING' ? 'CRITICAL' : 'WARNING',
            },
          })
        )
      )
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'purchaseOrderItem',
        entityId: purchaseOrderItem.id,
        action: 'updated',
        details: JSON.stringify({
          poNumber: purchaseOrderItem.purchaseOrder.poNumber,
          productName: purchaseOrderItem.quoteLineItem?.productName,
          changes: Object.keys(data),
          newStatus: data.status,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: purchaseOrderItem,
      message: 'Purchase order item updated successfully',
    })
  } catch (error) {
    console.error('Purchase Order Item PATCH error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
