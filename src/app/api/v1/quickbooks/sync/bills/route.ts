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

    // Fetch all vendor invoices that have not been synced to QuickBooks
    const invoices = await prisma.invoice.findMany({
      where: { quickbooksId: null },
      include: {
        lineItems: true,
      },
    })

    let created = 0
    const errors: string[] = []

    for (const invoice of invoices) {
      try {
        const qbBillId = await qb.createBill(
          {
            vendorName: invoice.vendorName,
            totalAmount: invoice.totalAmount,
            invoiceNumber: invoice.invoiceNumber,
            dueDate: invoice.dueDate,
            notes: invoice.notes,
          },
          invoice.lineItems.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          }))
        )

        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { quickbooksId: qbBillId },
        })

        created++
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        errors.push(`Invoice "${invoice.invoiceNumber}": ${message}`)
      }
    }

    const synced = created

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'quickbooks',
        entityId: 'bill_sync',
        action: 'sync_bills',
        details: JSON.stringify({ synced, created, errors }),
      },
    })

    return NextResponse.json({
      success: true,
      data: { synced, created, errors },
      message: `Synced ${synced} bills (${created} created)`,
    })
  } catch (error) {
    console.error('QuickBooks bill sync error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
