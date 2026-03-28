import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createShipmentSchema } from '@/lib/validations'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortDirection = (searchParams.get('sortDirection') || 'desc') as 'asc' | 'desc'
    const status = searchParams.get('status')
    const purchaseOrderId = searchParams.get('purchaseOrderId')

    const skip = (page - 1) * pageSize
    const where: Record<string, unknown> = {}

    if (status) where.status = status
    if (purchaseOrderId) where.purchaseOrderId = purchaseOrderId

    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortBy]: sortDirection },
        include: {
          purchaseOrder: {
            select: {
              id: true,
              poNumber: true,
              totalAmount: true,
              status: true,
              client: {
                select: {
                  id: true,
                  name: true,
                  contactName: true,
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
                    },
                  },
                },
              },
            },
          },
          _count: {
            select: { items: true },
          },
        },
      }),
      prisma.shipment.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        items: shipments,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Shipments GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER', 'OPERATIONS'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validation = createShipmentSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const data = validation.data

    // Verify PO exists and is fulfilled
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: data.purchaseOrderId },
    })

    if (!po) {
      return NextResponse.json(
        { success: false, error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    // Verify all PO items exist
    const poItemIds = data.items.map((i) => i.purchaseOrderItemId)
    const poItems = await prisma.purchaseOrderItem.findMany({
      where: { id: { in: poItemIds }, purchaseOrderId: data.purchaseOrderId },
    })

    if (poItems.length !== poItemIds.length) {
      return NextResponse.json(
        { success: false, error: 'One or more PO items not found or do not belong to this PO' },
        { status: 400 }
      )
    }

    const shipment = await prisma.$transaction(async (tx) => {
      const created = await tx.shipment.create({
        data: {
          purchaseOrderId: data.purchaseOrderId,
          method: data.method,
          carrierName: data.carrierName || null,
          trackingNumber: data.trackingNumber || null,
          scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
          notes: data.notes || null,
        },
      })

      await Promise.all(
        data.items.map((item) =>
          tx.shipmentItem.create({
            data: {
              shipmentId: created.id,
              purchaseOrderItemId: item.purchaseOrderItemId,
              quantity: item.quantity,
              boxNumber: item.boxNumber || null,
            },
          })
        )
      )

      return tx.shipment.findUnique({
        where: { id: created.id },
        include: {
          items: {
            include: {
              purchaseOrderItem: {
                include: {
                  quoteLineItem: { select: { productName: true } },
                },
              },
            },
          },
          purchaseOrder: {
            select: {
              id: true,
              poNumber: true,
              client: { select: { id: true, name: true } },
            },
          },
        },
      })
    })

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'shipment',
        entityId: shipment!.id,
        action: 'created',
        details: JSON.stringify({
          poNumber: po.poNumber,
          method: data.method,
          itemCount: data.items.length,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: shipment,
      message: 'Shipment created successfully',
    })
  } catch (error) {
    console.error('Shipments POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
