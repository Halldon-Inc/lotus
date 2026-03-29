import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

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

    const poDateFilter = sinceDate
      ? { purchaseOrder: { createdAt: { gte: sinceDate } } }
      : {}

    // Use Prisma aggregations instead of loading all records into memory
    const [
      poAggregate,
      totalPOCount,
      fulfilledPOCount,
      totalItemCount,
      activeVendorCount,
      clientGrouped,
      typeGrouped,
      monthlyGrouped,
      budgetClients,
    ] = await Promise.all([
      // Summary: total spend and average order value
      prisma.purchaseOrder.aggregate({
        where: dateFilter,
        _sum: { totalAmount: true },
        _avg: { totalAmount: true },
      }),
      prisma.purchaseOrder.count({ where: dateFilter }),
      prisma.purchaseOrder.count({
        where: {
          ...dateFilter,
          status: { in: ['FULFILLED', 'DELIVERED'] },
        },
      }),
      prisma.purchaseOrderItem.count({
        where: poDateFilter,
      }),
      // Unique active vendor count
      prisma.purchaseOrderItem.groupBy({
        by: ['vendorName'],
        where: {
          ...poDateFilter,
          vendorName: { not: null },
        },
      }).then((results) => results.length),
      // Client breakdown: group POs by clientId with spend totals
      prisma.purchaseOrder.groupBy({
        by: ['clientId'],
        where: dateFilter,
        _sum: { totalAmount: true },
        _count: { id: true },
        orderBy: { _sum: { totalAmount: 'desc' } },
        take: 10,
      }),
      // Type breakdown via raw query (needs client join)
      prisma.$queryRaw<Array<{ type: string; totalSpend: number; clientCount: number }>>`
        SELECT c."type",
               COALESCE(SUM(po."totalAmount"), 0)::float AS "totalSpend",
               COUNT(DISTINCT po."clientId")::int AS "clientCount"
        FROM purchase_orders po
        JOIN clients c ON c.id = po."clientId"
        ${sinceDate ? Prisma.sql`WHERE po."createdAt" >= ${sinceDate}` : Prisma.empty}
        GROUP BY c."type"
        ORDER BY "totalSpend" DESC
      `,
      // Monthly breakdown via raw query for date_trunc
      prisma.$queryRaw<Array<{ month: string; totalSpend: number; orderCount: number }>>`
        SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS "month",
               COALESCE(SUM("totalAmount"), 0)::float AS "totalSpend",
               COUNT(*)::int AS "orderCount"
        FROM purchase_orders
        ${sinceDate ? Prisma.sql`WHERE "createdAt" >= ${sinceDate}` : Prisma.empty}
        GROUP BY date_trunc('month', "createdAt")
        ORDER BY "month" ASC
      `,
      // Budget utilization: clients with spending limits + their spend in period
      prisma.$queryRaw<Array<{
        clientId: string
        clientName: string
        clientType: string
        spent: number
        limit: number
      }>>`
        SELECT c.id AS "clientId",
               c."name" AS "clientName",
               c."type" AS "clientType",
               COALESCE(po_sum.spent, 0)::float AS "spent",
               c."spendingLimit"::float AS "limit"
        FROM clients c
        LEFT JOIN (
          SELECT "clientId", SUM("totalAmount") AS spent
          FROM purchase_orders
          ${sinceDate ? Prisma.sql`WHERE "createdAt" >= ${sinceDate}` : Prisma.empty}
          GROUP BY "clientId"
        ) po_sum ON po_sum."clientId" = c.id
        WHERE c."spendingLimit" IS NOT NULL AND c."spendingLimit" > 0
        ORDER BY (COALESCE(po_sum.spent, 0) / c."spendingLimit") DESC
        LIMIT 50
      `,
    ])

    const totalSpend = poAggregate._sum.totalAmount || 0
    const averageOrderValue = poAggregate._avg.totalAmount || 0
    const fulfillmentRate = totalPOCount > 0
      ? Math.round((fulfilledPOCount / totalPOCount) * 100)
      : 0

    // Vendor spend via bounded raw query (top 10 by item count)
    // Proportionally attributes each PO's totalAmount across its vendors by item count
    const vendorSpendRows = await prisma.$queryRaw<Array<{
      vendorName: string
      totalSpend: number
      orderCount: number
      itemCount: number
    }>>`
      SELECT
        v."vendorName",
        COALESCE(SUM(v.share), 0)::float AS "totalSpend",
        COUNT(DISTINCT v."purchaseOrderId")::int AS "orderCount",
        SUM(v."vendorItemCount")::int AS "itemCount"
      FROM (
        SELECT
          COALESCE(poi."vendorName", 'Unknown Vendor') AS "vendorName",
          poi."purchaseOrderId",
          COUNT(*) AS "vendorItemCount",
          po."totalAmount" * COUNT(*)::float / GREATEST(po_totals."itemCount", 1)::float AS share
        FROM purchase_order_items poi
        JOIN purchase_orders po ON po.id = poi."purchaseOrderId"
        JOIN (
          SELECT "purchaseOrderId", COUNT(*) AS "itemCount"
          FROM purchase_order_items
          GROUP BY "purchaseOrderId"
        ) po_totals ON po_totals."purchaseOrderId" = po.id
        ${sinceDate ? Prisma.sql`WHERE po."createdAt" >= ${sinceDate}` : Prisma.empty}
        GROUP BY COALESCE(poi."vendorName", 'Unknown Vendor'), poi."purchaseOrderId", po."totalAmount", po_totals."itemCount"
      ) v
      GROUP BY v."vendorName"
      ORDER BY "itemCount" DESC
      LIMIT 10
    `

    const vendorSpend: VendorSpend[] = vendorSpendRows.map((row) => ({
      vendorName: row.vendorName,
      totalSpend: row.totalSpend,
      orderCount: row.orderCount,
      itemCount: row.itemCount,
    }))

    // Build client spend from grouped data, enrich with client details
    const clientIds = clientGrouped.map((c) => c.clientId)
    const clientDetails = clientIds.length > 0
      ? await prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, name: true, type: true, spendingLimit: true },
        })
      : []
    const clientDetailMap = new Map(clientDetails.map((c) => [c.id, c]))

    const clientSpend: ClientSpend[] = clientGrouped.map((row) => {
      const client = clientDetailMap.get(row.clientId)
      const spend = row._sum.totalAmount || 0
      const limit = client?.spendingLimit || null
      return {
        clientId: row.clientId,
        clientName: client?.name || 'Unknown',
        clientType: client?.type || 'Unknown',
        totalSpend: spend,
        orderCount: row._count.id,
        spendingLimit: limit,
        budgetUsed: limit && limit > 0
          ? Math.round((spend / limit) * 100)
          : null,
      }
    })

    // Type spend from raw query result
    const typeSpend: TypeSpend[] = typeGrouped.map((row) => ({
      type: row.type,
      totalSpend: row.totalSpend,
      clientCount: row.clientCount,
    }))

    // Monthly spend from raw query result
    const monthlySpend: MonthlySpend[] = monthlyGrouped.map((row) => ({
      month: row.month,
      totalSpend: row.totalSpend,
      orderCount: row.orderCount,
    }))

    // Budget utilization from raw query result
    const budgetUtilization = budgetClients.map((row) => ({
      clientId: row.clientId,
      clientName: row.clientName,
      clientType: row.clientType,
      spent: row.spent,
      limit: row.limit,
      utilization: Math.round((row.spent / row.limit) * 100),
      remaining: row.limit - row.spent,
    }))

    const analytics = {
      summary: {
        totalSpend,
        averageOrderValue,
        activeVendors: activeVendorCount,
        fulfillmentRate,
        totalPOs: totalPOCount,
        totalItems: totalItemCount,
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
