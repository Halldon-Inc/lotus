import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { searchDeals, updateDealStage } from '@/lib/hubspot'

interface SyncError {
  poId: string
  poNumber: string
  error: string
}

// Map PO status to HubSpot deal stage
function getDealStageForPOStatus(status: string): string | null {
  switch (status) {
    case 'VERIFIED':
    case 'IN_PURCHASING':
    case 'PARTIALLY_FULFILLED':
    case 'FULFILLED':
      return 'poReceived'
    case 'DELIVERED':
      return 'closedWonToBeInvoiced'
    default:
      return null
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Find all POs where the client has a hubspotId
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        client: {
          hubspotId: { not: null },
        },
      },
      include: {
        client: {
          select: { id: true, name: true, hubspotId: true },
        },
      },
    })

    let synced = 0
    const errors: SyncError[] = []

    for (const po of purchaseOrders) {
      const hubspotId = po.client.hubspotId
      if (!hubspotId) continue

      const targetStage = getDealStageForPOStatus(po.status)
      if (!targetStage) continue

      try {
        // Search for deals associated with this client
        const deals = await searchDeals('hs_object_id', hubspotId)

        if (deals.length === 0) {
          errors.push({
            poId: po.id,
            poNumber: po.poNumber,
            error: `No deals found for client HubSpot ID ${hubspotId}`,
          })
          continue
        }

        // Update the first matching deal
        const result = await updateDealStage(deals[0].id, targetStage)
        if (result) {
          synced++
        } else {
          errors.push({
            poId: po.id,
            poNumber: po.poNumber,
            error: 'Failed to update deal stage',
          })
        }
      } catch (error) {
        errors.push({
          poId: po.id,
          poNumber: po.poNumber,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: { synced, errors },
    })
  } catch (error) {
    console.error('HubSpot sync error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
