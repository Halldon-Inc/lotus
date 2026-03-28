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

    // Fetch all active Lotus clients
    const clients = await prisma.client.findMany({
      select: {
        id: true,
        name: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        quickbooksId: true,
      },
    })

    let created = 0
    let updated = 0
    const errors: string[] = []

    for (const client of clients) {
      try {
        const qbId = await qb.createOrUpdateCustomer(
          {
            name: client.name,
            contactName: client.contactName,
            contactEmail: client.contactEmail,
            contactPhone: client.contactPhone,
            address: client.address,
            city: client.city,
            state: client.state,
            zip: client.zip,
          },
          client.quickbooksId
        )

        if (!client.quickbooksId) {
          await prisma.client.update({
            where: { id: client.id },
            data: { quickbooksId: qbId },
          })
          created++
        } else {
          updated++
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        errors.push(`Client "${client.name}": ${message}`)
      }
    }

    const synced = created + updated

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'quickbooks',
        entityId: 'customer_sync',
        action: 'sync_customers',
        details: JSON.stringify({ synced, created, updated, errors }),
      },
    })

    return NextResponse.json({
      success: true,
      data: { synced, created, updated, errors },
      message: `Synced ${synced} customers (${created} created, ${updated} updated)`,
    })
  } catch (error) {
    console.error('QuickBooks customer sync error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
