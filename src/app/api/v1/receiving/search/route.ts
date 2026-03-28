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
    const q = searchParams.get('q')

    // When query is empty or short (< 2 chars), return upcoming deliveries as suggestions
    if (!q || q.trim().length < 2) {
      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 7)

      const upcomingItems = await prisma.purchaseOrderItem.findMany({
        where: {
          expectedDeliveryDate: { gte: new Date(), lte: nextWeek },
          status: { notIn: ['RECEIVED', 'CANCELLED'] },
        },
        include: {
          purchaseOrder: {
            include: {
              client: {
                select: { id: true, name: true },
              },
            },
          },
          quoteLineItem: {
            select: { productName: true },
          },
        },
        orderBy: { expectedDeliveryDate: 'asc' },
        take: 20,
      })

      // Also fetch overdue items
      const overdueItems = await prisma.purchaseOrderItem.findMany({
        where: {
          expectedDeliveryDate: { lt: new Date() },
          status: { notIn: ['RECEIVED', 'CANCELLED'] },
        },
        include: {
          purchaseOrder: {
            include: {
              client: {
                select: { id: true, name: true },
              },
            },
          },
          quoteLineItem: {
            select: { productName: true },
          },
        },
        orderBy: { expectedDeliveryDate: 'asc' },
        take: 10,
      })

      const suggestions = [
        ...overdueItems.map((item) => ({
          id: item.id,
          type: 'overdue' as const,
          poNumber: item.purchaseOrder.poNumber,
          purchaseOrderId: item.purchaseOrder.id,
          clientName: item.purchaseOrder.client.name,
          productName: item.quoteLineItem?.productName || 'Unknown product',
          expectedDeliveryDate: item.expectedDeliveryDate,
          vendorName: item.vendorName,
          trackingNumber: item.trackingNumber,
          status: item.status,
        })),
        ...upcomingItems.map((item) => ({
          id: item.id,
          type: 'upcoming' as const,
          poNumber: item.purchaseOrder.poNumber,
          purchaseOrderId: item.purchaseOrder.id,
          clientName: item.purchaseOrder.client.name,
          productName: item.quoteLineItem?.productName || 'Unknown product',
          expectedDeliveryDate: item.expectedDeliveryDate,
          vendorName: item.vendorName,
          trackingNumber: item.trackingNumber,
          status: item.status,
        })),
      ]

      return NextResponse.json({
        success: true,
        data: [],
        suggestions,
      })
    }

    const searchTerm = q.trim()

    // Search across PO numbers, item tracking/order numbers, vendor names, and client names
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        OR: [
          { poNumber: { contains: searchTerm } },
          { client: { name: { contains: searchTerm } } },
          {
            items: {
              some: {
                OR: [
                  { trackingNumber: { contains: searchTerm } },
                  { orderNumber: { contains: searchTerm } },
                  { vendorName: { contains: searchTerm } },
                ],
              },
            },
          },
        ],
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            type: true,
            contactName: true,
            contactEmail: true,
          },
        },
        items: {
          include: {
            quoteLineItem: {
              select: {
                id: true,
                productName: true,
                description: true,
                quantity: true,
              },
            },
            sourcedBy: {
              select: {
                id: true,
                name: true,
              },
            },
            purchasedBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        quote: {
          select: {
            id: true,
            quoteNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    // Compute match context: why each PO matched and item-level progress
    const results = purchaseOrders.map((po) => {
      const matchReasons: string[] = []

      if (po.poNumber.toLowerCase().includes(searchTerm.toLowerCase())) {
        matchReasons.push('PO number')
      }
      if (po.client.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        matchReasons.push('Client name')
      }

      const matchingItems = po.items.filter((item) => {
        const tracking = item.trackingNumber?.toLowerCase() || ''
        const order = item.orderNumber?.toLowerCase() || ''
        const vendor = item.vendorName?.toLowerCase() || ''
        const term = searchTerm.toLowerCase()
        return tracking.includes(term) || order.includes(term) || vendor.includes(term)
      })

      if (matchingItems.length > 0) {
        const reasons = new Set<string>()
        for (const item of matchingItems) {
          if (item.trackingNumber?.toLowerCase().includes(searchTerm.toLowerCase())) reasons.add('Tracking number')
          if (item.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase())) reasons.add('Order number')
          if (item.vendorName?.toLowerCase().includes(searchTerm.toLowerCase())) reasons.add('Vendor name')
        }
        matchReasons.push(...Array.from(reasons))
      }

      const totalItems = po.items.length
      const receivedItems = po.items.filter((i) => i.status === 'RECEIVED').length
      const pendingItems = po.items.filter((i) => i.status === 'PENDING').length
      const shippedItems = po.items.filter((i) => i.status === 'SHIPPED').length
      const missingItems = po.items.filter((i) => i.status === 'MISSING').length

      // Compute unique vendors/sources for this PO
      const vendors = Array.from(
        new Set(po.items.map((i) => i.vendorName).filter(Boolean))
      ) as string[]

      // Check for overdue items (expected delivery date in the past)
      const now = new Date()
      const overdueItems = po.items.filter(
        (i) =>
          i.expectedDeliveryDate &&
          new Date(i.expectedDeliveryDate) < now &&
          i.status !== 'RECEIVED' &&
          i.status !== 'CANCELLED'
      )

      return {
        ...po,
        matchReasons,
        progress: {
          total: totalItems,
          received: receivedItems,
          pending: pendingItems,
          shipped: shippedItems,
          missing: missingItems,
          percentComplete: totalItems > 0 ? Math.round((receivedItems / totalItems) * 100) : 0,
        },
        vendors,
        overdueCount: overdueItems.length,
        highlightedItems: matchingItems.map((i) => i.id),
      }
    })

    return NextResponse.json({
      success: true,
      data: results,
    })
  } catch (error) {
    console.error('Receiving search error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
