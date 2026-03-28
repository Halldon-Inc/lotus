import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseCSV } from '@/lib/csv-parser'

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
    const { content, fileName } = body as { content: string; fileName: string }

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { success: false, error: 'CSV content is required' },
        { status: 400 }
      )
    }

    if (!fileName || typeof fileName !== 'string') {
      return NextResponse.json(
        { success: false, error: 'File name is required' },
        { status: 400 }
      )
    }

    const parsed = parseCSV(content)

    if (parsed.headers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'CSV file is empty or has no headers' },
        { status: 400 }
      )
    }

    if (parsed.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'CSV file has headers but no data rows' },
        { status: 400 }
      )
    }

    const importSession = await prisma.importSession.create({
      data: {
        userId: session.user.id,
        fileName,
        headers: JSON.stringify(parsed.headers),
        data: JSON.stringify(parsed.rows),
        status: 'PENDING',
      },
    })

    const sampleRows = parsed.rows.slice(0, 5)

    return NextResponse.json({
      success: true,
      data: {
        sessionId: importSession.id,
        headers: parsed.headers,
        sampleRows,
        totalRows: parsed.rowCount,
      },
    })
  } catch (error) {
    console.error('Import upload error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
