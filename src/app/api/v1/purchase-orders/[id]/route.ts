import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { updatePurchaseOrderSchema } from '@/lib/validations'
import { sendEmail } from '@/lib/email'
import { procurementAlert, poNeedsCorrection, deliveryConfirmed } from '@/lib/email-templates'
import { searchDeals, updateDealStage, createEngagementNote } from '@/lib/hubspot'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            type: true,
            contactName: true,
            contactEmail: true,
            contactPhone: true,
          },
        },
        quote: {
          include: {
            request: {
              select: {
                id: true,
                subject: true,
                description: true,
                priority: true,
              },
            },
            lineItems: true,
          },
        },
        verifiedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            quoteLineItem: true,
            sourcedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            purchasedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!purchaseOrder) {
      return NextResponse.json(
        { success: false, error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: purchaseOrder,
    })
  } catch (error) {
    console.error('Purchase Order GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
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
    const validation = updatePurchaseOrderSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const data = validation.data

    // Check if purchase order exists
    const existingPO = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        quote: {
          select: {
            request: {
              select: {
                assignedToId: true,
              },
            },
          },
        },
      },
    })

    if (!existingPO) {
      return NextResponse.json(
        { success: false, error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    // NEEDS_CORRECTION requires a rejectionReason
    if (data.status === 'NEEDS_CORRECTION' && !data.rejectionReason) {
      return NextResponse.json(
        { success: false, error: 'rejectionReason is required when setting status to NEEDS_CORRECTION' },
        { status: 400 }
      )
    }

    // Build update payload
    const updateData: Record<string, unknown> = {}
    if (data.status !== undefined) updateData.status = data.status
    if (data.discrepancyNotes !== undefined) updateData.discrepancyNotes = data.discrepancyNotes
    if (data.rejectionReason !== undefined) updateData.rejectionReason = data.rejectionReason
    if (data.scheduledDeliveryDate !== undefined) {
      updateData.scheduledDeliveryDate = data.scheduledDeliveryDate ? new Date(data.scheduledDeliveryDate) : null
    }
    if (data.deliveryMethod !== undefined) updateData.deliveryMethod = data.deliveryMethod

    // Auto-set verifiedById when VERIFIED
    if (data.status === 'VERIFIED') {
      updateData.verifiedById = data.verifiedById || session.user.id
    } else if (data.verifiedById) {
      updateData.verifiedById = data.verifiedById
    }

    // Increment rejectionCount on NEEDS_CORRECTION
    if (data.status === 'NEEDS_CORRECTION') {
      updateData.rejectionCount = (existingPO.rejectionCount || 0) + 1
    }

    // RESUBMITTED moves PO back to RECEIVED
    if (data.status === 'RESUBMITTED') {
      updateData.status = 'RECEIVED'
      updateData.rejectionReason = null
    }

    const purchaseOrder = await prisma.purchaseOrder.update({
      where: { id },
      data: updateData,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            type: true,
            hubspotId: true,
          },
        },
        verifiedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        quote: {
          select: {
            id: true,
            quoteNumber: true,
          },
        },
      },
    })

    // Log activity
    const action = data.status && data.status !== existingPO.status ? 'status_changed' : 'updated'
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'purchaseOrder',
        entityId: purchaseOrder.id,
        action,
        details: JSON.stringify({
          poNumber: purchaseOrder.poNumber,
          changes: Object.keys(data),
          ...(data.status ? { previousStatus: existingPO.status, newStatus: data.status } : {}),
          ...(data.rejectionReason ? { rejectionReason: data.rejectionReason } : {}),
        }),
      },
    })

    // Auto-alert: NEEDS_CORRECTION notifies the assigned sales rep
    if (data.status === 'NEEDS_CORRECTION') {
      const assignedSalesRepId = existingPO.quote?.request?.assignedToId
      if (assignedSalesRepId) {
        await prisma.activityLog.create({
          data: {
            userId: session.user.id,
            entityType: 'alert',
            entityId: purchaseOrder.id,
            action: 'po_needs_correction',
            details: JSON.stringify({
              type: 'WARNING',
              targetUserId: assignedSalesRepId,
              poNumber: purchaseOrder.poNumber,
              rejectionReason: data.rejectionReason,
              rejectionCount: purchaseOrder.rejectionCount,
              message: `PO ${purchaseOrder.poNumber} needs correction: ${data.rejectionReason}`,
            }),
          },
        })

        // Email the assigned sales rep
        try {
          const salesRep = await prisma.user.findUnique({
            where: { id: assignedSalesRepId },
            select: { email: true, name: true },
          })
          if (salesRep?.email) {
            const template = poNeedsCorrection(
              purchaseOrder.poNumber,
              data.rejectionReason || 'Correction required',
              salesRep.name || 'Team Member'
            )
            await sendEmail(salesRep.email, template.subject, template.html)
          }
        } catch (emailError) {
          console.error('Failed to send NEEDS_CORRECTION email:', emailError)
        }
      }
    }

    // Auto-alert: VERIFIED notifies all PROCUREMENT role users
    if (data.status === 'VERIFIED' && existingPO.status !== 'VERIFIED') {
      const procurementUsers = await prisma.user.findMany({
        where: { role: 'PROCUREMENT' },
        select: { id: true, email: true },
      })

      if (procurementUsers.length > 0) {
        await Promise.all(
          procurementUsers.map((user) =>
            prisma.activityLog.create({
              data: {
                userId: session.user.id,
                entityType: 'alert',
                entityId: purchaseOrder.id,
                action: 'po_verified_ready',
                details: JSON.stringify({
                  type: 'INFO',
                  targetUserId: user.id,
                  poNumber: purchaseOrder.poNumber,
                  clientName: purchaseOrder.client.name,
                  message: `PO ${purchaseOrder.poNumber} has been verified and is ready for procurement`,
                }),
              },
            })
          )
        )

        // Email all procurement users
        try {
          const itemCount = await prisma.purchaseOrderItem.count({
            where: { purchaseOrderId: purchaseOrder.id },
          })
          const template = procurementAlert(purchaseOrder.poNumber, itemCount)
          await Promise.all(
            procurementUsers
              .filter((u) => u.email)
              .map((u) => sendEmail(u.email, template.subject, template.html))
          )
        } catch (emailError) {
          console.error('Failed to send VERIFIED procurement emails:', emailError)
        }
      }
    }

    // HubSpot sync
    try {
      const hubspotId = purchaseOrder.client.hubspotId
      if (hubspotId) {
        if (data.status === 'VERIFIED' && existingPO.status !== 'VERIFIED') {
          const deals = await searchDeals('hs_object_id', hubspotId)
          if (deals.length > 0) {
            await updateDealStage(deals[0].id, 'poReceived')
            await createEngagementNote(
              deals[0].id,
              `PO ${purchaseOrder.poNumber} verified and ready for procurement`
            )
          }
        }
        if (data.status === 'DELIVERED' && existingPO.status !== 'DELIVERED') {
          const deals = await searchDeals('hs_object_id', hubspotId)
          if (deals.length > 0) {
            await updateDealStage(deals[0].id, 'closedWonToBeInvoiced')
            await createEngagementNote(
              deals[0].id,
              `PO ${purchaseOrder.poNumber} delivered successfully`
            )
          }
        }
      }
    } catch (hubspotError) {
      console.error('HubSpot sync error (PO status change):', hubspotError)
    }

    // Email: DELIVERED notifies client contact
    if (data.status === 'DELIVERED' && existingPO.status !== 'DELIVERED') {
      try {
        const poWithClient = await prisma.purchaseOrder.findUnique({
          where: { id: purchaseOrder.id },
          select: {
            client: { select: { contactEmail: true, contactName: true, name: true } },
          },
        })
        const clientEmail = poWithClient?.client?.contactEmail
        if (clientEmail) {
          const clientName = poWithClient.client.contactName || poWithClient.client.name
          const template = deliveryConfirmed(clientName, purchaseOrder.poNumber)
          await sendEmail(clientEmail, template.subject, template.html)
        }
      } catch (emailError) {
        console.error('Failed to send DELIVERED email:', emailError)
      }
    }

    return NextResponse.json({
      success: true,
      data: purchaseOrder,
      message: 'Purchase order updated successfully',
    })
  } catch (error) {
    console.error('Purchase Order PATCH error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Check if purchase order exists and can be deleted
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: true,
      },
    })

    if (!purchaseOrder) {
      return NextResponse.json(
        { success: false, error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    // Check if any items have been purchased
    const hasProgress = purchaseOrder.items.some(
      item => ['PURCHASED', 'SHIPPED', 'RECEIVED'].includes(item.status)
    )

    if (hasProgress) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete purchase order with items in progress' },
        { status: 400 }
      )
    }

    // Delete purchase order (items will be cascade deleted)
    await prisma.purchaseOrder.delete({
      where: { id },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'purchaseOrder',
        entityId: id,
        action: 'deleted',
        details: JSON.stringify({
          poNumber: purchaseOrder.poNumber,
          totalAmount: purchaseOrder.totalAmount,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Purchase order deleted successfully',
    })
  } catch (error) {
    console.error('Purchase Order DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
