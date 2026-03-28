import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { updateInventoryItemSchema } from '@/lib/validations'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params

    const item = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        movements: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            performedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: { movements: true },
        },
      },
    })

    if (!item) {
      return NextResponse.json(
        { success: false, error: 'Inventory item not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: item,
    })
  } catch (error) {
    console.error('Inventory [id] GET error:', error)
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
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER', 'PROCUREMENT', 'OPERATIONS'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const { id } = await params

    const existing = await prisma.inventoryItem.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Inventory item not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validation = updateInventoryItemSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const data = validation.data

    // Check for duplicate SKU if changing it
    if (data.sku && data.sku !== existing.sku) {
      const duplicate = await prisma.inventoryItem.findUnique({
        where: { sku: data.sku },
      })
      if (duplicate) {
        return NextResponse.json(
          { success: false, error: 'An item with this SKU already exists' },
          { status: 409 }
        )
      }
    }

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.sku !== undefined && { sku: data.sku || null }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.category !== undefined && { category: data.category || null }),
        ...(data.quantityOnHand !== undefined && { quantityOnHand: data.quantityOnHand }),
        ...(data.reorderPoint !== undefined && { reorderPoint: data.reorderPoint }),
        ...(data.location !== undefined && { location: data.location || null }),
        ...(data.unitCost !== undefined && { unitCost: data.unitCost ?? null }),
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'inventory_item',
        entityId: id,
        action: 'updated',
        details: JSON.stringify(data),
      },
    })

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Inventory item updated successfully',
    })
  } catch (error) {
    console.error('Inventory [id] PUT error:', error)
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
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const { id } = await params

    const existing = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        _count: { select: { movements: true } },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Inventory item not found' },
        { status: 404 }
      )
    }

    if (existing._count.movements > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete item with existing movements. Remove all movement history first.' },
        { status: 409 }
      )
    }

    await prisma.inventoryItem.delete({ where: { id } })

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'inventory_item',
        entityId: id,
        action: 'deleted',
        details: JSON.stringify({ name: existing.name, sku: existing.sku }),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Inventory item deleted successfully',
    })
  } catch (error) {
    console.error('Inventory [id] DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
