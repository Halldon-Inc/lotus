import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { deliveryConfirmed } from '@/lib/email-templates'
import { updateShipmentSchema } from '@/lib/validations'

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

    const shipment = await prisma.shipment.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
                type: true,
                contactName: true,
                contactEmail: true,
                contactPhone: true,
                address: true,
                city: true,
                state: true,
                zip: true,
                shippingAddress: true,
                shippingCity: true,
                shippingState: true,
                shippingZip: true,
              },
            },
            quote: {
              select: {
                id: true,
                quoteNumber: true,
              },
            },
          },
        },
        items: {
          include: {
            purchaseOrderItem: {
              include: {
                quoteLineItem: {
                  select: {
                    productName: true,
                    description: true,
                    quantity: true,
                    unitPrice: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!shipment) {
      return NextResponse.json(
        { success: false, error: 'Shipment not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: shipment,
    })
  } catch (error) {
    console.error('Shipment GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

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
    const validation = updateShipmentSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const existing = await prisma.shipment.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Shipment not found' },
        { status: 404 }
      )
    }

    const data = validation.data

    const updateData: Record<string, unknown> = {}
    if (data.status !== undefined) updateData.status = data.status
    if (data.carrierName !== undefined) updateData.carrierName = data.carrierName
    if (data.trackingNumber !== undefined) updateData.trackingNumber = data.trackingNumber
    if (data.scheduledDate !== undefined) updateData.scheduledDate = data.scheduledDate ? new Date(data.scheduledDate) : null
    if (data.notes !== undefined) updateData.notes = data.notes

    if (data.status === 'IN_TRANSIT' && existing.status !== 'IN_TRANSIT') {
      updateData.shippedAt = new Date()
    }

    const shipment = await prisma.shipment.update({
      where: { id },
      data: updateData,
      include: {
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            client: { select: { id: true, name: true } },
          },
        },
        _count: { select: { items: true } },
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'shipment',
        entityId: shipment.id,
        action: data.status && data.status !== existing.status ? 'status_changed' : 'updated',
        details: JSON.stringify({
          poNumber: shipment.purchaseOrder.poNumber,
          changes: Object.keys(data),
          ...(data.status ? { previousStatus: existing.status, newStatus: data.status } : {}),
        }),
      },
    })

    // Notify client when shipment is delivered
    if (data.status === 'DELIVERED' && existing.status !== 'DELIVERED') {
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: existing.purchaseOrderId },
        include: { client: { select: { contactEmail: true, contactName: true, name: true } } },
      })
      if (po?.client?.contactEmail) {
        const template = deliveryConfirmed(
          po.client.contactName || po.client.name,
          po.poNumber
        )
        sendEmail(po.client.contactEmail, template.subject, template.html).catch(console.error)
      }
    }

    return NextResponse.json({
      success: true,
      data: shipment,
      message: 'Shipment updated successfully',
    })
  } catch (error) {
    console.error('Shipment PUT error:', error)
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

    if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const shipment = await prisma.shipment.findUnique({
      where: { id },
      include: { purchaseOrder: { select: { poNumber: true } } },
    })

    if (!shipment) {
      return NextResponse.json(
        { success: false, error: 'Shipment not found' },
        { status: 404 }
      )
    }

    if (['IN_TRANSIT', 'DELIVERED'].includes(shipment.status)) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete a shipment that is in transit or delivered' },
        { status: 400 }
      )
    }

    await prisma.shipment.delete({ where: { id } })

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'shipment',
        entityId: id,
        action: 'deleted',
        details: JSON.stringify({ poNumber: shipment.purchaseOrder.poNumber }),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Shipment deleted successfully',
    })
  } catch (error) {
    console.error('Shipment DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
