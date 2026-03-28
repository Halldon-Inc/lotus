import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

type Period = '7d' | '30d' | '90d' | '1y' | 'all'
type GroupBy = 'vendor' | 'client' | 'type' | 'month'

function getDateFilter(period: Period): Date | null {
  if (period === 'all') return null
  const now = new Date()
  const daysMap: Record<Exclude<Period, 'all'>, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '1y': 365,
  }
  const days = daysMap[period]
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
}

interface VendorSpend {
  vendorName: string
  totalSpend: number
  orderCount: number
  itemCount: number
}

interface ClientSpend {
  clientId: string
  clientName: string
  clientType: string
  totalSpend: number
  orderCount: number
  spendingLimit: number | null
  budgetUsed: number | null
}

interface MonthlySpend {
  month: string
  totalSpend: number
  orderCount: number
}

interface TypeSpend {
  type: string
  totalSpend: number
  clientCount: number
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

    if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const period = (searchParams.get('period') || '30d') as Period
    const groupBy = (searchParams.get('groupBy') || 'vendor') as GroupBy

    const validPeriods: Period[] = ['7d', '30d', '90d', '1y', 'all']
    const validGroups: GroupBy[] = ['vendor', 'client', 'type', 'month']

    if (!validPeriods.includes(period)) {
      return NextResponse.json(
        { success: false, error: 'Invalid period. Use: 7d, 30d, 90d, 1y, all' },
        { status: 400 }
      )
    }

    if (!validGroups.includes(groupBy)) {
      return NextResponse.json(
        { success: false, error: 'Invalid groupBy. Use: vendor, client, type, month' },
        { status: 400 }
      )
    }

    const sinceDate = getDateFilter(period)

    const dateFilter = sinceDate
      ? { createdAt: { gte: sinceDate } }
      : {}

