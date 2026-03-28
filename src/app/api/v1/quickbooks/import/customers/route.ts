import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getQuickBooksClient } from '@/lib/quickbooks'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const qb = await getQuickBooksClient()

    const customers = await qb.getAllPaginated(
      (limit, offset) => qb.getCustomers(limit, offset)
    )

    let imported = 0
    let updated = 0
    let skipped = 0
    const errors: string[] = []

    for (const customer of customers) {
      try {
        if (!customer.Id) {
          skipped++
          continue
        }

        // Check if a Lotus Client already exists with matching quickbooksId or name
        const existingByQbId = customer.Id
          ? await prisma.client.findFirst({
              where: { quickbooksId: customer.Id },
            })
          : null

        const existingByName = !existingByQbId
          ? await prisma.client.findFirst({
              where: { name: customer.DisplayName },
            })
          : null

        const existing = existingByQbId || existingByName

        if (existing) {
          // Update: don't overwrite non-empty Lotus fields
          const updateData: Record<string, string> = {}

          if (!existing.contactEmail && customer.PrimaryEmailAddr?.Address) {
            updateData.contactEmail = customer.PrimaryEmailAddr.Address
          }
          if (!existing.contactPhone && customer.PrimaryPhone?.FreeFormNumber) {
            updateData.contactPhone = customer.PrimaryPhone.FreeFormNumber
          }
          if (!existing.address && customer.BillAddr?.Line1) {
            updateData.address = customer.BillAddr.Line1
          }
          if (!existing.city && customer.BillAddr?.City) {
            updateData.city = customer.BillAddr.City
          }
          if (!existing.state && customer.BillAddr?.CountrySubDivisionCode) {
            updateData.state = customer.BillAddr.CountrySubDivisionCode
          }
          if (!existing.zip && customer.BillAddr?.PostalCode) {
            updateData.zip = customer.BillAddr.PostalCode
          }
          if (!existing.quickbooksId) {
            updateData.quickbooksId = customer.Id
          }

          if (Object.keys(updateData).length > 0) {
            await prisma.client.update({
              where: { id: existing.id },
              data: updateData,
            })
            updated++
          } else {
            skipped++
          }
        } else {
          // Create new Client from QB customer
          await prisma.client.create({
            data: {
              name: customer.DisplayName,
              type: 'CORPORATE',
              contactEmail: customer.PrimaryEmailAddr?.Address || null,
              contactPhone: customer.PrimaryPhone?.FreeFormNumber || null,
              address: customer.BillAddr?.Line1 || null,
              city: customer.BillAddr?.City || null,
              state: customer.BillAddr?.CountrySubDivisionCode || null,
              zip: customer.BillAddr?.PostalCode || null,
              quickbooksId: customer.Id,
            },
          })
          imported++
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        errors.push(`Customer "${customer.DisplayName}": ${message}`)
      }
    }

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'quickbooks',
        entityId: 'import_customers',
        action: 'import_customers',
        details: JSON.stringify({ imported, updated, skipped, errors }),
      },
    })

    return NextResponse.json({
      success: true,
      data: { imported, updated, skipped, errors },
    })
  } catch (error) {
    console.error('QuickBooks customer import error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to import customers from QuickBooks' },
      { status: 500 }
    )
  }
}
