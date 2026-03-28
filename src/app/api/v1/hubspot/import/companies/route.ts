import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getCompanies, getAllPaginated } from '@/lib/hubspot'
import type { HubSpotCompany } from '@/lib/hubspot'

interface ImportResult {
  imported: number
  updated: number
  skipped: number
  errors: Array<{ hubspotId: string; name: string; error: string }>
}

const INDUSTRY_TYPE_MAP: Record<string, string> = {
  education: 'SCHOOL',
  'higher education': 'SCHOOL',
  government: 'GOVERNMENT',
  'government administration': 'GOVERNMENT',
  'government relations': 'GOVERNMENT',
  hospital: 'HEALTHCARE',
  'health care': 'HEALTHCARE',
  healthcare: 'HEALTHCARE',
  'medical practice': 'HEALTHCARE',
  'hospital & health care': 'HEALTHCARE',
  'non-profit': 'NONPROFIT',
  nonprofit: 'NONPROFIT',
  'non-profit organization management': 'NONPROFIT',
  philanthropy: 'NONPROFIT',
}

function mapIndustryToType(industry?: string): string {
  if (!industry) return 'CORPORATE'
  const normalized = industry.toLowerCase().trim()
  return INDUSTRY_TYPE_MAP[normalized] || 'CORPORATE'
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

    const companies = await getAllPaginated<HubSpotCompany>(getCompanies)

    if (!companies.length) {
      return NextResponse.json({
        success: true,
        data: { imported: 0, updated: 0, skipped: 0, errors: [] },
        message: 'No companies found in HubSpot',
      })
    }

    const result: ImportResult = { imported: 0, updated: 0, skipped: 0, errors: [] }

    for (const company of companies) {
      const props = company.properties
      const companyName = props.name || 'Unnamed Company'

      try {
        // Skip companies with no name
        if (!props.name) {
          result.skipped++
          continue
        }

        // Check for existing client by hubspotId or exact name match
        let existing = await prisma.client.findFirst({
          where: {
            OR: [
              { hubspotId: company.id },
              { name: props.name },
            ],
          },
        })

        if (existing) {
          // Update: merge new data without overwriting non-empty fields
          await prisma.client.update({
            where: { id: existing.id },
            data: {
              hubspotId: company.id,
              name: existing.name || companyName,
              contactPhone: existing.contactPhone || props.phone,
              address: existing.address || props.address,
              city: existing.city || props.city,
              state: existing.state || props.state,
              zip: existing.zip || props.zip,
              type: existing.type || mapIndustryToType(props.industry),
            },
          })
          result.updated++
        } else {
          // Create new client from company
          await prisma.client.create({
            data: {
              hubspotId: company.id,
              name: companyName,
              type: mapIndustryToType(props.industry),
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
          hubspotId: company.id,
          name: companyName,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'hubspot_import',
        entityId: 'companies',
        action: 'imported',
        details: JSON.stringify({
          source: 'hubspot_companies',
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
      message: `Imported ${result.imported} companies, updated ${result.updated}`,
    })
  } catch (error) {
    console.error('HubSpot company import error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
