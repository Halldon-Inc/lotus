import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const DEFAULT_TOLERANCE = 5

export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER', 'PROCUREMENT', 'OPERATIONS'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Find all PENDING invoices that have a linked purchase order
    const pendingInvoices = await prisma.invoice.findMany({
      where: {
        status: 'PENDING',
        purchaseOrderId: { not: null },
      },
      include: {
        lineItems: true,
      },
    })

    let matchesCreated = 0

    for (const invoice of pendingInvoices) {
      // Skip if a match record already exists for this invoice + PO pair
      const existing = await prisma.matchRecord.findFirst({
        where: {
          invoiceId: invoice.id,
          purchaseOrderId: invoice.purchaseOrderId as string,
        },
      })

      if (existing) {
        continue
      }

      const purchaseOrder = await prisma.purchaseOrder.findUnique({
        where: { id: invoice.purchaseOrderId as string },
        include: {
          items: {
            include: {
              quoteLineItem: {
                select: {
                  productName: true,
                  quantity: true,
                  unitPrice: true,
                  totalPrice: true,
                },
              },
            },
          },
          client: {
            select: { id: true, name: true },
          },
        },
      })

      if (!purchaseOrder) {
        continue
      }

      // 3-way matching logic (mirrors POST in matching/route.ts)

      // 1. Amount comparison
      const amountDifference = Math.abs(purchaseOrder.totalAmount - invoice.totalAmount)
      const percentDifference = purchaseOrder.totalAmount > 0
        ? (amountDifference / purchaseOrder.totalAmount) * 100
        : (invoice.totalAmount > 0 ? 100 : 0)
      const amountsWithinTolerance = percentDifference <= DEFAULT_TOLERANCE

      // 2. Line item comparison
      const poItemCount = purchaseOrder.items.length
      const invoiceLineItemCount = invoice.lineItems.length
      const totalOrdered = purchaseOrder.items.reduce((sum, item) => sum + item.quantity, 0)
      const totalReceived = purchaseOrder.items.reduce((sum, item) => sum + item.receivedQuantity, 0)
      const totalInvoiced = invoice.lineItems.reduce((sum, item) => sum + item.quantity, 0)

      // 3. Receiving check
      const allItemsReceived = purchaseOrder.items.every(
        (item) => item.status === 'RECEIVED' || item.status === 'CANCELLED'
      )
      const someItemsReceived = purchaseOrder.items.some(
        (item) => item.status === 'RECEIVED'
      )

      let receivingStatus = 'NOT_STARTED'
      if (allItemsReceived) {
        receivingStatus = 'COMPLETE'
      } else if (someItemsReceived) {
        receivingStatus = 'PARTIAL'
      }

      // Determine match status
      let matchStatus: string
      const summaryParts: string[] = []

      if (amountsWithinTolerance && allItemsReceived && Math.abs(totalOrdered - totalInvoiced) <= 1) {
        matchStatus = 'AUTO_MATCHED'
        summaryParts.push('All three documents align within tolerance')
      } else if (amountsWithinTolerance && someItemsReceived) {
        matchStatus = 'PARTIAL_MATCH'
        if (!allItemsReceived) summaryParts.push('Receiving incomplete')
        if (Math.abs(totalOrdered - totalInvoiced) > 1) summaryParts.push('Quantity differences detected')
      } else if (!amountsWithinTolerance) {
        matchStatus = 'MISMATCH'
        summaryParts.push(`Amount difference of ${percentDifference.toFixed(2)}% exceeds ${DEFAULT_TOLERANCE}% tolerance`)
      } else {
        matchStatus = 'PARTIAL_MATCH'
        summaryParts.push('Amounts match but receiving has not started')
      }

      const details = {
        amountComparison: {
          poTotal: purchaseOrder.totalAmount,
          invoiceTotal: invoice.totalAmount,
          difference: amountDifference,
          percentDifference: Math.round(percentDifference * 100) / 100,
          withinTolerance: amountsWithinTolerance,
        },
        itemComparison: {
          poItemCount,
          invoiceLineItemCount,
          totalOrdered,
          totalReceived,
          totalInvoiced,
          receivingComplete: allItemsReceived,
        },
        receivingStatus,
        summary: summaryParts.join('. '),
      }

      // Create match record
      const matchRecord = await prisma.matchRecord.create({
        data: {
          purchaseOrderId: purchaseOrder.id,
          invoiceId: invoice.id,
          status: matchStatus,
          matchedAt: matchStatus === 'AUTO_MATCHED' ? new Date() : null,
          toleranceUsed: DEFAULT_TOLERANCE,
          details: JSON.stringify(details),
        },
      })

      // Update invoice status based on match result
      const invoiceStatus = matchStatus === 'AUTO_MATCHED' ? 'MATCHED'
        : matchStatus === 'PARTIAL_MATCH' ? 'PARTIAL'
        : matchStatus === 'MISMATCH' ? 'DISPUTED'
        : 'PENDING'

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: invoiceStatus },
      })

      // Log activity
      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          entityType: 'matchRecord',
          entityId: matchRecord.id,
          action: 'batch_created',
          details: JSON.stringify({
            poNumber: purchaseOrder.poNumber,
            invoiceNumber: invoice.invoiceNumber,
            matchStatus,
            tolerancePercent: DEFAULT_TOLERANCE,
            amountDifference: amountDifference.toFixed(2),
          }),
        },
      })

      matchesCreated++
    }

    return NextResponse.json({
      success: true,
      data: {
        matchesCreated,
        invoicesProcessed: pendingInvoices.length,
      },
      message: `Batch matching complete: ${matchesCreated} new match records created`,
    })
  } catch (error) {
    console.error('Batch matching error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
