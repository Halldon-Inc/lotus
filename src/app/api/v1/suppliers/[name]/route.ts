import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

function computeSpeedScore(avgDays: number): number {
  if (avgDays <= 0) return 100
  if (avgDays >= 30) return 0
  return Math.round(((30 - avgDays) / 30) * 100)
}

function calculateReliabilityScore(
  onTimeRate: number,
  accuracyRate: number,
  issueRate: number,
  speedScore: number
): number {
  const score =
    onTimeRate * 0.4 +
    accuracyRate * 0.3 +
    (1 - issueRate) * 0.2 * 100 +
    speedScore * 0.1
  return Math.round(Math.max(0, Math.min(100, score)))
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const vendorName = decodeURIComponent(name)

    // Fetch all PO items for this vendor
    const poItems = await prisma.purchaseOrderItem.findMany({
      where: {
        vendorName: vendorName,
      },
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
          },
        },
        quoteLineItem: {
          select: {
            productName: true,
            description: true,
            unitPrice: true,
            quantity: true,
            totalPrice: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (poItems.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Supplier not found' },
        { status: 404 }
      )
    }

    const totalOrders = poItems.length

    // Total spend
    const totalSpend = poItems.reduce((sum, item) => {
      if (item.quoteLineItem) {
        return sum + item.quoteLineItem.totalPrice
      }
      return sum
    }, 0)

    // Received items
    const receivedItems = poItems.filter((item) => item.receivedAt !== null)
    const receivedCount = receivedItems.length

    // On-time delivery
    let onTimeCount = 0
    if (receivedCount > 0) {
      onTimeCount = receivedItems.filter((item) => {
        if (!item.expectedDeliveryDate || !item.receivedAt) return false
        return new Date(item.receivedAt) <= new Date(item.expectedDeliveryDate)
      }).length
    }
    const onTimeRate = receivedCount > 0 ? Math.round((onTimeCount / receivedCount) * 100) : 0

    // Quantity accuracy
    let accurateCount = 0
    if (receivedCount > 0) {
      accurateCount = receivedItems.filter(
        (item) => item.receivedQuantity === item.quantity
      ).length
    }
    const accuracyRate = receivedCount > 0 ? Math.round((accurateCount / receivedCount) * 100) : 0

    // Average fulfillment time
    let totalFulfillmentDays = 0
    let fulfillmentCount = 0
    for (const item of receivedItems) {
      if (item.receivedAt && item.purchaseOrder) {
        const days =
          (new Date(item.receivedAt).getTime() -
            new Date(item.purchaseOrder.createdAt).getTime()) /
          (1000 * 60 * 60 * 24)
        totalFulfillmentDays += days
        fulfillmentCount++
      }
    }
    const avgFulfillmentDays =
      fulfillmentCount > 0 ? Math.round(totalFulfillmentDays / fulfillmentCount) : 0

    // Issues
    const issueCount = poItems.filter(
      (item) => item.status === 'MISSING' || item.status === 'CANCELLED'
    ).length
    const issueRate = totalOrders > 0 ? issueCount / totalOrders : 0

    // Speed score and overall reliability
    const speedScore = computeSpeedScore(avgFulfillmentDays)
    const reliabilityScore = calculateReliabilityScore(
      onTimeRate,
      accuracyRate,
      issueRate,
      speedScore
    )

    // Recent orders (last 20)
    const recentOrders = poItems.slice(0, 20).map((item) => ({
      id: item.id,
      status: item.status,
      quantity: item.quantity,
      receivedQuantity: item.receivedQuantity,
      orderNumber: item.orderNumber,
      trackingNumber: item.trackingNumber,
      expectedDeliveryDate: item.expectedDeliveryDate,
      receivedAt: item.receivedAt,
      createdAt: item.createdAt,
      productName: item.quoteLineItem?.productName || 'Unknown Product',
      purchaseOrder: {
        id: item.purchaseOrder.id,
        poNumber: (item.purchaseOrder as Record<string, unknown>).poNumber,
      },
      client: item.purchaseOrder.client,
    }))

    // Performance over time (monthly reliability)
    const monthlyData = new Map<
      string,
      { onTime: number; total: number; accurate: number; issues: number }
    >()

    for (const item of poItems) {
      const date = item.receivedAt || item.createdAt
      const monthKey = `${new Date(date).getFullYear()}-${String(
        new Date(date).getMonth() + 1
      ).padStart(2, '0')}`

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { onTime: 0, total: 0, accurate: 0, issues: 0 })
      }

      const data = monthlyData.get(monthKey)!
      data.total++

      if (item.receivedAt) {
        if (
          item.expectedDeliveryDate &&
          new Date(item.receivedAt) <= new Date(item.expectedDeliveryDate)
        ) {
          data.onTime++
        }
        if (item.receivedQuantity === item.quantity) {
          data.accurate++
        }
      }

      if (item.status === 'MISSING' || item.status === 'CANCELLED') {
        data.issues++
      }
    }

    const performanceOverTime = Array.from(monthlyData.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        totalItems: data.total,
        onTimeRate: data.total > 0 ? Math.round((data.onTime / data.total) * 100) : 0,
        accuracyRate:
          data.total > 0 ? Math.round((data.accurate / data.total) * 100) : 0,
        issues: data.issues,
      }))

    // Clients served
    const clientMap = new Map<string, { id: string; name: string; type: string; orderCount: number }>()
    for (const item of poItems) {
      const client = item.purchaseOrder.client
      if (!clientMap.has(client.id)) {
        clientMap.set(client.id, { ...client, orderCount: 0 })
      }
      clientMap.get(client.id)!.orderCount++
    }
    const clientsServed = Array.from(clientMap.values()).sort(
      (a, b) => b.orderCount - a.orderCount
    )

    // Common products
    const productMap = new Map<string, { name: string; count: number; totalSpend: number }>()
    for (const item of poItems) {
      const productName = item.quoteLineItem?.productName || 'Unknown Product'
      if (!productMap.has(productName)) {
        productMap.set(productName, { name: productName, count: 0, totalSpend: 0 })
      }
      const product = productMap.get(productName)!
      product.count++
      if (item.quoteLineItem) {
        product.totalSpend += item.quoteLineItem.totalPrice
      }
    }
    const commonProducts = Array.from(productMap.values()).sort(
      (a, b) => b.count - a.count
    )

    return NextResponse.json({
      success: true,
      data: {
        vendorName,
        metrics: {
          totalOrders,
          totalSpend,
          onTimeRate,
          accuracyRate,
          avgFulfillmentDays,
          issueCount,
          reliabilityScore,
          receivedCount,
          speedScore,
        },
        recentOrders,
        performanceOverTime,
        clientsServed,
        commonProducts,
      },
    })
  } catch (error) {
    console.error('Supplier detail GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
