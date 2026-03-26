import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { updateQuoteSchema } from '@/lib/validations'

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

    const quote = await prisma.quote.findUnique({
      where: { id },
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
        request: {
          select: {
            id: true,
            subject: true,
            description: true,
            priority: true,
            status: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        lineItems: {
          orderBy: { createdAt: 'asc' },
        },
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            status: true,
          },
        },
      },
    })

    if (!quote) {
      return NextResponse.json(
        { success: false, error: 'Quote not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: quote,
    })
  } catch (error) {
    console.error('Quote GET error:', error)
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
    
    if (!session || !['ADMIN', 'MANAGER', 'SALES'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validation = updateQuoteSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const data = validation.data

    // Check if quote exists
    const existingQuote = await prisma.quote.findUnique({
      where: { id },
    })

    if (!existingQuote) {
      return NextResponse.json(
        { success: false, error: 'Quote not found' },
        { status: 404 }
      )
    }

    // Update quote and line items in a transaction
    const quote = await prisma.$transaction(async (tx) => {
      // Update quote
      const updatedQuote = await tx.quote.update({
        where: { id },
        data: {
          status: data.status,
          validUntil: data.validUntil ? new Date(data.validUntil) : existingQuote.validUntil,
          sentAt: data.status === 'SENT' && existingQuote.status !== 'SENT' ? new Date() : existingQuote.sentAt,
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              type: true,
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

      // Update line items if provided
      if (data.lineItems) {
        // Delete existing line items
        await tx.quoteLineItem.deleteMany({
          where: { quoteId: id },
        })

        // Create new line items
        const lineItems = await Promise.all(
          data.lineItems.map((item) =>
            tx.quoteLineItem.create({
              data: {
                quoteId: id,
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

        // Update total amount
        const totalAmount = data.lineItems.reduce(
          (sum, item) => sum + (item.unitPrice * item.quantity),
          0
        )

        await tx.quote.update({
          where: { id },
          data: { totalAmount },
        })

        return {
          ...updatedQuote,
          lineItems,
          totalAmount,
        }
      }

      return updatedQuote
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'quote',
        entityId: quote.id,
        action: 'updated',
        details: JSON.stringify({
          quoteNumber: quote.quoteNumber || existingQuote.quoteNumber,
          changes: Object.keys(data),
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: quote,
      message: 'Quote updated successfully',
    })
  } catch (error) {
    console.error('Quote PATCH error:', error)
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

    // Check if quote exists and is not linked to a purchase order
    const quote = await prisma.quote.findUnique({
      where: { id },
      include: {
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
        { success: false, error: 'Cannot delete quote with associated purchase order' },
        { status: 400 }
      )
    }

    // Delete quote (line items will be cascade deleted)
    await prisma.quote.delete({
      where: { id },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'quote',
        entityId: id,
        action: 'deleted',
        details: JSON.stringify({
          quoteNumber: quote.quoteNumber,
          totalAmount: quote.totalAmount,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Quote deleted successfully',
    })
  } catch (error) {
    console.error('Quote DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
