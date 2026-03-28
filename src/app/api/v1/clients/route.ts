import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createClientSchema, paginationSchema } from '@/lib/validations'
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
    const query = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortDirection = (searchParams.get('sortDirection') || 'desc') as 'asc' | 'desc'

    const skip = (page - 1) * pageSize

    const where = query
      ? {
          OR: [
            { name: { contains: query } },
            { contactName: { contains: query } },
            { contactEmail: { contains: query } },
          ],
        }
      : {}

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortBy]: sortDirection },
        include: {
          assignedRep: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              requests: true,
              quotes: true,
              purchaseOrders: true,
            },
          },
        },
      }),
      prisma.client.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        items: clients,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Clients GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN', 'MANAGER', 'SALES'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validation = createClientSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const data = validation.data
    const clientData: Prisma.ClientUncheckedCreateInput = {
      name: data.name,
      type: data.type,
      address: data.address,
      city: data.city,
      state: data.state,
      zip: data.zip,
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      spendingLimit: data.spendingLimit,
      assignedRepId: data.assignedRepId,
    }

    if (data.fiscalYearStart) {
      clientData.fiscalYearStart = new Date(data.fiscalYearStart)
    }

    const client = await prisma.client.create({
      data: clientData,
      include: {
        assignedRep: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'client',
        entityId: client.id,
        action: 'created',
        details: JSON.stringify({
          clientName: client.name,
          type: client.type,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: client,
      message: 'Client created successfully',
    })
  } catch (error) {
    console.error('Clients POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
