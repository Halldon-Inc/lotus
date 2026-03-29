import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { allocateInventorySchema } from '@/lib/validations'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER', 'PROCUREMENT', 'OPERATIONS'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const { id } = await params

    const item = await prisma.inventoryItem.findUnique({ where: { id } })
    if (!item) {
      return NextResponse.json(
        { success: false, error: 'Inventory item not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validation = allocateInventorySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { purchaseOrderId, quantity } = validation.data

    // Verify PO exists
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: { id: true, poNumber: true },
    })

    if (!po) {
      return NextResponse.json(
        { success: false, error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      // Re-fetch item inside transaction to prevent race condition
      const currentItem = await tx.inventoryItem.findUnique({ where: { id } })
      if (!currentItem) throw new Error('Not found')

      // Check available quantity (on hand minus already reserved)
      const available = currentItem.quantityOnHand - currentItem.quantityReserved
      if (quantity > available) {
        throw new Error(
          `Insufficient available stock. Only ${available} available (${currentItem.quantityOnHand} on hand, ${currentItem.quantityReserved} reserved).`
        )
      }

      // Create ALLOCATED movement
      const movement = await tx.inventoryMovement.create({
        data: {
          inventoryItemId: id,
          type: 'ALLOCATED',
          quantity,
          referenceType: 'PURCHASE_ORDER',
          referenceId: purchaseOrderId,
          notes: `Allocated to PO ${po.poNumber}`,
          performedById: session.user.id,
        },
        include: {
          performedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      // Increment reserved quantity
      const updated = await tx.inventoryItem.update({
        where: { id },
        data: {
          quantityReserved: { increment: quantity },
        },
      })

      return { movement, item: updated, previousReserved: currentItem.quantityReserved }
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'inventory_item',
        entityId: id,
        action: 'stock_allocated',
        details: JSON.stringify({
          purchaseOrderId,
          poNumber: po.poNumber,
          quantity,
          previousReserved: result.previousReserved,
          newReserved: result.previousReserved + quantity,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: result,
      message: `${quantity} units allocated to PO ${po.poNumber}`,
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Not found') {
        return NextResponse.json(
          { success: false, error: 'Inventory item not found' },
          { status: 404 }
        )
      }
      if (error.message.startsWith('Insufficient available stock')) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 400 }
        )
      }
    }
    console.error('Inventory allocate POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
