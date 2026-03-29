import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createQuoteSchema, updateQuoteSchema } from '@/lib/validations'
import { generateQuoteNumber } from '@/lib/utils'
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
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortDirection = (searchParams.get('sortDirection') || 'desc') as 'asc' | 'desc'
    const status = searchParams.get('status')
    const clientId = searchParams.get('clientId')

    const skip = (page - 1) * pageSize

    const where: Prisma.QuoteWhereInput = {}

    if (query) {
      where.OR = [
        { quoteNumber: { contains: query } },
        { client: { name: { contains: query } } },
        { request: { subject: { contains: query } } },
      ]
    }

    if (status) {
      where.status = status
    }

    if (clientId) {
      where.clientId = clientId
    }

    const [quotes, total] = await Promise.all([
      prisma.quote.findMany({
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
          request: {
            select: {
              id: true,
              subject: true,
              priority: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          lineItems: true,
          _count: {
            select: {
              lineItems: true,
            },
          },
        },
      }),
      prisma.quote.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        items: quotes,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Quotes GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN', 'MANAGER', 'SALES'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validation = createQuoteSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const data = validation.data

    // Verify request exists and belongs to client
    const requestRecord = await prisma.request.findUnique({
      where: { id: data.requestId },
      include: { client: true },
    })

    if (!requestRecord) {
      return NextResponse.json(
        { success: false, error: 'Request not found' },
        { status: 404 }
      )
    }

    if (requestRecord.clientId !== data.clientId) {
      return NextResponse.json(
        { success: false, error: 'Request does not belong to specified client' },
        { status: 400 }
      )
    }

    // Calculate total amount
    const totalAmount = data.lineItems.reduce(
      (sum, item) => sum + (item.unitPrice * item.quantity),
      0
    )

    // Create quote with line items in a transaction
    const quote = await prisma.$transaction(async (tx) => {
      const newQuote = await tx.quote.create({
        data: {
          requestId: data.requestId,
          clientId: data.clientId,
          createdById: session.user.id,
          quoteNumber: generateQuoteNumber(),
          totalAmount,
          validUntil: data.validUntil ? new Date(data.validUntil) : null,
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          request: {
            select: {
              id: true,
              subject: true,
              priority: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })

      // Create line items
      const lineItems = await Promise.all(
        data.lineItems.map((item) =>
          tx.quoteLineItem.create({
            data: {
              quoteId: newQuote.id,
              productName: item.productName,
              description: item.description,
              specifications: item.specifications ? JSON.stringify(item.specifications) : null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.unitPrice * item.quantity,
              sourceUrl: item.sourceUrl,
              vendorName: item.vendorName,
            },
          })
        )
      )

      // Update request status
      await tx.request.update({
        where: { id: data.requestId },
        data: { status: 'QUOTED' },
      })

      return {
        ...newQuote,
        lineItems,
      }
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'quote',
        entityId: quote.id,
        action: 'created',
        details: JSON.stringify({
          quoteNumber: quote.quoteNumber,
          clientName: quote.client.name,
          totalAmount: quote.totalAmount,
          lineItemCount: data.lineItems.length,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: quote,
      message: 'Quote created successfully',
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A record with this identifier already exists' },
        { status: 409 }
      )
    }
    console.error('Quotes POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
