import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { poReceived } from '@/lib/email-templates'
import { createPurchaseOrderSchema, createManualPurchaseOrderSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'

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
    const query = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const sortBy = searchParams.get('sortBy') || 'receivedAt'
    const sortDirection = (searchParams.get('sortDirection') || 'desc') as 'asc' | 'desc'
    const status = searchParams.get('status')
    const clientId = searchParams.get('clientId')

    const skip = (page - 1) * pageSize

    const where: Prisma.PurchaseOrderWhereInput = {}

    if (query) {
      where.OR = [
        { poNumber: { contains: query } },
        { client: { name: { contains: query } } },
        { quote: { is: { quoteNumber: { contains: query } } } },
      ]
    }

    if (status) {
      where.status = status
    }

    if (clientId) {
      where.clientId = clientId
    }

    const [purchaseOrders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortBy]: sortDirection },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          quote: {
            select: {
              id: true,
              quoteNumber: true,
              totalAmount: true,
              request: {
                select: {
                  subject: true,
                },
              },
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
            select: {
              id: true,
              status: true,
              quantity: true,
              receivedQuantity: true,
            },
          },
          _count: {
            select: {
              items: true,
            },
          },
        },
      }),
      prisma.purchaseOrder.count({ where }),
    ])

    // Add progress stats to each PO
    const purchaseOrdersWithStats = purchaseOrders.map(po => ({
      ...po,
      itemsProgress: {
        total: po.items.length,
        pending: po.items.filter(item => item.status === 'PENDING').length,
        sourced: po.items.filter(item => item.status === 'SOURCED').length,
        purchased: po.items.filter(item => item.status === 'PURCHASED').length,
        shipped: po.items.filter(item => item.status === 'SHIPPED').length,
        received: po.items.filter(item => item.status === 'RECEIVED').length,
        missing: po.items.filter(item => item.status === 'MISSING').length,
      },
    }))

    return NextResponse.json({
      success: true,
      data: {
        items: purchaseOrdersWithStats,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Purchase Orders GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER', 'SALES', 'OPERATIONS'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const isManual = !body.quoteId

    if (isManual) {
      // Manual PO creation path (no quote)
      const validation = createManualPurchaseOrderSchema.safeParse(body)

      if (!validation.success) {
        return NextResponse.json(
          { success: false, error: 'Validation failed', details: validation.error.issues },
          { status: 400 }
        )
      }

      const data = validation.data

      // Verify client exists
      const client = await prisma.client.findUnique({
        where: { id: data.clientId },
        select: { id: true, name: true, type: true },
      })

      if (!client) {
        return NextResponse.json(
          { success: false, error: 'Client not found' },
          { status: 404 }
        )
      }

      // Create PO with items in a transaction
      const purchaseOrder = await prisma.$transaction(async (tx) => {
        const newPO = await tx.purchaseOrder.create({
          data: {
            clientId: data.clientId,
            poNumber: data.poNumber,
            totalAmount: data.totalAmount,
            scheduledDeliveryDate: data.scheduledDeliveryDate
              ? new Date(data.scheduledDeliveryDate)
              : undefined,
            deliveryMethod: data.deliveryMethod,
            procurementMethod: data.procurementMethod,
            notes: data.notes,
          },
          include: {
            client: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        })

        // Create PO items from the submitted line items
        const items = await Promise.all(
          data.items.map((item) =>
            tx.purchaseOrderItem.create({
              data: {
                purchaseOrderId: newPO.id,
                quantity: item.quantity,
                vendorName: item.vendorName || undefined,
                sourceUrl: item.sourceUrl || undefined,
              },
            })
          )
        )

        return {
          ...newPO,
          items,
        }
      })

      // Log activity
      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          entityType: 'purchaseOrder',
          entityId: purchaseOrder.id,
          action: 'created',
          details: JSON.stringify({
            poNumber: purchaseOrder.poNumber,
            clientName: purchaseOrder.client.name,
            totalAmount: purchaseOrder.totalAmount,
            itemCount: data.items.length,
            source: 'manual',
          }),
        },
      })

      // Notify client contact that PO was received
      const manualClient = await prisma.client.findUnique({
        where: { id: data.clientId },
        select: { contactEmail: true, contactName: true, name: true },
      })
      if (manualClient?.contactEmail) {
        const template = poReceived(
          manualClient.contactName || manualClient.name,
          purchaseOrder.poNumber
        )
        sendEmail(manualClient.contactEmail, template.subject, template.html).catch(console.error)
      }

      return NextResponse.json({
        success: true,
        data: purchaseOrder,
        message: 'Purchase order created successfully',
      })
    }

    // Quote-based PO creation path
    const validation = createPurchaseOrderSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const data = validation.data

    // Verify quote exists and doesn't already have a PO
    const quote = await prisma.quote.findUnique({
      where: { id: data.quoteId },
      include: {
        client: true,
        lineItems: true,
        purchaseOrder: true,
      },
    })

    if (!quote) {
      return NextResponse.json(
        { success: false, error: 'Quote not found' },
        { status: 404 }
      )
    }

    if (quote.purchaseOrder) {
      return NextResponse.json(
        { success: false, error: 'Quote already has a purchase order' },
        { status: 400 }
      )
    }

    if (quote.status !== 'ACCEPTED') {
      return NextResponse.json(
        { success: false, error: 'Quote must be accepted before creating purchase order' },
        { status: 400 }
      )
    }

    // Create PO with items in a transaction
    const purchaseOrder = await prisma.$transaction(async (tx) => {
      const newPO = await tx.purchaseOrder.create({
        data: {
          quoteId: data.quoteId,
          clientId: quote.clientId,
          poNumber: data.poNumber,
          totalAmount: data.totalAmount || quote.totalAmount,
          discrepancyNotes: data.discrepancyNotes,
          scheduledDeliveryDate: data.scheduledDeliveryDate
            ? new Date(data.scheduledDeliveryDate)
            : undefined,
          deliveryMethod: data.deliveryMethod,
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          quote: {
            select: {
              id: true,
              quoteNumber: true,
              totalAmount: true,
            },
          },
        },
      })

      // Create PO items from quote line items
      const items = await Promise.all(
        quote.lineItems.map((lineItem) =>
          tx.purchaseOrderItem.create({
            data: {
              purchaseOrderId: newPO.id,
              quoteLineItemId: lineItem.id,
              quantity: lineItem.quantity,
            },
          })
        )
      )

      return {
        ...newPO,
        items,
      }
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'purchaseOrder',
        entityId: purchaseOrder.id,
        action: 'created',
        details: JSON.stringify({
          poNumber: purchaseOrder.poNumber,
          clientName: purchaseOrder.client.name,
          totalAmount: purchaseOrder.totalAmount,
          itemCount: quote.lineItems.length,
          source: 'quote',
        }),
      },
    })

    // Notify client contact that PO was received
    if (quote.client?.contactEmail) {
      const template = poReceived(
        quote.client.contactName || quote.client.name,
        purchaseOrder.poNumber
      )
      sendEmail(quote.client.contactEmail, template.subject, template.html).catch(console.error)
    }

    return NextResponse.json({
      success: true,
      data: purchaseOrder,
      message: 'Purchase order created successfully',
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A record with this identifier already exists' },
        { status: 409 }
      )
    }
    console.error('Purchase Orders POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
