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

    const budget = await prisma.budget.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            type: true,
            contactName: true,
            contactEmail: true,
          },
        },
      },
    })

    if (!budget) {
      return NextResponse.json(
        { success: false, error: 'Budget not found' },
        { status: 404 }
      )
    }

    const enriched = {
      ...budget,
      available: budget.totalBudget - budget.encumbered - budget.spent,
      utilizationPct:
        budget.totalBudget > 0
          ? ((budget.encumbered + budget.spent) / budget.totalBudget) * 100
          : 0,
    }

    return NextResponse.json({
      success: true,
      data: enriched,
    })
  } catch (error) {
    console.error('Budget GET error:', error)
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
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    const existingBudget = await prisma.budget.findUnique({
      where: { id },
    })

    if (!existingBudget) {
      return NextResponse.json(
        { success: false, error: 'Budget not found' },
        { status: 404 }
      )
    }

    const body = await request.json()

    // Only allow updating specific fields
    const allowedFields = [
      'totalBudget',
      'encumbered',
      'spent',
      'department',
      'notes',
    ]
    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const budget = await prisma.budget.update({
      where: { id },
      data: updateData,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'budget',
        entityId: budget.id,
        action: 'updated',
        details: JSON.stringify({
          clientId: budget.clientId,
          fiscalYear: budget.fiscalYear,
          changes: Object.keys(updateData),
        }),
      },
    })

    const enriched = {
      ...budget,
      available: budget.totalBudget - budget.encumbered - budget.spent,
      utilizationPct:
        budget.totalBudget > 0
          ? ((budget.encumbered + budget.spent) / budget.totalBudget) * 100
          : 0,
    }

    return NextResponse.json({
      success: true,
      data: enriched,
      message: 'Budget updated successfully',
    })
  } catch (error) {
    console.error('Budget PATCH error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
