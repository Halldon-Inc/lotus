import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface SupplierMetrics {
  vendorName: string
  totalOrders: number
  totalSpend: number
  onTimeRate: number
  accuracyRate: number
  avgFulfillmentDays: number
  issueCount: number
  reliabilityScore: number
  receivedCount: number
  clientCount: number
}

function calculateReliabilityScore(
  onTimeRate: number,
  accuracyRate: number,
  issueRate: number,
  speedScore: number
): number {
  // Weighted: 40% on-time, 30% accuracy, 20% issue-free, 10% speed
  const score =
    onTimeRate * 0.4 +
    accuracyRate * 0.3 +
    (1 - issueRate) * 0.2 * 100 +
    speedScore * 0.1
  return Math.round(Math.max(0, Math.min(100, score)))
}

function computeSpeedScore(avgDays: number): number {
  // 0 days = 100, 30+ days = 0, linear scale
  if (avgDays <= 0) return 100
  if (avgDays >= 30) return 0
  return Math.round(((30 - avgDays) / 30) * 100)
}

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
    const sortBy = searchParams.get('sortBy') || 'reliability'
    const sortDirection = (searchParams.get('sortDirection') || 'desc') as 'asc' | 'desc'
    const search = searchParams.get('search') || ''
    const minOrders = parseInt(searchParams.get('minOrders') || '0')
    const minReliability = parseFloat(searchParams.get('minReliability') || '0')
    const maxReliability = parseFloat(searchParams.get('maxReliability') || '100')

    // Fetch all PO items that have a vendor name
    const poItems = await prisma.purchaseOrderItem.findMany({
      where: {
        vendorName: { not: null },
      },
      include: {
        purchaseOrder: {
          select: {
            id: true,
            clientId: true,
            createdAt: true,
          },
        },
        quoteLineItem: {
          select: {
            unitPrice: true,
            quantity: true,
            totalPrice: true,
          },
        },
      },
    })

    // Group by vendor name
    const vendorMap = new Map<string, typeof poItems>()
    for (const item of poItems) {
      const name = item.vendorName as string
      if (!vendorMap.has(name)) {
        vendorMap.set(name, [])
      }
      vendorMap.get(name)!.push(item)
    }

    // Calculate metrics for each vendor
    const suppliers: SupplierMetrics[] = []

    for (const [vendorName, items] of Array.from(vendorMap.entries())) {
      const totalOrders = items.length

      // Total spend from quote line items
      const totalSpend = items.reduce((sum, item) => {
        if (item.quoteLineItem) {
          return sum + item.quoteLineItem.totalPrice
        }
        return sum
      }, 0)

      // Received items for rate calculations
      const receivedItems = items.filter((item) => item.receivedAt !== null)
      const receivedCount = receivedItems.length

      // On-time delivery rate
      let onTimeCount = 0
      if (receivedCount > 0) {
        onTimeCount = receivedItems.filter((item) => {
          if (!item.expectedDeliveryDate || !item.receivedAt) return false
          return new Date(item.receivedAt) <= new Date(item.expectedDeliveryDate)
        }).length
      }
      const onTimeRate = receivedCount > 0 ? (onTimeCount / receivedCount) * 100 : 0

      // Quantity accuracy rate
      let accurateCount = 0
      if (receivedCount > 0) {
        accurateCount = receivedItems.filter(
          (item) => item.receivedQuantity === item.quantity
        ).length
      }
      const accuracyRate = receivedCount > 0 ? (accurateCount / receivedCount) * 100 : 0

      // Average fulfillment time (days from PO creation to receivedAt)
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

      // Issue count (MISSING or CANCELLED)
      const issueCount = items.filter(
        (item) => item.status === 'MISSING' || item.status === 'CANCELLED'
      ).length

      // Issue rate for reliability calculation
      const issueRate = totalOrders > 0 ? issueCount / totalOrders : 0

      // Speed score
      const speedScore = computeSpeedScore(avgFulfillmentDays)

      // Overall reliability score
      const reliabilityScore = calculateReliabilityScore(
        onTimeRate,
        accuracyRate,
        issueRate,
        speedScore
      )

      // Unique clients served
      const clientIds = new Set(items.map((item) => item.purchaseOrder.clientId))

      suppliers.push({
        vendorName,
        totalOrders,
        totalSpend,
        onTimeRate: Math.round(onTimeRate),
        accuracyRate: Math.round(accuracyRate),
        avgFulfillmentDays,
        issueCount,
        reliabilityScore,
        receivedCount,
        clientCount: clientIds.size,
      })
    }

    // Apply filters
    let filtered = suppliers.filter((s) => {
      if (minOrders > 0 && s.totalOrders < minOrders) return false
      if (s.reliabilityScore < minReliability) return false
      if (s.reliabilityScore > maxReliability) return false
      if (search && !s.vendorName.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })

    // Sort
    const sortKey = ((): keyof SupplierMetrics => {
      switch (sortBy) {
        case 'name':
          return 'vendorName'
        case 'spend':
          return 'totalSpend'
        case 'reliability':
          return 'reliabilityScore'
        case 'orders':
          return 'totalOrders'
        default:
          return 'reliabilityScore'
      }
    })()

    filtered.sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }
      const aNum = aVal as number
      const bNum = bVal as number
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
    })

    // Summary stats
    const totalVendors = filtered.length
    const avgReliability =
      totalVendors > 0
        ? Math.round(
            filtered.reduce((sum, s) => sum + s.reliabilityScore, 0) / totalVendors
          )
        : 0
    const topPerformer =
      filtered.length > 0
        ? [...filtered].sort((a, b) => b.reliabilityScore - a.reliabilityScore)[0]
            .vendorName
        : null
    const vendorsWithIssues = filtered.filter((s) => s.issueCount > 0).length

    return NextResponse.json({
      success: true,
      data: {
        suppliers: filtered,
        summary: {
          totalVendors,
          avgReliability,
          topPerformer,
          vendorsWithIssues,
        },
      },
    })
  } catch (error) {
    console.error('Suppliers GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
