import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getQuickBooksClient } from '@/lib/quickbooks'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const qb = await getQuickBooksClient()

    // Fetch client invoices with SENT or PAID status that are not yet synced
    const clientInvoices = await prisma.clientInvoice.findMany({
      where: {
        quickbooksId: null,
        status: { in: ['SENT', 'PAID'] },
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            quickbooksId: true,
          },
        },
        purchaseOrder: {
          include: {
            quote: {
              include: {
                lineItems: true,
              },
            },
          },
        },
      },
    })

    let created = 0
    let paymentsRecorded = 0
    const errors: string[] = []

    for (const ci of clientInvoices) {
      try {
        // Ensure the client exists in QuickBooks
        let customerQbId = ci.client.quickbooksId
        if (!customerQbId) {
          customerQbId = await qb.createOrUpdateCustomer({
            name: ci.client.name,
          })
          await prisma.client.update({
            where: { id: ci.client.id },
            data: { quickbooksId: customerQbId },
          })
        }

        // Build line items from the PO's quote
        const lineItems = ci.purchaseOrder.quote.lineItems.map((item) => ({
          productName: item.productName,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        }))

        const qbInvoiceId = await qb.createInvoice(
          {
            invoiceNumber: ci.invoiceNumber,
            totalAmount: ci.totalAmount,
            dueDate: ci.dueDate,
            paidAt: ci.paidAt,
            notes: ci.notes,
          },
          customerQbId,
          lineItems
        )

        await prisma.clientInvoice.update({
          where: { id: ci.id },
          data: { quickbooksId: qbInvoiceId },
        })

        created++

        // If the invoice is already PAID, record the payment in QB
        if (ci.status === 'PAID') {
          try {
            await qb.recordPayment(ci.totalAmount, customerQbId, qbInvoiceId)
            paymentsRecorded++
          } catch (payErr) {
            const message = payErr instanceof Error ? payErr.message : 'Unknown error'
            errors.push(`Payment for "${ci.invoiceNumber}": ${message}`)
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        errors.push(`Client invoice "${ci.invoiceNumber}": ${message}`)
      }
    }

    const synced = created

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'quickbooks',
        entityId: 'invoice_sync',
        action: 'sync_invoices',
        details: JSON.stringify({ synced, created, paymentsRecorded, errors }),
      },
    })

    return NextResponse.json({
      success: true,
      data: { synced, created, paymentsRecorded, errors },
      message: `Synced ${synced} invoices (${created} created, ${paymentsRecorded} payments recorded)`,
    })
  } catch (error) {
    console.error('QuickBooks invoice sync error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
