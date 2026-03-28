import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createClientInvoiceSchema } from '@/lib/validations'

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
    const clientId = searchParams.get('clientId')
    const search = searchParams.get('search') || ''

    const skip = (page - 1) * pageSize
    const where: Record<string, unknown> = {}

    if (status) where.status = status
    if (clientId) where.clientId = clientId
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search } },
        { client: { name: { contains: search } } },
      ]
    }

    const [invoices, total] = await Promise.all([
      prisma.clientInvoice.findMany({
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
              contactName: true,
              contactEmail: true,
            },
          },
          purchaseOrder: {
            select: {
              id: true,
              poNumber: true,
              totalAmount: true,
              status: true,
            },
          },
        },
      }),
      prisma.clientInvoice.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        items: invoices,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Client invoices GET error:', error)
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
    const validation = createClientInvoiceSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const data = validation.data

    // Fetch PO with quote line items for auto-populating amount
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: data.purchaseOrderId },
      include: {
        client: { select: { id: true, name: true } },
        quote: {
          include: {
            lineItems: true,
          },
        },
      },
    })

    if (!po) {
      return NextResponse.json(
        { success: false, error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    // Generate unique invoice number
    const invoiceCount = await prisma.clientInvoice.count()
    const invoiceNumber = `CI-${String(invoiceCount + 1).padStart(5, '0')}`

    const clientInvoice = await prisma.clientInvoice.create({
      data: {
        purchaseOrderId: data.purchaseOrderId,
        clientId: po.clientId,
        shipmentId: data.shipmentId || null,
        invoiceNumber,
        totalAmount: po.totalAmount,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        notes: data.notes || null,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            contactName: true,
            contactEmail: true,
          },
        },
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            totalAmount: true,
            quote: {
              select: {
                quoteNumber: true,
                lineItems: true,
              },
            },
          },
        },
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'clientInvoice',
        entityId: clientInvoice.id,
        action: 'created',
        details: JSON.stringify({
          invoiceNumber,
          clientName: po.client.name,
          poNumber: po.poNumber,
          totalAmount: po.totalAmount,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: clientInvoice,
      message: 'Client invoice created successfully',
    })
  } catch (error) {
    console.error('Client invoices POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
