import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

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
    const clientId = searchParams.get('clientId')
    const fiscalYear = searchParams.get('fiscalYear')

    const where: Record<string, unknown> = {}
    if (clientId) where.clientId = clientId
    if (fiscalYear) where.fiscalYear = parseInt(fiscalYear)

    const budgets = await prisma.budget.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: { fiscalYear: 'desc' },
    })

    const enriched = budgets.map((b) => ({
      ...b,
      available: b.totalBudget - b.encumbered - b.spent,
      utilizationPct:
        b.totalBudget > 0
          ? ((b.encumbered + b.spent) / b.totalBudget) * 100
          : 0,
    }))

    return NextResponse.json({
      success: true,
      data: enriched,
    })
  } catch (error) {
    console.error('Budgets GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    const body = await request.json()

    const budget = await prisma.budget.create({
      data: body,
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
        action: 'created',
        details: JSON.stringify({
          clientId: budget.clientId,
          fiscalYear: budget.fiscalYear,
          totalBudget: budget.totalBudget,
        }),
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: budget,
        message: 'Budget created successfully',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Budgets POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
