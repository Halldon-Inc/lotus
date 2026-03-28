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
    const purchaseOrderId = searchParams.get('purchaseOrderId')

    if (!purchaseOrderId) {
      return NextResponse.json(
        { success: false, error: 'purchaseOrderId query parameter is required' },
        { status: 400 }
      )
    }

    // Verify PO exists
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: { id: true, poNumber: true },
    })

    if (!purchaseOrder) {
      return NextResponse.json(
        { success: false, error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    // Fetch all receiving-related activity logs for this PO
    // This includes both individual item receives and batch receives
    const activityLogs = await prisma.activityLog.findMany({
      where: {
        OR: [
          // Batch receives that reference this PO
          {
            entityType: 'receiving',
            action: 'batch_received',
          },
          // Individual item receives for items in this PO
          {
            entityType: 'purchaseOrderItem',
            action: 'received',
          },
          // PO status changes (e.g. PARTIALLY_FULFILLED, FULFILLED)
          {
            entityType: 'purchaseOrder',
            entityId: purchaseOrderId,
            action: 'status_changed',
          },
        ],
      },
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

    // Filter to only logs that reference this specific PO
    const relevantLogs = activityLogs.filter((log) => {
      if (log.entityType === 'purchaseOrder' && log.entityId === purchaseOrderId) {
        return true
      }

      if (!log.details) return false

      try {
        const details = JSON.parse(log.details)

        // Batch receives: check affectedPurchaseOrders array
        if (log.entityType === 'receiving' && log.action === 'batch_received') {
          const affected = details.affectedPurchaseOrders || []
          return affected.includes(purchaseOrderId)
        }

        // Individual item receives: check purchaseOrderId in details
        if (log.entityType === 'purchaseOrderItem' && log.action === 'received') {
          return details.purchaseOrderId === purchaseOrderId
        }
      } catch {
        return false
      }

      return false
    })

    // Get current item states for context
    const currentItems = await prisma.purchaseOrderItem.findMany({
      where: { purchaseOrderId },
      include: {
        quoteLineItem: {
          select: { productName: true },
        },
      },
    })

    const itemMap = new Map(currentItems.map((item) => [item.id, item]))

    // Transform logs into receiving events
    const events = relevantLogs.map((log) => {
      const details = log.details ? JSON.parse(log.details) : {}

      if (log.entityType === 'receiving' && log.action === 'batch_received') {
        // Filter items to only those belonging to this PO
        const batchItems = (details.items || []).filter((item: { id: string }) => {
          const currentItem = itemMap.get(item.id)
          return !!currentItem
        })

        return {
          id: log.id,
          type: 'batch_receive' as const,
          timestamp: log.createdAt,
          user: {
            id: log.user.id,
            name: log.user.name || log.user.email,
          },
          items: batchItems.map((item: { id: string; productName: string; receivedQuantity: number }) => ({
            id: item.id,
            productName: item.productName,
            receivedQuantity: item.receivedQuantity,
          })),
          shipmentReference: details.shipmentReference || null,
          photoUrls: details.photoUrls || [],
          itemCount: batchItems.length,
        }
      }

      if (log.entityType === 'purchaseOrderItem' && log.action === 'received') {
        const currentItem = itemMap.get(log.entityId)
        return {
          id: log.id,
          type: 'item_receive' as const,
          timestamp: log.createdAt,
          user: {
            id: log.user.id,
            name: log.user.name || log.user.email,
          },
          itemId: log.entityId,
          productName: currentItem?.quoteLineItem?.productName || details.productName || 'Unknown',
          receivedQuantity: details.receivedQuantity || 0,
          totalReceived: details.totalReceived || 0,
          expectedQuantity: details.expectedQuantity || 0,
          previouslyReceived: details.previouslyReceived || 0,
          isPartialReceive: details.isPartialReceive || false,
          discrepancy: details.discrepancy || false,
          notes: details.notes || null,
          shipmentReference: details.shipmentReference || null,
          trackingNumber: details.trackingNumber || null,
          vendorName: details.vendorName || null,
        }
      }

      // PO status changes
      return {
        id: log.id,
        type: 'status_change' as const,
        timestamp: log.createdAt,
        user: {
          id: log.user.id,
          name: log.user.name || log.user.email,
        },
        newStatus: details.newStatus || null,
        reason: details.reason || null,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        purchaseOrderId,
        poNumber: purchaseOrder.poNumber,
        events,
        summary: {
          totalEvents: events.length,
          totalItemsReceived: currentItems.filter((i) => i.status === 'RECEIVED').length,
          totalItems: currentItems.length,
          itemsWithDiscrepancy: currentItems.filter(
            (i) => i.status === 'RECEIVED' && i.receivedQuantity !== i.quantity
          ).length,
        },
      },
    })
  } catch (error) {
    console.error('Receiving history error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
