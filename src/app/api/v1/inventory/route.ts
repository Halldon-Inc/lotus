import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createInventoryItemSchema } from '@/lib/validations'

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
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const sortBy = searchParams.get('sortBy') || 'name'
    const sortDirection = (searchParams.get('sortDirection') || 'asc') as 'asc' | 'desc'
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const lowStock = searchParams.get('lowStock') === 'true'

    const skip = (page - 1) * pageSize

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
      ]
    }

    if (category) {
      where.category = category
    }

    if (lowStock) {
      // Items where quantityOnHand <= reorderPoint and reorderPoint > 0
      where.AND = [
        { reorderPoint: { gt: 0 } },
        {
          // SQLite doesn't support column-to-column comparison in Prisma where,
          // so we fetch all with reorderPoint > 0 and filter in application
        },
      ]
    }

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortBy]: sortDirection },
        include: {
          _count: {
            select: { movements: true },
          },
        },
      }),
      prisma.inventoryItem.count({ where }),
    ])

    // If lowStock filter is on, filter in application layer
    const filteredItems = lowStock
      ? items.filter((item) => item.quantityOnHand <= item.reorderPoint)
      : items

    const finalTotal = lowStock ? filteredItems.length : total

    return NextResponse.json({
      success: true,
      data: {
        items: filteredItems,
        total: finalTotal,
        page,
        pageSize,
        totalPages: Math.ceil(finalTotal / pageSize),
      },
    })
  } catch (error) {
    console.error('Inventory GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER', 'PROCUREMENT', 'OPERATIONS'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validation = createInventoryItemSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const data = validation.data

    // Check for duplicate SKU if provided
    if (data.sku) {
      const existing = await prisma.inventoryItem.findUnique({
        where: { sku: data.sku },
      })
      if (existing) {
        return NextResponse.json(
          { success: false, error: 'An item with this SKU already exists' },
          { status: 409 }
        )
      }
    }

    const item = await prisma.inventoryItem.create({
      data: {
        name: data.name,
        sku: data.sku || null,
        description: data.description || null,
        category: data.category || null,
        quantityOnHand: data.quantityOnHand ?? 0,
        reorderPoint: data.reorderPoint ?? 0,
        location: data.location || null,
        unitCost: data.unitCost ?? null,
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'inventory_item',
        entityId: item.id,
        action: 'created',
        details: JSON.stringify({
          name: data.name,
          sku: data.sku,
          quantityOnHand: data.quantityOnHand,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: item,
      message: 'Inventory item created successfully',
    })
  } catch (error) {
    console.error('Inventory POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
