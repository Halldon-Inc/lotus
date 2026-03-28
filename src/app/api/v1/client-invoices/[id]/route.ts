import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { updateClientInvoiceSchema } from '@/lib/validations'
import { sendEmail } from '@/lib/email'
import { invoiceSent, paymentReceived } from '@/lib/email-templates'
import { searchDeals, updateDealStage, createEngagementNote } from '@/lib/hubspot'

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

    const clientInvoice = await prisma.clientInvoice.findUnique({
      where: { id },
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
        purchaseOrder: {
          include: {
            quote: {
              include: {
                lineItems: true,
                request: {
                  select: {
                    id: true,
                    subject: true,
                  },
                },
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
                    totalPrice: true,
                  },
                },
              },
            },
            shipments: {
              select: {
                id: true,
                status: true,
                carrierName: true,
                trackingNumber: true,
                deliveredAt: true,
                podStatus: true,
              },
            },
          },
        },
      },
    })

    if (!clientInvoice) {
      return NextResponse.json(
        { success: false, error: 'Client invoice not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: clientInvoice,
    })
  } catch (error) {
    console.error('Client invoice GET error:', error)
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
    const validation = updateClientInvoiceSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const existing = await prisma.clientInvoice.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Client invoice not found' },
        { status: 404 }
      )
    }

    const data = validation.data

    const updateData: Record<string, unknown> = {}
    if (data.status !== undefined) updateData.status = data.status
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.podVerified !== undefined) updateData.podVerified = data.podVerified

    // Auto-set timestamps
    if (data.status === 'SENT' && existing.status !== 'SENT') {
      updateData.sentAt = new Date()
    }
    if (data.status === 'PAID' && existing.status !== 'PAID') {
      updateData.paidAt = new Date()
    }

    const clientInvoice = await prisma.clientInvoice.update({
      where: { id },
      data: updateData,
      include: {
        client: {
          select: { id: true, name: true, hubspotId: true },
        },
        purchaseOrder: {
          select: { id: true, poNumber: true },
        },
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'clientInvoice',
        entityId: clientInvoice.id,
        action: data.status && data.status !== existing.status ? 'status_changed' : 'updated',
        details: JSON.stringify({
          invoiceNumber: clientInvoice.invoiceNumber,
          changes: Object.keys(data),
          ...(data.status ? { previousStatus: existing.status, newStatus: data.status } : {}),
        }),
      },
    })

    // Email: SENT notifies client contact
    if (data.status === 'SENT' && existing.status !== 'SENT') {
      try {
        const fullInvoice = await prisma.clientInvoice.findUnique({
          where: { id },
          select: {
            totalAmount: true,
            dueDate: true,
            client: { select: { contactEmail: true, contactName: true, name: true } },
          },
        })
        const clientEmail = fullInvoice?.client?.contactEmail
        if (clientEmail) {
          const clientName = fullInvoice.client.contactName || fullInvoice.client.name
          const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
            fullInvoice.totalAmount
          )
          const dueDate = fullInvoice.dueDate
            ? new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(
                new Date(fullInvoice.dueDate)
              )
            : 'Upon receipt'
          const template = invoiceSent(clientName, clientInvoice.invoiceNumber, amount, dueDate)
          await sendEmail(clientEmail, template.subject, template.html)
        }
      } catch (emailError) {
        console.error('Failed to send invoice SENT email:', emailError)
      }
    }

    // Email: PAID confirms payment to client
    if (data.status === 'PAID' && existing.status !== 'PAID') {
      try {
        const fullInvoice = await prisma.clientInvoice.findUnique({
          where: { id },
          select: {
            totalAmount: true,
            client: { select: { contactEmail: true, contactName: true, name: true } },
          },
        })
        const clientEmail = fullInvoice?.client?.contactEmail
        if (clientEmail) {
          const clientName = fullInvoice.client.contactName || fullInvoice.client.name
          const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
            fullInvoice.totalAmount
          )
          const template = paymentReceived(clientName, clientInvoice.invoiceNumber, amount)
          await sendEmail(clientEmail, template.subject, template.html)
        }
      } catch (emailError) {
        console.error('Failed to send payment PAID email:', emailError)
      }
    }

    // HubSpot sync
    try {
      if (data.status === 'PAID' && existing.status !== 'PAID') {
        const hubspotId = clientInvoice.client.hubspotId
        if (hubspotId) {
          const deals = await searchDeals('hs_object_id', hubspotId)
          if (deals.length > 0) {
            await updateDealStage(deals[0].id, 'closedWon')
            await createEngagementNote(
              deals[0].id,
              `Invoice ${clientInvoice.invoiceNumber} paid in full`
            )
          }
        }
      }
    } catch (hubspotError) {
      console.error('HubSpot sync error (invoice paid):', hubspotError)
    }

    return NextResponse.json({
      success: true,
      data: clientInvoice,
      message: 'Client invoice updated successfully',
    })
  } catch (error) {
    console.error('Client invoice PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
