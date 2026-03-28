import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { updateClientSchema } from '@/lib/validations'

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

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        assignedRep: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        requests: {
          orderBy: { createdAt: 'desc' },
          include: {
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
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
          },
        },
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          include: {
            items: true,
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
    })

    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Client not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: client,
    })
  } catch (error) {
    console.error('Client GET error:', error)
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
    const validation = updateClientSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const existingClient = await prisma.client.findUnique({
      where: { id },
    })

    if (!existingClient) {
      return NextResponse.json(
        { success: false, error: 'Client not found' },
        { status: 404 }
      )
    }

    const data = validation.data
    const updateData: Record<string, unknown> = { ...data }

    if (data.fiscalYearStart) {
      updateData.fiscalYearStart = new Date(data.fiscalYearStart)
    }

    const client = await prisma.client.update({
      where: { id },
      data: updateData,
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
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'client',
        entityId: client.id,
        action: 'updated',
        details: JSON.stringify({
          clientName: client.name,
          changes: Object.keys(data),
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: client,
      message: 'Client updated successfully',
    })
  } catch (error) {
    console.error('Client PUT error:', error)
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

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            requests: true,
            quotes: true,
            purchaseOrders: true,
          },
        },
      },
    })

    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Client not found' },
        { status: 404 }
      )
    }

    // Soft delete: if client has related records, deactivate instead of deleting
    const hasRelations =
      client._count.requests > 0 ||
      client._count.quotes > 0 ||
      client._count.purchaseOrders > 0

    if (hasRelations) {
      // Soft deactivate by appending [DEACTIVATED] to name
      await prisma.client.update({
        where: { id },
        data: {
          name: client.name.includes('[DEACTIVATED]')
            ? client.name
            : `${client.name} [DEACTIVATED]`,
          assignedRepId: null,
        },
      })

      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          entityType: 'client',
          entityId: id,
          action: 'deactivated',
          details: JSON.stringify({
            clientName: client.name,
            reason: 'Client has related records',
          }),
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Client deactivated (has related records)',
      })
    }

    await prisma.client.delete({
      where: { id },
    })

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'client',
        entityId: id,
        action: 'deleted',
        details: JSON.stringify({
          clientName: client.name,
          type: client.type,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Client deleted successfully',
    })
  } catch (error) {
    console.error('Client DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
