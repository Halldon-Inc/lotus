import { NextResponse, NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createMatchSchema } from '@/lib/validations'

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
      totalMatches,
      autoMatched,
      partialMatches,
      mismatches,
      manualOverrides,
      pendingInvoices,
      recentMatches,
    ] = await Promise.all([
      prisma.matchRecord.count(),
      prisma.matchRecord.count({ where: { status: 'AUTO_MATCHED' } }),
      prisma.matchRecord.count({ where: { status: 'PARTIAL_MATCH' } }),
      prisma.matchRecord.count({ where: { status: 'MISMATCH' } }),
      prisma.matchRecord.count({ where: { status: 'MANUAL_OVERRIDE' } }),
      prisma.invoice.count({ where: { status: 'PENDING' } }),
      prisma.matchRecord.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          purchaseOrder: {
            select: {
              id: true,
              poNumber: true,
              totalAmount: true,
              client: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              vendorName: true,
              totalAmount: true,
            },
          },
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        totalMatches,
        autoMatched,
        partialMatches,
        mismatches,
        manualOverrides,
        pendingInvoices,
        recentMatches,
      },
    })
  } catch (error) {
    console.error('Matching dashboard error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

interface AmountComparison {
  poTotal: number
  invoiceTotal: number
  difference: number
  percentDifference: number
  withinTolerance: boolean
}

interface ItemComparison {
  poItemCount: number
  invoiceLineItemCount: number
  totalOrdered: number
  totalReceived: number
  totalInvoiced: number
  receivingComplete: boolean
}

interface MatchDetails {
  amountComparison: AmountComparison
  itemComparison: ItemComparison
  receivingStatus: string
  summary: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER', 'PROCUREMENT', 'OPERATIONS'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validation = createMatchSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { purchaseOrderId, invoiceId, tolerancePercent } = validation.data

    // Fetch PO with items
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
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
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!purchaseOrder) {
      return NextResponse.json(
        { success: false, error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    // Fetch invoice with line items
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lineItems: true,
      },
    })

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 }
      )
    }

    // 3-way matching logic

    // 1. Amount comparison (PO total vs Invoice total)
    const amountDifference = Math.abs(purchaseOrder.totalAmount - invoice.totalAmount)
    const percentDifference = purchaseOrder.totalAmount > 0
      ? (amountDifference / purchaseOrder.totalAmount) * 100
      : (invoice.totalAmount > 0 ? 100 : 0)
    const amountsWithinTolerance = percentDifference <= tolerancePercent

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
      summaryParts.push(`Amount difference of ${percentDifference.toFixed(2)}% exceeds ${tolerancePercent}% tolerance`)
    } else {
      matchStatus = 'PARTIAL_MATCH'
      summaryParts.push('Amounts match but receiving has not started')
    }

    const details: MatchDetails = {
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
        purchaseOrderId,
        invoiceId,
        status: matchStatus,
        matchedAt: matchStatus === 'AUTO_MATCHED' ? new Date() : null,
        toleranceUsed: tolerancePercent,
        details: JSON.stringify(details),
      },
      include: {
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            totalAmount: true,
            client: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            vendorName: true,
            totalAmount: true,
          },
        },
      },
    })

    // Update invoice status based on match result
    const invoiceStatus = matchStatus === 'AUTO_MATCHED' ? 'MATCHED'
      : matchStatus === 'PARTIAL_MATCH' ? 'PARTIAL'
      : matchStatus === 'MISMATCH' ? 'DISPUTED'
      : 'PENDING'

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: invoiceStatus },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'matchRecord',
        entityId: matchRecord.id,
        action: 'created',
        details: JSON.stringify({
          poNumber: purchaseOrder.poNumber,
          invoiceNumber: invoice.invoiceNumber,
          matchStatus,
          tolerancePercent,
          amountDifference: amountDifference.toFixed(2),
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...matchRecord,
        matchDetails: details,
      },
      message: `Match completed: ${matchStatus.replace('_', ' ').toLowerCase()}`,
    })
  } catch (error) {
    console.error('Matching POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
