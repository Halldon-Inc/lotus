import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createApprovalRequestSchema } from '@/lib/validations'

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
    const view = searchParams.get('view') || 'pending' // pending | submitted | all
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')

    const skip = (page - 1) * pageSize

    let where: Record<string, unknown> = {}

    if (view === 'pending') {
      // Approvals assigned to current user (by role or user ID)
      where = {
        status: 'PENDING',
        OR: [
          { rule: { approverUserId: session.user.id } },
          { rule: { approverRole: session.user.role } },
          // If no rule, ADMIN/MANAGER can see all pending
          ...((['ADMIN', 'MANAGER'].includes(session.user.role))
            ? [{ ruleId: null }]
            : []),
        ],
      }
    } else if (view === 'submitted') {
      // Approvals I requested
      where = { requestedById: session.user.id }
    } else if (view === 'all' && ['ADMIN', 'MANAGER'].includes(session.user.role)) {
      // All approvals for admin/manager
      where = {}
    } else {
      // Non-admin asking for 'all' only sees their own
      where = {
        OR: [
          { requestedById: session.user.id },
          { approverId: session.user.id },
        ],
      }
    }

    const [approvals, total] = await Promise.all([
      prisma.approvalRequest.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          rule: {
            select: {
              id: true,
              name: true,
              entityType: true,
              conditionField: true,
              conditionOp: true,
              conditionValue: true,
            },
          },
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
      }),
      prisma.approvalRequest.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        items: approvals,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Approvals GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validation = createApprovalRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const data = validation.data

    // If a ruleId is provided, verify it exists
    if (data.ruleId) {
      const rule = await prisma.approvalRule.findUnique({
        where: { id: data.ruleId },
      })
      if (!rule) {
        return NextResponse.json(
          { success: false, error: 'Approval rule not found' },
          { status: 404 }
        )
      }
    }

    const approval = await prisma.approvalRequest.create({
      data: {
        entityType: data.entityType,
        entityId: data.entityId,
        ruleId: data.ruleId || null,
        requestedById: session.user.id,
        notes: data.notes || null,
      },
      include: {
        rule: {
          select: {
            id: true,
            name: true,
            entityType: true,
            approverRole: true,
            approverUserId: true,
          },
        },
        requestedBy: {
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
        entityType: 'approvalRequest',
        entityId: approval.id,
        action: 'created',
        details: JSON.stringify({
          targetEntityType: data.entityType,
          targetEntityId: data.entityId,
          ruleName: approval.rule?.name,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: approval,
      message: 'Approval request created successfully',
    })
  } catch (error) {
    console.error('Approvals POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
