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
    const view = searchParams.get('view') || 'stats'

    // Recent activity feed
    if (view === 'recent') {
      const recentLogs = await prisma.activityLog.findMany({
        where: {
          OR: [
            { entityType: 'receiving', action: 'batch_received' },
            { entityType: 'purchaseOrderItem', action: 'received' },
          ],
        },
        take: 30,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })

      // Group by batch_received entries, and also include standalone item receives
      const activityFeed = recentLogs
        .filter((log) => log.entityType === 'receiving' && log.action === 'batch_received')
        .map((log) => {
          const details = log.details ? JSON.parse(log.details) : {}
          return {
            id: log.id,
            type: 'batch_receive' as const,
            userId: log.userId,
            userName: log.user.name || log.user.email,
            timestamp: log.createdAt,
            purchaseOrderIds: details.affectedPurchaseOrders || [],
            itemCount: details.itemCount || 0,
            shipmentReference: details.shipmentReference || null,
            photoUrls: details.photoUrls || [],
            items: details.items || [],
          }
        })

      return NextResponse.json({
        success: true,
        data: activityFeed,
      })
    }

    // Default: stats overview
    const [
      totalPurchaseOrders,
      pendingReceiving,
      partiallyFulfilled,
      fulfilledOrders,
      totalItems,
      pendingItems,
      shippedItems,
      receivedItems,
      missingItems,
    ] = await Promise.all([
      prisma.purchaseOrder.count(),
      prisma.purchaseOrder.count({
        where: { status: { in: ['RECEIVED', 'VERIFIED', 'IN_PURCHASING'] } },
      }),
      prisma.purchaseOrder.count({
        where: { status: 'PARTIALLY_FULFILLED' },
      }),
      prisma.purchaseOrder.count({
        where: { status: { in: ['FULFILLED', 'DELIVERED'] } },
      }),
      prisma.purchaseOrderItem.count(),
      prisma.purchaseOrderItem.count({
        where: { status: 'PENDING' },
      }),
      prisma.purchaseOrderItem.count({
        where: { status: 'SHIPPED' },
      }),
      prisma.purchaseOrderItem.count({
        where: { status: 'RECEIVED' },
      }),
      prisma.purchaseOrderItem.count({
        where: { status: 'MISSING' },
      }),
    ])

    // Overdue items (expected delivery in the past, not received/cancelled)
    const overdueItems = await prisma.purchaseOrderItem.count({
      where: {
        expectedDeliveryDate: { lt: new Date() },
        status: { notIn: ['RECEIVED', 'CANCELLED'] },
      },
    })

    // Expected deliveries in the next 7 days
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)
    const upcomingDeliveries = await prisma.purchaseOrderItem.count({
      where: {
        expectedDeliveryDate: { gte: new Date(), lte: nextWeek },
        status: { notIn: ['RECEIVED', 'CANCELLED'] },
      },
    })

    // Recently received items with PO context
    const recentlyReceived = await prisma.purchaseOrderItem.findMany({
      where: { status: 'RECEIVED' },
      take: 10,
      orderBy: { receivedAt: 'desc' },
      include: {
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            client: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        quoteLineItem: {
          select: {
            productName: true,
          },
        },
      },
    })

    // Items with quantity discrepancies
    const discrepancyItems = await prisma.purchaseOrderItem.findMany({
      where: {
        status: 'RECEIVED',
        NOT: { receivedQuantity: 0 },
      },
      take: 20,
      orderBy: { updatedAt: 'desc' },
      include: {
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
          },
        },
        quoteLineItem: {
          select: {
            productName: true,
          },
        },
      },
    })

    const itemsWithDiscrepancies = discrepancyItems.filter(
      (item) => item.receivedQuantity !== item.quantity && item.receivedQuantity > 0
    )

    const stats = {
      totalPurchaseOrders,
      pendingReceiving,
      partiallyFulfilled,
      fulfilledOrders,
      items: {
        total: totalItems,
        pending: pendingItems,
        shipped: shippedItems,
        received: receivedItems,
        missing: missingItems,
      },
      overdueItems,
      upcomingDeliveries,
      recentlyReceived,
      discrepancies: itemsWithDiscrepancies,
    }

    return NextResponse.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    console.error('Receiving dashboard error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
