import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

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
    const purchaseOrderId = searchParams.get('purchaseOrderId') || ''
    const status = searchParams.get('status') || ''
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortDirection = (searchParams.get('sortDirection') || 'desc') as 'asc' | 'desc'

    const skip = (page - 1) * pageSize

    const where: Record<string, unknown> = {}
    if (purchaseOrderId) {
      where.purchaseOrderId = purchaseOrderId
    }
    if (status) {
      where.status = status
    }

    const [changeOrders, total] = await Promise.all([
      prisma.changeOrder.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortBy]: sortDirection },
        include: {
          purchaseOrder: {
            select: {
              id: true,
              poNumber: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.changeOrder.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        items: changeOrders,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('ChangeOrders GET error:', error)
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
        { status: 403 }
      )
    }

    const body = await request.json()

    const { purchaseOrderId, reason, fieldChanged, oldValue, newValue } = body

    if (!purchaseOrderId || !reason || !fieldChanged || oldValue === undefined || newValue === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: purchaseOrderId, reason, fieldChanged, oldValue, newValue' },
        { status: 400 }
      )
    }

    // Auto-increment changeNumber per PO
    const lastChangeOrder = await prisma.changeOrder.findFirst({
      where: { purchaseOrderId },
      orderBy: { changeNumber: 'desc' },
      select: { changeNumber: true },
    })

    const changeNumber = (lastChangeOrder?.changeNumber || 0) + 1

    const changeOrder = await prisma.changeOrder.create({
      data: {
        purchaseOrderId,
        changeNumber,
        reason,
        fieldChanged,
        oldValue: String(oldValue),
        newValue: String(newValue),
      },
      include: {
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
          },
        },
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'change_order',
        entityId: changeOrder.id,
        action: 'created',
        details: JSON.stringify({
          poNumber: changeOrder.purchaseOrder.poNumber,
          changeNumber: changeOrder.changeNumber,
          fieldChanged: changeOrder.fieldChanged,
          reason: changeOrder.reason,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: changeOrder,
      message: 'Change order created successfully',
    })
  } catch (error) {
    console.error('ChangeOrders POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
