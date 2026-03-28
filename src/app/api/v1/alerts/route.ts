import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAlertSchema } from '@/lib/validations'
import type { Prisma } from '@prisma/client'

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
    const isRead = searchParams.get('isRead')
    const type = searchParams.get('type')
    const severity = searchParams.get('severity')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')

    const skip = (page - 1) * pageSize

    const where: Prisma.AlertWhereInput = {
      userId: session.user.id,
    }

    if (isRead !== null) {
      where.isRead = isRead === 'true'
    }

    if (type) {
      where.type = type
    }

    if (severity) {
      where.severity = severity
    }

    const [alerts, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [
          { isRead: 'asc' },
          { severity: 'desc' },
          { createdAt: 'desc' },
        ],
      }),
      prisma.alert.count({ where }),
    ])

    // Get unread count
    const unreadCount = await prisma.alert.count({
      where: {
        userId: session.user.id,
        isRead: false,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        items: alerts,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        unreadCount,
      },
    })
  } catch (error) {
    console.error('Alerts GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validation = createAlertSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const data = validation.data

    const alert = await prisma.alert.create({
      data,
    })

    return NextResponse.json({
      success: true,
      data: alert,
      message: 'Alert created successfully',
    })
  } catch (error) {
    console.error('Alerts POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
