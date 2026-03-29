import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

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

    const changeOrder = await prisma.changeOrder.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            clientId: true,
            totalAmount: true,
            status: true,
            client: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!changeOrder) {
      return NextResponse.json(
        { success: false, error: 'Change order not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: changeOrder,
    })
  } catch (error) {
    console.error('ChangeOrder GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
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

    const body = await request.json()

    const existing = await prisma.changeOrder.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Change order not found' },
        { status: 404 }
      )
    }

    if (existing.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: 'Change order has already been processed' },
        { status: 400 }
      )
    }

    const { status } = body

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Status must be APPROVED or REJECTED' },
        { status: 400 }
      )
    }

    const changeOrder = await prisma.changeOrder.update({
      where: { id },
      data: {
        status,
        approvedById: session.user.id,
        approvedAt: new Date(),
      },
      include: {
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'change_order',
        entityId: changeOrder.id,
        action: status === 'APPROVED' ? 'approved' : 'rejected',
        details: JSON.stringify({
          poNumber: changeOrder.purchaseOrder.poNumber,
          changeNumber: changeOrder.changeNumber,
          fieldChanged: changeOrder.fieldChanged,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: changeOrder,
      message: `Change order ${status.toLowerCase()} successfully`,
    })
  } catch (error) {
    console.error('ChangeOrder PATCH error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
