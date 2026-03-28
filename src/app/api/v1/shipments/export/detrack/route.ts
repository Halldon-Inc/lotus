import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface ShipmentWithPO {
  id: string
  purchaseOrderId: string
  method: string
  scheduledDate: Date | null
  notes: string | null
  purchaseOrder: {
    id: string
    poNumber: string
    client: {
      id: string
      name: string
      contactName: string | null
      contactEmail: string | null
      contactPhone: string | null
      address: string | null
      city: string | null
      state: string | null
      zip: string | null
      shippingAddress: string | null
      shippingCity: string | null
      shippingState: string | null
      shippingZip: string | null
    }
  }
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function formatCsvDate(date: Date | null): string {
  if (!date) return ''
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER', 'OPERATIONS'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const shipments = await prisma.shipment.findMany({
      where: {
        method: 'MANUAL',
        status: { in: ['PREPARING', 'READY'] },
      },
      include: {
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            client: {
              select: {
                id: true,
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
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }) as ShipmentWithPO[]

    const headers = ['Name', 'Address', 'City', 'State', 'Zip', 'Phone', 'Email', 'Instructions', 'Date']
    const headerRow = headers.join(',')

    const rows = shipments.map((shipment) => {
      const client = shipment.purchaseOrder.client

      const name = client.contactName || client.name || ''
      const address = client.shippingAddress || client.address || ''
      const city = client.shippingCity || client.city || ''
      const state = client.shippingState || client.state || ''
      const zip = client.shippingZip || client.zip || ''
      const phone = client.contactPhone || ''
      const email = client.contactEmail || ''
      const instructions = shipment.notes || ''
      const date = formatCsvDate(shipment.scheduledDate)

      return [name, address, city, state, zip, phone, email, instructions, date]
        .map(escapeCsvField)
        .join(',')
    })

    const csv = [headerRow, ...rows].join('\r\n')

    const today = new Date()
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=detrack-upload-${dateStr}.csv`,
      },
    })
  } catch (error) {
    console.error('Detrack export error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
