import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createApprovalRuleSchema } from '@/lib/validations'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const rules = await prisma.approvalRule.findMany({
      orderBy: [{ entityType: 'asc' }, { priority: 'desc' }],
      include: {
        approverUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        _count: {
          select: {
            approvalRequests: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: rules,
    })
  } catch (error) {
    console.error('Approval rules GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validation = createApprovalRuleSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const data = validation.data

    // Validate conditionValue is a valid number for numeric operators
    if (['gt', 'lt', 'gte', 'lte'].includes(data.conditionOp)) {
      if (isNaN(Number(data.conditionValue))) {
        return NextResponse.json(
          { success: false, error: 'Condition value must be a number for numeric operators' },
          { status: 400 }
        )
      }
    }

    // Verify approver user exists if specified
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

    const rule = await prisma.approvalRule.create({
      data: {
        name: data.name,
        entityType: data.entityType,
        conditionField: data.conditionField,
        conditionOp: data.conditionOp,
        conditionValue: data.conditionValue,
        approverRole: data.approverRole || null,
        approverUserId: data.approverUserId || null,
        priority: data.priority ?? 0,
        isActive: data.isActive ?? true,
      },
      include: {
        approverUser: {
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
        entityType: 'approvalRule',
        entityId: rule.id,
        action: 'created',
        details: JSON.stringify({
          name: rule.name,
          entityType: rule.entityType,
          condition: `${rule.conditionField} ${rule.conditionOp} ${rule.conditionValue}`,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: rule,
      message: 'Approval rule created successfully',
    })
  } catch (error) {
    console.error('Approval rules POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
