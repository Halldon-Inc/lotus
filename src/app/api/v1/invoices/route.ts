import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createInvoiceSchema } from '@/lib/validations'
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
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortDirection = (searchParams.get('sortDirection') || 'desc') as 'asc' | 'desc'
    const status = searchParams.get('status')
    const vendor = searchParams.get('vendor')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const search = searchParams.get('search') || ''

    const skip = (page - 1) * pageSize

    const where: Record<string, unknown> = {}

    if (status) {
      where.status = status
    }

    if (vendor) {
      where.vendorName = { contains: vendor }
    }

    if (dateFrom || dateTo) {
      const receivedAtFilter: Record<string, Date> = {}
      if (dateFrom) receivedAtFilter.gte = new Date(dateFrom)
      if (dateTo) receivedAtFilter.lte = new Date(dateTo)
      where.receivedAt = receivedAtFilter
    }

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search } },
        { vendorName: { contains: search } },
      ]
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
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
                },
              },
            },
          },
          lineItems: true,
          matchRecords: {
            select: {
              id: true,
              status: true,
              matchedAt: true,
            },
          },
          _count: {
            select: {
              lineItems: true,
              matchRecords: true,
            },
          },
        },
      }),
      prisma.invoice.count({ where }),
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
    console.error('Invoices GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER', 'PROCUREMENT', 'OPERATIONS'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validation = createInvoiceSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const data = validation.data

    // Check for duplicate invoices (bypass with ?force=true)
    const url = new URL(request.url)
    const force = url.searchParams.get('force') === 'true'

    if (!force) {
      const potentialDuplicate = await prisma.invoice.findFirst({
        where: {
          vendorName: data.vendorName,
          totalAmount: {
            gte: data.totalAmount * 0.99,
            lte: data.totalAmount * 1.01,
          },
          receivedAt: {
            gte: new Date(new Date(data.receivedAt || Date.now()).getTime() - 3 * 24 * 60 * 60 * 1000),
            lte: new Date(new Date(data.receivedAt || Date.now()).getTime() + 3 * 24 * 60 * 60 * 1000),
          },
        },
      })

      if (potentialDuplicate) {
        return NextResponse.json(
          {
            error: 'Potential duplicate invoice detected',
            existingInvoice: { id: potentialDuplicate.id, invoiceNumber: potentialDuplicate.invoiceNumber },
            message: 'An invoice from the same vendor with a similar amount was found within 3 days. Add ?force=true to override.',
          },
          { status: 409 }
        )
      }
    }

    // Verify PO exists if provided
    if (data.purchaseOrderId) {
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: data.purchaseOrderId },
      })
      if (!po) {
        return NextResponse.json(
          { success: false, error: 'Purchase order not found' },
          { status: 404 }
        )
      }
    }

    const invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          invoiceNumber: data.invoiceNumber,
          vendorName: data.vendorName,
          totalAmount: data.totalAmount,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          fileUrl: data.fileUrl || null,
          purchaseOrderId: data.purchaseOrderId || null,
          notes: data.notes || null,
        },
      })

      // Create line items (recalculate totalPrice server-side)
      await Promise.all(
        data.lineItems.map((item) => {
          const calculatedTotal = item.quantity * item.unitPrice
          return tx.invoiceLineItem.create({
            data: {
              invoiceId: created.id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: calculatedTotal,
            },
          })
        })
      )

      return tx.invoice.findUnique({
        where: { id: created.id },
        include: {
          lineItems: true,
          purchaseOrder: {
            select: {
              id: true,
              poNumber: true,
              client: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      })
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'invoice',
        entityId: invoice!.id,
        action: 'created',
        details: JSON.stringify({
          invoiceNumber: data.invoiceNumber,
          vendorName: data.vendorName,
          totalAmount: data.totalAmount,
          lineItemCount: data.lineItems.length,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: invoice,
      message: 'Invoice created successfully',
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A record with this identifier already exists' },
        { status: 409 }
      )
    }
    console.error('Invoices POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
