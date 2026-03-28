import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const connection = await prisma.quickBooksConnection.findFirst({
      where: { isActive: true },
    })

    if (!connection) {
      return NextResponse.json(
        { success: false, error: 'No active QuickBooks connection found' },
        { status: 404 }
      )
    }

    await prisma.quickBooksConnection.update({
      where: { id: connection.id },
      data: { isActive: false },
    })

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'quickbooks',
        entityId: connection.realmId,
        action: 'disconnected',
        details: JSON.stringify({
          realmId: connection.realmId,
          companyName: connection.companyName,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'QuickBooks disconnected successfully',
    })
  } catch (error) {
    console.error('QuickBooks disconnect error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
