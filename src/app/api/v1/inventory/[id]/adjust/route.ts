import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { adjustInventorySchema } from '@/lib/validations'

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
    const validation = adjustInventorySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { type, quantity, notes } = validation.data

    // Calculate new quantity based on movement type
    let newQuantityOnHand = item.quantityOnHand
    let lastRestockedAt: Date | null = item.lastRestockedAt

    switch (type) {
      case 'RECEIVED':
      case 'RETURNED':
        newQuantityOnHand += quantity
        if (type === 'RECEIVED') {
          lastRestockedAt = new Date()
        }
        break
      case 'SHIPPED':
        if (quantity > item.quantityOnHand) {
          return NextResponse.json(
            { success: false, error: `Insufficient stock. Only ${item.quantityOnHand} available.` },
            { status: 400 }
          )
        }
        newQuantityOnHand -= quantity
        break
      case 'ADJUSTMENT':
        // For adjustments, the quantity IS the new quantity
        newQuantityOnHand = quantity
        break
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create movement record
      const movement = await tx.inventoryMovement.create({
        data: {
          inventoryItemId: id,
          type,
          quantity: type === 'ADJUSTMENT' ? quantity - item.quantityOnHand : quantity,
          referenceType: 'MANUAL',
          notes: notes || null,
          performedById: session.user.id,
        },
        include: {
          performedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      // Update item quantity
      const updated = await tx.inventoryItem.update({
        where: { id },
        data: {
          quantityOnHand: newQuantityOnHand,
          lastRestockedAt,
        },
      })

      return { movement, item: updated }
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'inventory_item',
        entityId: id,
        action: 'stock_adjusted',
        details: JSON.stringify({
          type,
          quantity,
          previousOnHand: item.quantityOnHand,
          newOnHand: newQuantityOnHand,
          notes,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: result,
      message: `Stock ${type.toLowerCase()} successfully`,
    })
  } catch (error) {
    console.error('Inventory adjust POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
