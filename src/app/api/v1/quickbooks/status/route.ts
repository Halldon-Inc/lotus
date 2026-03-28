import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const connection = await prisma.quickBooksConnection.findFirst({
      where: { isActive: true },
      select: {
        realmId: true,
        companyName: true,
        lastSyncAt: true,
        syncStatus: true,
        tokenExpiresAt: true,
        connectedAt: true,
      },
    })

    if (!connection) {
      return NextResponse.json({
        success: true,
        data: { connected: false },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        connected: true,
        companyName: connection.companyName,
        lastSyncAt: connection.lastSyncAt,
        syncStatus: connection.syncStatus,
        realmId: connection.realmId,
        tokenExpiresAt: connection.tokenExpiresAt,
        connectedAt: connection.connectedAt,
      },
    })
  } catch (error) {
    console.error('QuickBooks status error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
