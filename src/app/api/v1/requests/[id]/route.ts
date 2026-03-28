import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { updateRequestSchema } from '@/lib/validations'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const requestRecord = await prisma.request.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            type: true,
            contactName: true,
            contactEmail: true,
            contactPhone: true,
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
          orderBy: { createdAt: 'desc' },
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            lineItems: true,
          },
        },
      },
    })

    if (!requestRecord) {
      return NextResponse.json(
        { success: false, error: 'Request not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: requestRecord,
    })
  } catch (error) {
    console.error('Request GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER', 'SALES'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validation = updateRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const existingRequest = await prisma.request.findUnique({
      where: { id },
    })

    if (!existingRequest) {
      return NextResponse.json(
        { success: false, error: 'Request not found' },
        { status: 404 }
      )
    }

    const data = validation.data
    const statusChanged = data.status && data.status !== existingRequest.status

    const updatedRequest = await prisma.request.update({
      where: { id },
      data: {
        subject: data.subject,
        description: data.description,
        priority: data.priority,
        status: data.status,
        assignedToId: data.assignedToId,
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
        entityId: updatedRequest.id,
        action: statusChanged ? 'status_changed' : 'updated',
        details: JSON.stringify({
          subject: updatedRequest.subject,
          changes: Object.keys(data),
          ...(statusChanged
            ? { previousStatus: existingRequest.status, newStatus: data.status }
            : {}),
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedRequest,
      message: 'Request updated successfully',
    })
  } catch (error) {
    console.error('Request PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const requestRecord = await prisma.request.findUnique({
      where: { id },
      include: {
        quotes: true,
      },
    })

    if (!requestRecord) {
      return NextResponse.json(
        { success: false, error: 'Request not found' },
        { status: 404 }
      )
    }

    if (requestRecord.quotes.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete request with associated quotes' },
        { status: 400 }
      )
    }

    await prisma.request.delete({
      where: { id },
    })

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'request',
        entityId: id,
        action: 'deleted',
        details: JSON.stringify({
          subject: requestRecord.subject,
          clientId: requestRecord.clientId,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Request deleted successfully',
    })
  } catch (error) {
    console.error('Request DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
