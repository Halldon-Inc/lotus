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
        { rfqNumber: { contains: search } },
        { title: { contains: search } },
      ]
    }

    const [rfqs, total] = await Promise.all([
      prisma.rFQ.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortBy]: sortDirection },
        include: {
          client: {
            select: {
              id: true,
              name: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              responses: true,
            },
          },
        },
      }),
      prisma.rFQ.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        items: rfqs,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('RFQs GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER', 'SALES'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()

    const { rfqNumber, clientId, title, description, dueDate } = body

    if (!rfqNumber || !clientId || !title || !dueDate) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: rfqNumber, clientId, title, dueDate' },
        { status: 400 }
      )
    }

    const rfq = await prisma.rFQ.create({
      data: {
        rfqNumber,
        clientId,
        title,
        description: description || null,
        dueDate: new Date(dueDate),
        createdById: session.user.id,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'rfq',
        entityId: rfq.id,
        action: 'created',
        details: JSON.stringify({
          rfqNumber: rfq.rfqNumber,
          title: rfq.title,
          clientId: rfq.clientId,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: rfq,
      message: 'RFQ created successfully',
    })
  } catch (error) {
    console.error('RFQs POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
