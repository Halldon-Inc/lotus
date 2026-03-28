import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN', 'MANAGER', 'PROCUREMENT', 'OPERATIONS'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const priority = searchParams.get('priority')
    const assignedTo = searchParams.get('assignedTo')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')

    const skip = (page - 1) * pageSize

    // Build where clause
    const where: Prisma.PurchaseOrderItemWhereInput = {}

    if (status !== 'all') {
      where.status = status
    }

    // Filter by overdue items if requested
    if (status === 'overdue') {
      where.AND = [
        { expectedDeliveryDate: { lt: new Date() } },
        { status: { notIn: ['RECEIVED', 'CANCELLED'] } }
      ]
    }

    // Items assigned to specific user
    if (assignedTo === 'me') {
      where.OR = [
        { sourcedById: session.user.id },
        { purchasedById: session.user.id },
      ]
    } else if (assignedTo && assignedTo !== 'all') {
      where.OR = [
        { sourcedById: assignedTo },
        { purchasedById: assignedTo },
      ]
    }

    const [items, total] = await Promise.all([
      prisma.purchaseOrderItem.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [
          { status: 'asc' },
          { expectedDeliveryDate: 'asc' },
          { createdAt: 'desc' },
        ],
        include: {
          purchaseOrder: {
            include: {
              client: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                },
              },
              quote: {
                select: {
                  quoteNumber: true,
                  request: {
                    select: {
                      subject: true,
                      priority: true,
                    },
                  },
                },
              },
            },
          },
          quoteLineItem: {
            select: {
              productName: true,
              description: true,
              specifications: true,
              unitPrice: true,
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
      }),
      prisma.purchaseOrderItem.count({ where }),
    ])

    // Get summary stats
    const stats = await prisma.purchaseOrderItem.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
    })

    const statusCounts = stats.reduce((acc, stat) => {
      acc[stat.status] = stat._count.id
      return acc
    }, {} as Record<string, number>)

    // Get overdue count
    const overdueCount = await prisma.purchaseOrderItem.count({
      where: {
        expectedDeliveryDate: { lt: new Date() },
        status: { notIn: ['RECEIVED', 'CANCELLED'] },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        stats: {
          ...statusCounts,
          overdue: overdueCount,
        },
      },
    })
  } catch (error) {
    console.error('Procurement GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
