import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch all items with reorderPoint > 0 and filter in app layer
    // (SQLite does not support column-to-column comparison in Prisma)
    const allItems = await prisma.inventoryItem.findMany({
      where: {
        reorderPoint: { gt: 0 },
      },
      orderBy: { name: 'asc' },
    })

    const lowStockItems = allItems.filter(
      (item) => item.quantityOnHand <= item.reorderPoint
    )

    return NextResponse.json({
      success: true,
      data: {
        count: lowStockItems.length,
        items: lowStockItems,
      },
    })
  } catch (error) {
    console.error('Low stock GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
