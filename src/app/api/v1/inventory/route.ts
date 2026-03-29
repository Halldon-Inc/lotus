import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { createInventoryItemSchema } from '@/lib/validations'

// Cap pageSize to prevent unbounded queries
const MAX_PAGE_SIZE = 100

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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get('pageSize') || '20'))
    )
    const sortBy = searchParams.get('sortBy') || 'name'
    const sortDirection = (searchParams.get('sortDirection') || 'asc') as 'asc' | 'desc'
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const lowStock = searchParams.get('lowStock') === 'true'

    const skip = (page - 1) * pageSize

    // Whitelist sortBy to prevent SQL injection in the raw query path
    const allowedSortColumns: Record<string, string> = {
      name: '"name"',
      sku: '"sku"',
      category: '"category"',
      quantityOnHand: '"quantityOnHand"',
      reorderPoint: '"reorderPoint"',
      unitCost: '"unitCost"',
      createdAt: '"createdAt"',
      updatedAt: '"updatedAt"',
    }

    if (lowStock) {
      // Use raw query for proper column-to-column comparison in PostgreSQL
      const conditions: Prisma.Sql[] = [
        Prisma.sql`"reorderPoint" > 0`,
        Prisma.sql`"quantityOnHand" <= "reorderPoint"`,
      ]

      if (search) {
        conditions.push(
          Prisma.sql`("name" ILIKE ${'%' + search + '%'} OR "sku" ILIKE ${'%' + search + '%'})`
        )
      }

      if (category) {
        conditions.push(Prisma.sql`"category" = ${category}`)
      }

      const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      const sortCol = allowedSortColumns[sortBy] || '"name"'
      const sortDir = sortDirection === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`

      const [items, countResult] = await Promise.all([
        prisma.$queryRaw<Array<Record<string, unknown>>>`
          SELECT i.*,
                 (SELECT COUNT(*)::int FROM inventory_movements m WHERE m."inventoryItemId" = i.id) AS "movementCount"
          FROM inventory_items i
          ${whereClause}
          ORDER BY ${Prisma.raw(sortCol)} ${sortDir}
          LIMIT ${pageSize} OFFSET ${skip}
        `,
        prisma.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(*)::int AS "count"
          FROM inventory_items
          ${whereClause}
        `,
      ])

      const total = countResult[0]?.count || 0

      // Reshape to match the Prisma findMany output format
      const shapedItems = items.map((item) => ({
        ...item,
        _count: { movements: item.movementCount || 0 },
        movementCount: undefined,
      }))

      return NextResponse.json({
        success: true,
        data: {
          items: shapedItems,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      })
    }

    // Standard (non low-stock) path using Prisma findMany
    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (category) {
      where.category = category
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

    return NextResponse.json({
      success: true,
      data: {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
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
