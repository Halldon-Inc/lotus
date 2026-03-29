import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { resolveApprovalSchema } from '@/lib/validations'

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

    const approval = await prisma.approvalRequest.findUnique({
      where: { id },
      include: {
        rule: true,
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    })

    if (!approval) {
      return NextResponse.json(
        { success: false, error: 'Approval request not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: approval,
    })
  } catch (error) {
    console.error('Approval GET error:', error)
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

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validation = resolveApprovalSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const existingApproval = await prisma.approvalRequest.findUnique({
      where: { id },
      include: { rule: true },
    })

    if (!existingApproval) {
      return NextResponse.json(
        { success: false, error: 'Approval request not found' },
        { status: 404 }
      )
    }

    if (existingApproval.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: 'Approval has already been resolved' },
        { status: 400 }
      )
    }

    // Segregation of duties: prevent requester from approving their own request
    if (existingApproval.requestedById === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot approve your own request (segregation of duties)' },
        { status: 403 }
      )
    }

    // Verify the current user is ADMIN or the specifically assigned approver
    if (session.user.role !== 'ADMIN') {
      const rule = existingApproval.rule
      if (rule?.approverUserId && rule.approverUserId !== session.user.id) {
        return NextResponse.json(
          { error: 'You are not the assigned approver for this request' },
          { status: 403 }
        )
      }
      if (rule?.approverRole && rule.approverRole !== session.user.role) {
        return NextResponse.json(
          { error: 'Your role does not match the required approver role' },
          { status: 403 }
        )
      }
    }

    const data = validation.data

    const approval = await prisma.approvalRequest.update({
      where: { id },
      data: {
        status: data.status,
        approverId: session.user.id,
        resolvedAt: new Date(),
        notes: data.notes || null,
      },
      include: {
        rule: {
          select: {
            id: true,
            name: true,
            entityType: true,
          },
        },
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Create alert for the requester
    await prisma.alert.create({
      data: {
        userId: approval.requestedBy.id,
        type: 'SYSTEM',
        title: `Approval ${data.status.toLowerCase()}`,
        message: `Your approval request for ${approval.entityType} has been ${data.status.toLowerCase()} by ${session.user.name || session.user.email}`,
        relatedEntityType: 'approvalRequest',
        relatedEntityId: approval.id,
        severity: data.status === 'REJECTED' ? 'WARNING' : 'INFO',
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'approvalRequest',
        entityId: approval.id,
        action: data.status.toLowerCase(),
        details: JSON.stringify({
          targetEntityType: approval.entityType,
          targetEntityId: approval.entityId,
          previousStatus: existingApproval.status,
          newStatus: data.status,
          notes: data.notes,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: approval,
      message: `Approval ${data.status.toLowerCase()} successfully`,
    })
  } catch (error) {
    console.error('Approval PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
