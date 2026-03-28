import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Check for active connection
    const connection = await prisma.quickBooksConnection.findFirst({
      where: { isActive: true },
    })

    if (!connection) {
      return NextResponse.json(
        { success: false, error: 'No active QuickBooks connection' },
        { status: 400 }
      )
    }

    // Mark sync as in progress
    await prisma.quickBooksConnection.update({
      where: { id: connection.id },
      data: { syncStatus: 'IN_PROGRESS' },
    })

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const errors: string[] = []

    // Sync customers
    let customersSynced = 0
    try {
      const customersRes = await fetch(
        `${baseUrl}/api/v1/quickbooks/sync/customers`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      )
      if (customersRes.ok) {
        const customersData = await customersRes.json() as { data?: { synced?: number } }
        customersSynced = customersData.data?.synced || 0
      } else {
        errors.push('Customer sync failed')
      }
    } catch (err) {
      errors.push(`Customer sync error: ${err instanceof Error ? err.message : 'Unknown'}`)
    }

    // Sync bills (vendor invoices)
    let billsSynced = 0
    try {
      const billsRes = await fetch(
        `${baseUrl}/api/v1/quickbooks/sync/bills`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      )
      if (billsRes.ok) {
        const billsData = await billsRes.json() as { data?: { synced?: number } }
        billsSynced = billsData.data?.synced || 0
      } else {
        errors.push('Bills sync failed')
      }
    } catch (err) {
      errors.push(`Bills sync error: ${err instanceof Error ? err.message : 'Unknown'}`)
    }

    // Sync client invoices
    let invoicesSynced = 0
    try {
      const invoicesRes = await fetch(
        `${baseUrl}/api/v1/quickbooks/sync/invoices`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      )
      if (invoicesRes.ok) {
        const invoicesData = await invoicesRes.json() as { data?: { synced?: number } }
        invoicesSynced = invoicesData.data?.synced || 0
      } else {
        errors.push('Invoices sync failed')
      }
    } catch (err) {
      errors.push(`Invoices sync error: ${err instanceof Error ? err.message : 'Unknown'}`)
    }

    // Update connection status
    await prisma.quickBooksConnection.update({
      where: { id: connection.id },
      data: {
        lastSyncAt: new Date(),
        syncStatus: errors.length > 0 ? 'PARTIAL' : 'COMPLETED',
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'quickbooks',
        entityId: connection.realmId,
        action: 'full_sync',
        details: JSON.stringify({
          customersSynced,
          billsSynced,
          invoicesSynced,
          errors,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        customersSynced,
        billsSynced,
        invoicesSynced,
        errors,
      },
      message: errors.length > 0
        ? 'Sync completed with some errors'
        : 'Full sync completed successfully',
    })
  } catch (error) {
    console.error('QuickBooks full sync error:', error)

    // Attempt to mark sync as failed
    try {
      const connection = await prisma.quickBooksConnection.findFirst({
        where: { isActive: true },
      })
      if (connection) {
        await prisma.quickBooksConnection.update({
          where: { id: connection.id },
          data: { syncStatus: 'FAILED' },
        })
      }
    } catch {
      // Ignore secondary error
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
