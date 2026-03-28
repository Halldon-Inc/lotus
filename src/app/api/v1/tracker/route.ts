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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortDirection = (searchParams.get('sortDirection') || 'desc') as 'asc' | 'desc'
    const status = searchParams.get('status')
    const clientId = searchParams.get('clientId')
    const search = searchParams.get('search') || ''

    const skip = (page - 1) * pageSize
    const where: Record<string, unknown> = {}

    if (status) where.status = status
    if (clientId) where.clientId = clientId
    if (search) {
      where.OR = [
        { poNumber: { contains: search } },
        { client: { name: { contains: search } } },
      ]
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
              status: true,
              totalAmount: true,
              request: {
                select: {
                  id: true,
                  subject: true,
                  status: true,
                  priority: true,
                  assignedTo: {
                    select: { id: true, name: true },
                  },
                },
              },
            },
          },
          items: {
            select: {
              id: true,
              status: true,
              quantity: true,
              receivedQuantity: true,
              vendorName: true,
            },
          },
          shipments: {
            select: {
              id: true,
              status: true,
              carrierName: true,
              trackingNumber: true,
              scheduledDate: true,
              deliveredAt: true,
              podStatus: true,
            },
            orderBy: { createdAt: 'desc' },
          },
          clientInvoices: {
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
              totalAmount: true,
              sentAt: true,
              paidAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
          verifiedBy: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.purchaseOrder.count({ where }),
    ])

    // Compute lifecycle summary for each PO
    const trackerData = purchaseOrders.map((po) => {
      const totalItems = po.items.length
      const receivedItems = po.items.filter((i) => i.status === 'RECEIVED').length
      const purchasedItems = po.items.filter((i) => ['PURCHASED', 'SHIPPED', 'RECEIVED'].includes(i.status)).length

      return {
        id: po.id,
        poNumber: po.poNumber,
        totalAmount: po.totalAmount,
        status: po.status,
        rejectionCount: po.rejectionCount,
        client: po.client,
        createdAt: po.createdAt,
        updatedAt: po.updatedAt,
        request: po.quote?.request || null,
        quote: po.quote
          ? { id: po.quote.id, quoteNumber: po.quote.quoteNumber, status: po.quote.status, totalAmount: po.quote.totalAmount }
          : null,
        procurement: {
          totalItems,
          purchasedItems,
          receivedItems,
          progress: totalItems > 0 ? Math.round((purchasedItems / totalItems) * 100) : 0,
        },
        receiving: {
          totalItems,
          receivedItems,
          progress: totalItems > 0 ? Math.round((receivedItems / totalItems) * 100) : 0,
        },
        latestShipment: po.shipments[0] || null,
        shipmentCount: po.shipments.length,
        latestClientInvoice: po.clientInvoices[0] || null,
        clientInvoiceCount: po.clientInvoices.length,
        verifiedBy: po.verifiedBy,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        items: trackerData,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Tracker GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
