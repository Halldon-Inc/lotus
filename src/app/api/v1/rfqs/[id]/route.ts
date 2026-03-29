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

    const rfq = await prisma.rFQ.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            contactName: true,
            contactEmail: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        responses: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!rfq) {
      return NextResponse.json(
        { success: false, error: 'RFQ not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: rfq,
    })
  } catch (error) {
    console.error('RFQ GET error:', error)
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

    if (!session || !['ADMIN', 'MANAGER', 'SALES'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()

    const existing = await prisma.rFQ.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'RFQ not found' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (body.status !== undefined) updateData.status = body.status
    if (body.selectedVendor !== undefined) updateData.selectedVendor = body.selectedVendor
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.dueDate !== undefined) updateData.dueDate = new Date(body.dueDate)

    const rfq = await prisma.rFQ.update({
      where: { id },
      data: updateData,
      include: {
        client: {
          select: {
            id: true,
            name: true,
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

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'rfq',
        entityId: rfq.id,
        action: 'updated',
        details: JSON.stringify({
          rfqNumber: rfq.rfqNumber,
          changes: Object.keys(updateData),
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: rfq,
      message: 'RFQ updated successfully',
    })
  } catch (error) {
    console.error('RFQ PATCH error:', error)
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

    const rfq = await prisma.rFQ.findUnique({
      where: { id },
      include: {
        _count: {
          select: { responses: true },
        },
      },
    })

    if (!rfq) {
      return NextResponse.json(
        { success: false, error: 'RFQ not found' },
        { status: 404 }
      )
    }

    // Cascade delete will handle responses
    await prisma.rFQ.delete({ where: { id } })

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'rfq',
        entityId: id,
        action: 'deleted',
        details: JSON.stringify({
          rfqNumber: rfq.rfqNumber,
          title: rfq.title,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'RFQ deleted successfully',
    })
  } catch (error) {
    console.error('RFQ DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
