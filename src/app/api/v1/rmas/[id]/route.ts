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

    const rma = await prisma.rMA.findUnique({
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
      },
    })

    if (!rma) {
      return NextResponse.json(
        { success: false, error: 'RMA not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: rma,
    })
  } catch (error) {
    console.error('RMA GET error:', error)
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

    if (!session || !['ADMIN', 'MANAGER', 'PROCUREMENT', 'OPERATIONS'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()

    const existing = await prisma.rMA.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'RMA not found' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (body.status !== undefined) updateData.status = body.status
    if (body.vendorResponse !== undefined) updateData.vendorResponse = body.vendorResponse
    if (body.refundAmount !== undefined) updateData.refundAmount = body.refundAmount
    if (body.creditMemoRef !== undefined) updateData.creditMemoRef = body.creditMemoRef

    // Auto-set resolvedAt when status changes to a resolved state
    if (body.status === 'RESOLVED' || body.status === 'CLOSED') {
      updateData.resolvedAt = new Date()
    }

    const rma = await prisma.rMA.update({
      where: { id },
      data: updateData,
      include: {
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
          },
        },
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'rma',
        entityId: rma.id,
        action: 'updated',
        details: JSON.stringify({
          rmaNumber: rma.rmaNumber,
          changes: Object.keys(updateData),
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: rma,
      message: 'RMA updated successfully',
    })
  } catch (error) {
    console.error('RMA PATCH error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
