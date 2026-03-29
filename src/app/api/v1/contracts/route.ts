import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

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
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const status = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''
    const sortBy = searchParams.get('sortBy') || 'endDate'
    const sortDirection = (searchParams.get('sortDirection') || 'asc') as 'asc' | 'desc'

    const skip = (page - 1) * pageSize

    const where: Record<string, unknown> = {}
    if (status) {
      where.status = status
    }
    if (search) {
      where.OR = [
        { contractNumber: { contains: search } },
        { title: { contains: search } },
        { vendor: { contains: search } },
      ]
    }

    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortBy]: sortDirection },
        include: {
          client: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.contract.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        items: contracts,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Contracts GET error:', error)
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

    const { contractNumber, clientId, title, startDate, endDate, vendor, totalValue, terms, notes } = body

    if (!contractNumber || !clientId || !title || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: contractNumber, clientId, title, startDate, endDate' },
        { status: 400 }
      )
    }

    const contract = await prisma.contract.create({
      data: {
        contractNumber,
        clientId,
        title,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        vendor: vendor || null,
        totalValue: totalValue || null,
        terms: terms || null,
        notes: notes || null,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'contract',
        entityId: contract.id,
        action: 'created',
        details: JSON.stringify({
          contractNumber: contract.contractNumber,
          title: contract.title,
          clientId: contract.clientId,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: contract,
      message: 'Contract created successfully',
    })
  } catch (error) {
    console.error('Contracts POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
