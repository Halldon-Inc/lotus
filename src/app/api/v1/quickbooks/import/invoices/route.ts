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

    const qbInvoices = await qb.getAllPaginated(
      (limit, offset) => qb.getInvoicesFromQB(limit, offset)
    )

    let imported = 0
    let updated = 0
    let skipped = 0
    const errors: string[] = []

    for (const inv of qbInvoices) {
      try {
        if (!inv.Id) {
          skipped++
          continue
        }

        // Check if ClientInvoice already exists with this quickbooksId
        const existingInvoice = await prisma.clientInvoice.findFirst({
          where: { quickbooksId: inv.Id },
        })

        if (existingInvoice) {
          skipped++
          continue
        }

        // Try to match a Lotus client by QB CustomerRef
        let lotusClient: { id: string } | null = null
        if (inv.CustomerRef?.value) {
          lotusClient = await prisma.client.findFirst({
            where: { quickbooksId: inv.CustomerRef.value },
            select: { id: true },
          })
        }

        if (!lotusClient) {
          // Try matching by customer name
          if (inv.CustomerRef?.name) {
            lotusClient = await prisma.client.findFirst({
              where: { name: inv.CustomerRef.name },
              select: { id: true },
            })
          }
        }

        if (!lotusClient) {
          skipped++
          errors.push(
            `Invoice "${inv.DocNumber || inv.Id}": no matching Lotus client for customer "${inv.CustomerRef?.name || inv.CustomerRef?.value || 'unknown'}"`
          )
          continue
        }

        // Need a PO to link to. Find one for this client, or skip.
        const purchaseOrder = await prisma.purchaseOrder.findFirst({
          where: { clientId: lotusClient.id },
          select: { id: true },
          orderBy: { createdAt: 'desc' },
        })

        if (!purchaseOrder) {
          skipped++
          errors.push(
            `Invoice "${inv.DocNumber || inv.Id}": no purchase order found for client`
          )
          continue
        }

        // Determine status: Balance 0 = PAID, else SENT
        const isPaid = inv.Balance !== undefined && inv.Balance === 0
        const wasSent = inv.EmailStatus === 'EmailSent'

        const invoiceNumber = inv.DocNumber || `QB-${inv.Id}`

        // Check for duplicate invoice number
        const duplicateNumber = await prisma.clientInvoice.findUnique({
          where: { invoiceNumber },
          select: { id: true },
        })

        if (duplicateNumber) {
          skipped++
          continue
        }

        await prisma.clientInvoice.create({
          data: {
            purchaseOrderId: purchaseOrder.id,
            clientId: lotusClient.id,
            invoiceNumber,
            totalAmount: inv.TotalAmt,
            dueDate: inv.DueDate ? new Date(inv.DueDate) : null,
            status: isPaid ? 'PAID' : 'SENT',
            sentAt: wasSent ? new Date() : null,
            paidAt: isPaid ? new Date() : null,
            quickbooksId: inv.Id,
          },
        })
        imported++
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        errors.push(`Invoice "${inv.DocNumber || inv.Id}": ${message}`)
      }
    }

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'quickbooks',
        entityId: 'import_invoices',
        action: 'import_invoices',
        details: JSON.stringify({ imported, updated, skipped, errors }),
      },
    })

    return NextResponse.json({
      success: true,
      data: { imported, updated, skipped, errors },
    })
  } catch (error) {
    console.error('QuickBooks invoice import error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to import invoices from QuickBooks' },
      { status: 500 }
    )
  }
}
