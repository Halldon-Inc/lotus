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
    const status = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortDirection = (searchParams.get('sortDirection') || 'desc') as 'asc' | 'desc'

    const skip = (page - 1) * pageSize

    const where: Record<string, unknown> = {}
    if (status) {
      where.status = status
    }
    if (search) {
      where.OR = [
        { rmaNumber: { contains: search } },
        { reason: { contains: search } },
      ]
    }

    const [rmas, total] = await Promise.all([
      prisma.rMA.findMany({
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
        },
      }),
      prisma.rMA.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        items: rmas,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('RMAs GET error:', error)
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

    const { purchaseOrderId, rmaNumber, reason, purchaseOrderItemId } = body

    if (!purchaseOrderId || !rmaNumber || !reason) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: purchaseOrderId, rmaNumber, reason' },
        { status: 400 }
      )
    }

    const rma = await prisma.rMA.create({
      data: {
        purchaseOrderId,
        rmaNumber,
        reason,
        purchaseOrderItemId: purchaseOrderItemId || null,
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
        entityType: 'rma',
        entityId: rma.id,
        action: 'created',
        details: JSON.stringify({
          rmaNumber: rma.rmaNumber,
          reason: rma.reason,
          poNumber: rma.purchaseOrder.poNumber,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: rma,
      message: 'RMA created successfully',
    })
  } catch (error) {
    console.error('RMAs POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
