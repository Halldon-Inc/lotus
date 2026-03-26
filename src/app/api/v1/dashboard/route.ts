import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const [
      totalClients,
      totalRequests,
      totalQuotes,
      totalPurchaseOrders,
      openRequests,
      pendingQuotes,
      overdueItems,
      totalRevenue,
      recentActivity
    ] = await Promise.all([
      prisma.client.count(),
      prisma.request.count(),
      prisma.quote.count(),
      prisma.purchaseOrder.count(),
      prisma.request.count({ 
        where: { status: { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS'] } } 
      }),
      prisma.quote.count({ 
        where: { status: { in: ['DRAFT', 'SENT'] } } 
      }),
      prisma.purchaseOrderItem.count({ 
        where: { status: 'MISSING' } 
      }),
      prisma.quote.aggregate({
        where: { status: 'ACCEPTED' },
        _sum: { totalAmount: true },
      }),
      prisma.activityLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              name: true,
              role: true,
            },
          },
        },
      })
    ])

    const stats = {
      totalClients,
      totalRequests,
      totalQuotes,
      totalPurchaseOrders,
      openRequests,
      pendingQuotes,
      overdueItems,
      totalRevenue: totalRevenue._sum.totalAmount || 0,
      recentActivity,
    }

    return NextResponse.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
