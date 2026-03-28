import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTemplateCSV, getEntityTypes } from '@/lib/import-mapper'

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
    const entity = searchParams.get('entity')

    if (!entity) {
      return NextResponse.json({
        success: true,
        data: {
          availableEntities: getEntityTypes(),
        },
      })
    }

    try {
      const csv = getTemplateCSV(entity)
      return NextResponse.json({
        success: true,
        data: {
          entity,
          template: csv,
        },
      })
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: `Unknown entity type: ${entity}. Available: ${getEntityTypes().join(', ')}`,
        },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Import templates error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
