import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { updateInvoiceSchema } from '@/lib/validations'

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

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        lineItems: {
          orderBy: { id: 'asc' },
        },
        purchaseOrder: {
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
            items: {
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
        matchRecords: {
          orderBy: { createdAt: 'desc' },
          include: {
            purchaseOrder: {
              select: {
                id: true,
                poNumber: true,
                totalAmount: true,
              },
            },
          },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: invoice,
    })
  } catch (error) {
    console.error('Invoice GET error:', error)
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

    if (!session || !['ADMIN', 'MANAGER', 'PROCUREMENT', 'OPERATIONS'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validation = updateInvoiceSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
    })

    if (!existingInvoice) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 }
      )
    }

    const data = validation.data

    const updateData: Record<string, unknown> = {}
    if (data.status !== undefined) updateData.status = data.status
    if (data.vendorName !== undefined) updateData.vendorName = data.vendorName
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null
    if (data.fileUrl !== undefined) updateData.fileUrl = data.fileUrl || null
    if (data.purchaseOrderId !== undefined) updateData.purchaseOrderId = data.purchaseOrderId || null
    if (data.notes !== undefined) updateData.notes = data.notes || null

    const invoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
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
        matchRecords: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'invoice',
        entityId: invoice.id,
        action: data.status && data.status !== existingInvoice.status ? 'status_changed' : 'updated',
        details: JSON.stringify({
          invoiceNumber: invoice.invoiceNumber,
          changes: Object.keys(data),
          ...(data.status && data.status !== existingInvoice.status
            ? { previousStatus: existingInvoice.status, newStatus: data.status }
            : {}),
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: invoice,
      message: 'Invoice updated successfully',
    })
  } catch (error) {
    console.error('Invoice PUT error:', error)
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

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        matchRecords: true,
      },
    })

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 }
      )
    }

    if (invoice.status === 'PAID') {
      return NextResponse.json(
        { success: false, error: 'Cannot delete a paid invoice' },
        { status: 400 }
      )
    }

    // Delete match records first, then invoice (line items cascade)
    await prisma.$transaction([
      prisma.matchRecord.deleteMany({
        where: { invoiceId: id },
      }),
      prisma.invoice.delete({
        where: { id },
      }),
    ])

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'invoice',
        entityId: id,
        action: 'deleted',
        details: JSON.stringify({
          invoiceNumber: invoice.invoiceNumber,
          vendorName: invoice.vendorName,
          totalAmount: invoice.totalAmount,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Invoice deleted successfully',
    })
  } catch (error) {
    console.error('Invoice DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