    // Core aggregations in parallel
    const [
      allPOs,
      allPOItems,
      allClients,
      totalPOCount,
      fulfilledPOCount,
    ] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where: dateFilter,
        include: {
          client: {
            select: {
              id: true,
              name: true,
              type: true,
              spendingLimit: true,
            },
          },
          items: {
            select: {
              id: true,
              vendorName: true,
              quantity: true,
              status: true,
              purchasedAt: true,
              receivedAt: true,
              expectedDeliveryDate: true,
            },
          },
        },
      }),
      prisma.purchaseOrderItem.findMany({
        where: {
          purchaseOrder: dateFilter,
        },
        select: {
          vendorName: true,
          status: true,
          quantity: true,
          purchaseOrder: {
            select: {
              totalAmount: true,
              createdAt: true,
            },
          },
          quoteLineItem: {
            select: {
              vendorName: true,
              unitPrice: true,
              totalPrice: true,
            },
          },
        },
      }),
      prisma.client.findMany({
        select: {
          id: true,
          name: true,
          type: true,
          spendingLimit: true,
        },
      }),
      prisma.purchaseOrder.count({ where: dateFilter }),
      prisma.purchaseOrder.count({
        where: {
          ...dateFilter,
          status: { in: ['FULFILLED', 'DELIVERED'] },
        },
      }),
    ])

    // Calculate total spend
    const totalSpend = allPOs.reduce((sum, po) => sum + po.totalAmount, 0)
    const totalItems = allPOItems.length
    const averageOrderValue = totalPOCount > 0 ? totalSpend / totalPOCount : 0
    const fulfillmentRate = totalPOCount > 0
      ? Math.round((fulfilledPOCount / totalPOCount) * 100)
      : 0

    // Spend by vendor (from PO items, falling back to quote line items)
    const vendorMap = new Map<string, VendorSpend>()
    for (const po of allPOs) {
      for (const item of po.items) {
        const vendor = item.vendorName || 'Unknown Vendor'
        const existing = vendorMap.get(vendor) || {
          vendorName: vendor,
          totalSpend: 0,
          orderCount: 0,
          itemCount: 0,
        }
        existing.itemCount += 1
        vendorMap.set(vendor, existing)
      }
    }

    // Attribute PO spend proportionally across vendors in each PO
    for (const po of allPOs) {
      const vendorsInPO = new Map<string, number>()
      for (const item of po.items) {
        const vendor = item.vendorName || 'Unknown Vendor'
        vendorsInPO.set(vendor, (vendorsInPO.get(vendor) || 0) + 1)
      }
      const totalItemsInPO = po.items.length || 1
      for (const [vendor, count] of Array.from(vendorsInPO.entries())) {
        const existing = vendorMap.get(vendor)
        if (existing) {
          existing.totalSpend += (po.totalAmount * count) / totalItemsInPO
          existing.orderCount += 1
        }
      }
    }

    const vendorSpend = Array.from(vendorMap.values())
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 10)

    // Unique active vendors
    const uniqueVendors = new Set<string>()
    for (const item of allPOItems) {
      const vendor = item.vendorName || item.quoteLineItem?.vendorName
      if (vendor) uniqueVendors.add(vendor)
    }

    // Spend by client
    const clientMap = new Map<string, ClientSpend>()
    for (const po of allPOs) {
      const existing = clientMap.get(po.client.id) || {
        clientId: po.client.id,
        clientName: po.client.name,
        clientType: po.client.type,
        totalSpend: 0,
        orderCount: 0,
        spendingLimit: po.client.spendingLimit,
        budgetUsed: null,
      }
      existing.totalSpend += po.totalAmount
      existing.orderCount += 1
      if (existing.spendingLimit && existing.spendingLimit > 0) {
        existing.budgetUsed = Math.round(
          (existing.totalSpend / existing.spendingLimit) * 100
        )
      }
      clientMap.set(po.client.id, existing)
    }

    const clientSpend = Array.from(clientMap.values())
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 10)

    // Spend by client type
    const typeMap = new Map<string, TypeSpend>()
    for (const po of allPOs) {
      const clientType = po.client.type
      const existing = typeMap.get(clientType) || {
        type: clientType,
        totalSpend: 0,
        clientCount: 0,
      }
      existing.totalSpend += po.totalAmount
      typeMap.set(clientType, existing)
    }
    // Count unique clients per type
    const clientsByType = new Map<string, Set<string>>()
    for (const po of allPOs) {
      const typeClients = clientsByType.get(po.client.type) || new Set()
      typeClients.add(po.client.id)
      clientsByType.set(po.client.type, typeClients)
    }
    for (const [type, clients] of Array.from(clientsByType.entries())) {
      const existing = typeMap.get(type)
      if (existing) existing.clientCount = clients.size
    }
    const typeSpend = Array.from(typeMap.values())
      .sort((a, b) => b.totalSpend - a.totalSpend)

    // Spend over time (monthly)
    const monthMap = new Map<string, MonthlySpend>()
    for (const po of allPOs) {
      const date = new Date(po.createdAt)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const existing = monthMap.get(monthKey) || {
        month: monthKey,
        totalSpend: 0,
        orderCount: 0,
      }
      existing.totalSpend += po.totalAmount
      existing.orderCount += 1
      monthMap.set(monthKey, existing)
    }
    const monthlySpend = Array.from(monthMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))

    // Budget utilization per client (all clients with spending limits)
    const budgetUtilization = allClients
      .filter((c) => c.spendingLimit && c.spendingLimit > 0)
      .map((client) => {
        const spent = clientMap.get(client.id)?.totalSpend || 0
        const limit = client.spendingLimit as number
        return {
          clientId: client.id,
          clientName: client.name,
          clientType: client.type,
          spent,
          limit,
          utilization: Math.round((spent / limit) * 100),
          remaining: limit - spent,
        }
      })
      .sort((a, b) => b.utilization - a.utilization)

    const analytics = {
      summary: {
        totalSpend,
        averageOrderValue,
        activeVendors: uniqueVendors.size,
        fulfillmentRate,
        totalPOs: totalPOCount,
        totalItems,
      },
      vendorSpend,
      clientSpend,
      typeSpend,
      monthlySpend,
      budgetUtilization,
      period,
      groupBy,
    }

    return NextResponse.json({
      success: true,
      data: analytics,
    })
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
