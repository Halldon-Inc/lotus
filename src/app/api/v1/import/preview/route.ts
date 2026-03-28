import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { applyMapping, validateRow, getFieldsForEntity } from '@/lib/import-mapper'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: ADMIN or MANAGER role required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { sessionId, entityType, columnMapping } = body as {
      sessionId: string
      entityType: string
      columnMapping: Record<string, string>
    }

    if (!sessionId || !entityType || !columnMapping) {
      return NextResponse.json(
        { success: false, error: 'sessionId, entityType, and columnMapping are required' },
        { status: 400 }
      )
    }

    // Validate entity type
    try {
      getFieldsForEntity(entityType)
    } catch {
      return NextResponse.json(
        { success: false, error: `Invalid entity type: ${entityType}` },
        { status: 400 }
      )
    }

    const importSession = await prisma.importSession.findUnique({
      where: { id: sessionId },
    })

    if (!importSession) {
      return NextResponse.json(
        { success: false, error: 'Import session not found' },
        { status: 404 }
      )
    }

    if (importSession.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'You do not own this import session' },
        { status: 403 }
      )
    }

    const rows = JSON.parse(importSession.data) as Record<string, string>[]

    const validRows: Array<{ rowIndex: number; data: Record<string, string> }> = []
    const invalidRows: Array<{
      rowIndex: number
      data: Record<string, string>
      errors: Array<{ field: string; message: string }>
    }> = []

    for (let i = 0; i < rows.length; i++) {
      const mapped = applyMapping(rows[i], columnMapping)
      const errors = validateRow(entityType, mapped)

      if (errors.length === 0) {
        validRows.push({ rowIndex: i + 1, data: mapped })
      } else {
        invalidRows.push({ rowIndex: i + 1, data: mapped, errors })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        validRows: validRows.slice(0, 10),
        invalidRows: invalidRows.slice(0, 10),
        totalValid: validRows.length,
        totalInvalid: invalidRows.length,
      },
    })
  } catch (error) {
    console.error('Import preview error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
