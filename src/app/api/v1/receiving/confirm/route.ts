import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { receivingConfirmSchema } from '@/lib/validations'

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER', 'OPERATIONS', 'PROCUREMENT'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validation = receivingConfirmSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { items } = validation.data

    // Optional shipment reference from the body (not in schema, passed alongside)
    const shipmentRef = (body.shipmentReference as string) || null
    const photoUrls = (body.photoUrls as string[]) || []

    // Verify all items exist
    const itemIds = items.map((item) => item.id)
    const existingItems = await prisma.purchaseOrderItem.findMany({
      where: { id: { in: itemIds } },
      include: {
        purchaseOrder: true,
        quoteLineItem: {
          select: { productName: true },
        },
      },
    })

    if (existingItems.length !== items.length) {
      const foundIds = new Set(existingItems.map((item) => item.id))
      const missingIds = itemIds.filter((id) => !foundIds.has(id))
      return NextResponse.json(
        { success: false, error: `Items not found: ${missingIds.join(', ')}` },
        { status: 404 }
      )
    }

    // Track which POs are affected
    const affectedPOIds = Array.from(new Set(existingItems.map((item) => item.purchaseOrderId)))

    // Update items in a transaction
    const updatedItems = await prisma.$transaction(async (tx) => {
      const results: { id: string; productName: string; receivedQuantity: number; expectedQuantity: number; discrepancy: boolean }[] = []

      for (const item of items) {
        const existingItem = existingItems.find((ei) => ei.id === item.id)
        if (!existingItem) continue

        // Support partial receiving: add to existing receivedQuantity
        const previouslyReceived = existingItem.receivedQuantity || 0
        const newTotalReceived = previouslyReceived + item.receivedQuantity

        // Cap: cumulative received quantity cannot exceed ordered quantity
        if (newTotalReceived > existingItem.quantity) {
          throw new Error(`Cannot receive ${item.receivedQuantity} units for item ${item.id}. Only ${existingItem.quantity - previouslyReceived} remaining.`)
        }

        const isFullyReceived = newTotalReceived >= existingItem.quantity
        const discrepancy = isFullyReceived && newTotalReceived !== existingItem.quantity

        const discrepancyNote = discrepancy
          ? `Expected ${existingItem.quantity}, total received ${newTotalReceived}${item.notes ? `. ${item.notes}` : ''}`
          : item.notes || null

        const newStatus = isFullyReceived ? 'RECEIVED' : existingItem.status === 'PENDING' ? 'SHIPPED' : existingItem.status

        // Build update data, including per-item tracking/vendor/notes if provided
        const itemUpdateData: Record<string, unknown> = {
          status: newStatus,
          receivedAt: isFullyReceived ? new Date() : existingItem.receivedAt,
          receivedQuantity: newTotalReceived,
        }

        // Per-item fields from the body (outside the validated schema, passed alongside)
        const rawItem = (body.items as Array<Record<string, unknown>>)?.find(
          (ri) => ri.id === item.id
        )
        const itemTrackingNumber = (rawItem?.trackingNumber as string) || null
        const itemVendorName = (rawItem?.vendorName as string) || null
        const itemNotes = (rawItem?.notes as string) || item.notes || null

        if (itemTrackingNumber) {
          itemUpdateData.trackingNumber = itemTrackingNumber
        }
        if (itemVendorName) {
          itemUpdateData.vendorName = itemVendorName
        }

        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: itemUpdateData,
        })

        results.push({
          id: item.id,
          productName: existingItem.quoteLineItem?.productName || 'Unknown item',
          receivedQuantity: item.receivedQuantity,
          expectedQuantity: existingItem.quantity,
          discrepancy,
        })

        // Log activity for each item with shipment context and per-item vendor/tracking
        await tx.activityLog.create({
          data: {
            userId: session.user.id,
            entityType: 'purchaseOrderItem',
            entityId: item.id,
            action: 'received',
            details: JSON.stringify({
              purchaseOrderId: existingItem.purchaseOrderId,
              receivedQuantity: item.receivedQuantity,
              totalReceived: newTotalReceived,
              expectedQuantity: existingItem.quantity,
              previouslyReceived,
              isPartialReceive: !isFullyReceived,
              discrepancy,
              notes: itemNotes,
              trackingNumber: itemTrackingNumber,
              vendorName: itemVendorName,
              shipmentReference: shipmentRef,
              photoUrls,
            }),
          },
        })
      }

      // Check each affected PO: update status based on item states
      for (const poId of affectedPOIds) {
        const allItems = await tx.purchaseOrderItem.findMany({
          where: { purchaseOrderId: poId },
        })

        const allReceived = allItems.every((item) => item.status === 'RECEIVED')

        if (allReceived) {
          await tx.purchaseOrder.update({
            where: { id: poId },
            data: { status: 'FULFILLED' },
          })

          await tx.activityLog.create({
            data: {
              userId: session.user.id,
              entityType: 'purchaseOrder',
              entityId: poId,
              action: 'status_changed',
              details: JSON.stringify({
                newStatus: 'FULFILLED',
                reason: 'All items received',
              }),
            },
          })
        } else {
          // Check if some items are received for partial fulfillment
          const someReceived = allItems.some((item) => item.status === 'RECEIVED')
          const somePartiallyReceived = allItems.some((item) => item.receivedQuantity > 0 && item.status !== 'RECEIVED')

          if (someReceived || somePartiallyReceived) {
            const currentPO = await tx.purchaseOrder.findUnique({
              where: { id: poId },
            })
            if (currentPO && currentPO.status !== 'PARTIALLY_FULFILLED') {
              await tx.purchaseOrder.update({
                where: { id: poId },
                data: { status: 'PARTIALLY_FULFILLED' },
              })
            }
          }
        }

        // If any items had discrepancies, add discrepancy notes to the PO
        const discrepancyNotes = items
          .filter((item) => {
            const existing = existingItems.find((ei) => ei.id === item.id)
            if (!existing || existing.purchaseOrderId !== poId) return false
            const newTotal = (existing.receivedQuantity || 0) + item.receivedQuantity
            return newTotal >= existing.quantity && newTotal !== existing.quantity
          })
          .map((item) => {
            const existing = existingItems.find((ei) => ei.id === item.id)
            const productName = existing?.quoteLineItem?.productName || item.id
            const newTotal = (existing?.receivedQuantity || 0) + item.receivedQuantity
            return `${productName}: expected ${existing?.quantity}, received ${newTotal}${item.notes ? ` (${item.notes})` : ''}`
          })

        if (discrepancyNotes.length > 0) {
          const currentPO = await tx.purchaseOrder.findUnique({
            where: { id: poId },
          })
          const existingNotes = currentPO?.discrepancyNotes || ''
          const timestamp = new Date().toISOString().split('T')[0]
          const newBlock = `[${timestamp}] ${discrepancyNotes.join('; ')}`
          const newNotes = existingNotes
            ? `${existingNotes}\n${newBlock}`
            : newBlock

          await tx.purchaseOrder.update({
            where: { id: poId },
            data: { discrepancyNotes: newNotes },
          })
        }
      }

      // Log a summary receiving event for the activity feed
      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          entityType: 'receiving',
          entityId: affectedPOIds[0] || 'batch',
          action: 'batch_received',
          details: JSON.stringify({
            affectedPurchaseOrders: affectedPOIds,
            itemCount: results.length,
            shipmentReference: shipmentRef,
            photoUrls,
            items: results.map((r) => ({
              id: r.id,
              productName: r.productName,
              receivedQuantity: r.receivedQuantity,
            })),
          }),
        },
      })

      return results
    })

    return NextResponse.json({
      success: true,
      data: {
        updatedItems: updatedItems.length,
        affectedPurchaseOrders: affectedPOIds,
        items: updatedItems,
      },
      message: 'Items received successfully',
    })
  } catch (error) {
    console.error('Receiving confirm error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    const isValidation = message.startsWith('Cannot receive')
    return NextResponse.json(
      { success: false, error: message },
      { status: isValidation ? 400 : 500 }
    )
  }
}
