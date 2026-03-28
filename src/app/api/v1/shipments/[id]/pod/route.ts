import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { uploadPodSchema } from '@/lib/validations'
import { searchDeals, updateDealStage, createEngagementNote } from '@/lib/hubspot'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER', 'OPERATIONS'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validation = uploadPodSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const existing = await prisma.shipment.findUnique({
      where: { id },
      include: {
        purchaseOrder: { select: { id: true, poNumber: true } },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Shipment not found' },
        { status: 404 }
      )
    }

    const data = validation.data
    const deliveredAt = data.deliveredAt ? new Date(data.deliveredAt) : new Date()

    // Update shipment with POD and mark as delivered
    const shipment = await prisma.shipment.update({
      where: { id },
      data: {
        podFileUrl: data.podFileUrl,
        podStatus: 'UPLOADED',
        status: 'DELIVERED',
        deliveredAt,
      },
      include: {
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            client: { select: { id: true, name: true, hubspotId: true } },
          },
        },
      },
    })

    // Auto-update PO status to DELIVERED
    await prisma.purchaseOrder.update({
      where: { id: existing.purchaseOrder.id },
      data: { status: 'DELIVERED' },
    })

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'shipment',
        entityId: shipment.id,
        action: 'pod_uploaded',
        details: JSON.stringify({
          poNumber: existing.purchaseOrder.poNumber,
          podFileUrl: data.podFileUrl,
          deliveredAt: deliveredAt.toISOString(),
        }),
      },
    })

    // HubSpot sync
    try {
      const hubspotId = shipment.purchaseOrder.client.hubspotId
      if (hubspotId) {
        const deals = await searchDeals('hs_object_id', hubspotId)
        if (deals.length > 0) {
          await updateDealStage(deals[0].id, 'closedWonToBeInvoiced')
          await createEngagementNote(
            deals[0].id,
            `POD confirmed for PO ${shipment.purchaseOrder.poNumber}, shipment delivered`
          )
        }
      }
    } catch (hubspotError) {
      console.error('HubSpot sync error (POD upload):', hubspotError)
    }

    return NextResponse.json({
      success: true,
      data: shipment,
      message: 'Proof of delivery uploaded and shipment marked as delivered',
    })
  } catch (error) {
    console.error('Shipment POD error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
