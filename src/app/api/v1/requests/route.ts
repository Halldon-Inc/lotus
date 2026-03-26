import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createRequestSchema } from '@/lib/validations'

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
    const status = searchParams.get('status')

    const skip = (page - 1) * pageSize

    let where: any = {}

    if (query) {
      where.OR = [
        { subject: { contains: query, mode: 'insensitive' as const } },
        { description: { contains: query, mode: 'insensitive' as const } },
        { client: { name: { contains: query, mode: 'insensitive' as const } } },
      ]
    }

    if (status) {
      where.status = status
    }

    // Role-based filtering
    if (session.user.role === 'SALES') {
      where.OR = [
        { assignedToId: session.user.id },
        { createdById: session.user.id },
        ...(where.OR || [])
      ]
    }

    const [requests, total] = await Promise.all([
      prisma.request.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortBy]: sortDirection },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          quotes: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      }),
      prisma.request.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        items: requests,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Requests GET error:', error)
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
    const validation = createRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const data = validation.data

    // Auto-assign to the least busy rep if no assignment specified
    let assignedToId = data.assignedToId
    
    if (!assignedToId && session.user.role !== 'SALES') {
      const salesReps = await prisma.user.findMany({
        where: { role: 'SALES', isActive: true },
        include: {
          _count: {
            select: {
              assignedRequests: {
                where: {
                  status: { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS'] }
                }
              }
            }
          }
        }
      })

      if (salesReps.length > 0) {
        // Find rep with least open requests
        const leastBusyRep = salesReps.reduce((prev, current) => 
          prev._count.assignedRequests < current._count.assignedRequests ? prev : current
        )
        assignedToId = leastBusyRep.id
      }
    } else if (session.user.role === 'SALES') {
      // Sales reps create requests assigned to themselves
      assignedToId = session.user.id
    }

    const newRequest = await prisma.request.create({
      data: {
        clientId: data.clientId,
        assignedToId,
        createdById: session.user.id,
        subject: data.subject,
        description: data.description,
        priority: data.priority,
        status: assignedToId ? 'ASSIGNED' : 'NEW',
        source: 'MANUAL',
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdBy: {
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
        entityType: 'request',
        entityId: newRequest.id,
        action: 'created',
        details: JSON.stringify({
          subject: newRequest.subject,
          clientName: newRequest.client.name,
          priority: newRequest.priority,
          assignedTo: newRequest.assignedTo?.name,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: newRequest,
      message: 'Request created successfully',
    })
  } catch (error) {
    console.error('Requests POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
