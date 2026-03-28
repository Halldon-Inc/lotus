import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getDeals, getAllPaginated } from '@/lib/hubspot'

interface ImportResult {
  imported: number
  skipped: number
  errors: Array<{ hubspotId: string; name: string; error: string }>
}

const CLOSED_STAGES = ['closedwon', 'closedlost', 'closed won', 'closed lost']

function isClosed(stage?: string): boolean {
  if (!stage) return false
  return CLOSED_STAGES.includes(stage.toLowerCase().replace(/[_\s-]/g, ''))
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

    const allDeals = await getAllPaginated(getDeals)

    // Filter out closed deals
    const openDeals = allDeals.filter(deal => !isClosed(deal.properties.dealstage))

    if (!openDeals.length) {
      return NextResponse.json({
        success: true,
        data: { imported: 0, skipped: 0, errors: [] },
        message: 'No open deals found in HubSpot',
      })
    }

    const result: ImportResult = { imported: 0, skipped: 0, errors: [] }

    for (const deal of openDeals) {
      const props = deal.properties
      const dealName = props.dealname || 'Untitled Deal'
      const hubspotDealTag = `[HubSpot Deal #${deal.id}]`

      try {
        // Check if a request already exists for this deal (by searching description for the tag)
        const existingRequest = await prisma.request.findFirst({
          where: {
            description: { contains: hubspotDealTag },
          },
        })

        if (existingRequest) {
          result.skipped++
          continue
        }

        // Try to find a linked client via company association
        let clientId: string | null = null
        const companyAssociations = deal.associations?.companies?.results
        if (companyAssociations?.length) {
          const companyHubspotId = companyAssociations[0].id
          const client = await prisma.client.findFirst({
            where: { hubspotId: companyHubspotId },
          })
          if (client) {
            clientId = client.id
          }
        }

        // If no associated client found, try to find or create a generic one
        if (!clientId) {
          let genericClient = await prisma.client.findFirst({
            where: { name: 'HubSpot Imports' },
          })
          if (!genericClient) {
            genericClient = await prisma.client.create({
              data: {
                name: 'HubSpot Imports',
                type: 'CORPORATE',
              },
            })
          }
          clientId = genericClient.id
        }

        // Build description with deal details
        const descriptionParts = [hubspotDealTag]
        if (props.amount) {
          descriptionParts.push(`Amount: $${Number(props.amount).toLocaleString()}`)
        }
        if (props.dealstage) {
          descriptionParts.push(`Stage: ${props.dealstage}`)
        }
        if (props.closedate) {
          descriptionParts.push(`Close date: ${props.closedate}`)
        }
        if (props.pipeline) {
          descriptionParts.push(`Pipeline: ${props.pipeline}`)
        }

        await prisma.request.create({
          data: {
            clientId,
            createdById: session.user.id,
            subject: dealName,
            description: descriptionParts.join('\n'),
            source: 'HUBSPOT',
            priority: 'MEDIUM',
            status: 'NEW',
          },
        })

        result.imported++
      } catch (error) {
        result.errors.push({
          hubspotId: deal.id,
          name: dealName,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'hubspot_import',
        entityId: 'deals',
        action: 'imported',
        details: JSON.stringify({
          source: 'hubspot_deals',
          imported: result.imported,
          skipped: result.skipped,
          errorCount: result.errors.length,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: result,
      message: `Imported ${result.imported} deals as requests`,
    })
  } catch (error) {
    console.error('HubSpot deal import error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
