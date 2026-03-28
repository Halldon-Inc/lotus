import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getContacts, getAllPaginated } from '@/lib/hubspot'
import type { HubSpotContact } from '@/lib/hubspot'

interface ImportResult {
  imported: number
  updated: number
  skipped: number
  errors: Array<{ hubspotId: string; name: string; error: string }>
}

function buildContactName(props: HubSpotContact['properties']): string {
  const parts = [props.firstname, props.lastname].filter(Boolean)
  return parts.join(' ') || 'Unknown Contact'
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const contacts = await getAllPaginated<HubSpotContact>(getContacts)

    if (!contacts.length) {
      return NextResponse.json({
        success: true,
        data: { imported: 0, updated: 0, skipped: 0, errors: [] },
        message: 'No contacts found in HubSpot',
      })
    }

    const result: ImportResult = { imported: 0, updated: 0, skipped: 0, errors: [] }

    for (const contact of contacts) {
      const props = contact.properties
      const contactName = buildContactName(props)

      try {
        // Skip contacts with no useful data
        if (!props.email && !props.firstname && !props.lastname && !props.company) {
          result.skipped++
          continue
        }

        // Check for existing client by hubspotId or contactEmail
        let existing = await prisma.client.findFirst({
          where: {
            OR: [
              { hubspotId: contact.id },
              ...(props.email ? [{ contactEmail: props.email }] : []),
            ],
          },
        })

        if (existing) {
          // Update: merge new data without overwriting non-empty fields
          await prisma.client.update({
            where: { id: existing.id },
            data: {
              hubspotId: contact.id,
              contactName: existing.contactName || contactName,
              contactEmail: existing.contactEmail || props.email,
              contactPhone: existing.contactPhone || props.phone,
              name: existing.name || props.company || contactName,
              address: existing.address || props.address,
              city: existing.city || props.city,
              state: existing.state || props.state,
              zip: existing.zip || props.zip,
            },
          })
          result.updated++
        } else {
          // Create new client from contact
          await prisma.client.create({
            data: {
              hubspotId: contact.id,
              name: props.company || contactName,
              type: 'CORPORATE',
              contactName,
              contactEmail: props.email,
              contactPhone: props.phone,
              address: props.address,
              city: props.city,
              state: props.state,
              zip: props.zip,
            },
          })
          result.imported++
        }
      } catch (error) {
        result.errors.push({
          hubspotId: contact.id,
          name: contactName,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'hubspot_import',
        entityId: 'contacts',
        action: 'imported',
        details: JSON.stringify({
          source: 'hubspot_contacts',
          imported: result.imported,
          updated: result.updated,
          skipped: result.skipped,
          errorCount: result.errors.length,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: result,
      message: `Imported ${result.imported} contacts, updated ${result.updated}`,
    })
  } catch (error) {
    console.error('HubSpot contact import error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
