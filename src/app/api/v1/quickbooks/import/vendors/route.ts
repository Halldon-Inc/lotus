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

    const qbVendors = await qb.getAllPaginated(
      (limit, offset) => qb.getVendors(limit, offset)
    )

    const vendors: string[] = qbVendors.map((v) => v.DisplayName)

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'quickbooks',
        entityId: 'import_vendors',
        action: 'import_vendors',
        details: JSON.stringify({ count: vendors.length, vendors }),
      },
    })

    return NextResponse.json({
      success: true,
      data: { vendors, count: vendors.length },
    })
  } catch (error) {
    console.error('QuickBooks vendor import error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to import vendors from QuickBooks' },
      { status: 500 }
    )
  }
}
