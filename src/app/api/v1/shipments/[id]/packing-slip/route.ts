import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

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
                name: true,
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
                    specifications: true,
                    unitPrice: true,
                  },
                },
              },
            },
          },
          orderBy: { boxNumber: 'asc' },
        },
      },
    })

    if (!shipment) {
      return NextResponse.json(
        { success: false, error: 'Shipment not found' },
        { status: 404 }
      )
    }

    const client = shipment.purchaseOrder.client

    // Build packing slip data
    const packingSlip = {
      shipmentId: shipment.id,
      poNumber: shipment.purchaseOrder.poNumber,
      quoteNumber: shipment.purchaseOrder.quote?.quoteNumber || null,
      scheduledDeliveryDate: shipment.scheduledDate?.toISOString() || null,
      carrier: shipment.carrierName || null,
      trackingNumber: shipment.trackingNumber || null,
      method: shipment.method,
      client: {
        name: client.name,
        contactName: client.contactName,
        contactEmail: client.contactEmail,
        contactPhone: client.contactPhone,
        billingAddress: {
          address: client.address,
          city: client.city,
          state: client.state,
          zip: client.zip,
        },
        shippingAddress: {
          address: client.shippingAddress || client.address,
          city: client.shippingCity || client.city,
          state: client.shippingState || client.state,
          zip: client.shippingZip || client.zip,
        },
      },
      items: shipment.items.map((item) => ({
        boxNumber: item.boxNumber,
        quantity: item.quantity,
        productName: item.purchaseOrderItem.quoteLineItem?.productName || 'Item',
        description: item.purchaseOrderItem.quoteLineItem?.description || null,
        specifications: item.purchaseOrderItem.quoteLineItem?.specifications || null,
        unitPrice: item.purchaseOrderItem.quoteLineItem?.unitPrice || 0,
      })),
      totalItems: shipment.items.reduce((sum, item) => sum + item.quantity, 0),
      notes: shipment.notes,
      createdAt: shipment.createdAt.toISOString(),
    }

    return NextResponse.json({
      success: true,
      data: packingSlip,
    })
  } catch (error) {
    console.error('Packing slip error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
