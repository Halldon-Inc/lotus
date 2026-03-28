import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { updateApprovalRuleSchema } from '@/lib/validations'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validation = updateApprovalRuleSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const existingRule = await prisma.approvalRule.findUnique({
      where: { id },
    })

    if (!existingRule) {
      return NextResponse.json(
        { success: false, error: 'Approval rule not found' },
        { status: 404 }
      )
    }

    const data = validation.data

    // Verify approver user exists if being updated
    if (data.approverUserId) {
      const user = await prisma.user.findUnique({
        where: { id: data.approverUserId },
      })
      if (!user) {
        return NextResponse.json(
          { success: false, error: 'Approver user not found' },
          { status: 404 }
        )
      }
    }

    const rule = await prisma.approvalRule.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.entityType !== undefined && { entityType: data.entityType }),
        ...(data.conditionField !== undefined && { conditionField: data.conditionField }),
        ...(data.conditionOp !== undefined && { conditionOp: data.conditionOp }),
        ...(data.conditionValue !== undefined && { conditionValue: data.conditionValue }),
        ...(data.approverRole !== undefined && { approverRole: data.approverRole || null }),
        ...(data.approverUserId !== undefined && { approverUserId: data.approverUserId || null }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: {
        approverUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            approvalRequests: true,
          },
        },
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'approvalRule',
        entityId: rule.id,
        action: 'updated',
        details: JSON.stringify({
          name: rule.name,
          changes: Object.keys(data),
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: rule,
      message: 'Approval rule updated successfully',
    })
  } catch (error) {
    console.error('Approval rule PUT error:', error)
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

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const rule = await prisma.approvalRule.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            approvalRequests: true,
          },
        },
      },
    })

    if (!rule) {
      return NextResponse.json(
        { success: false, error: 'Approval rule not found' },
        { status: 404 }
      )
    }

    // Soft deactivate instead of hard delete if there are linked requests
    if (rule._count.approvalRequests > 0) {
      await prisma.approvalRule.update({
        where: { id },
        data: { isActive: false },
      })

      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          entityType: 'approvalRule',
          entityId: id,
          action: 'deactivated',
          details: JSON.stringify({
            name: rule.name,
            reason: 'Rule has linked approval requests',
          }),
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Approval rule deactivated (has linked requests)',
      })
    }

    await prisma.approvalRule.delete({
      where: { id },
    })

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'approvalRule',
        entityId: id,
        action: 'deleted',
        details: JSON.stringify({
          name: rule.name,
          entityType: rule.entityType,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Approval rule deleted successfully',
    })
  } catch (error) {
    console.error('Approval rule DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
