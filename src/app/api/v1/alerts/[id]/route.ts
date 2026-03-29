import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { updateAlertSchema } from '@/lib/validations'

export async function PATCH(
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
    const validation = updateAlertSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const data = validation.data

    // Check if alert exists and belongs to user
    const existingAlert = await prisma.alert.findUnique({
      where: { id },
    })

    if (!existingAlert) {
      return NextResponse.json(
        { success: false, error: 'Alert not found' },
        { status: 404 }
      )
    }

    if (existingAlert.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const alert = await prisma.alert.update({
      where: { id },
      data: {
        isRead: data.isRead,
        readAt: data.isRead === true ? new Date() : null,
      },
    })

    return NextResponse.json({
      success: true,
      data: alert,
      message: 'Alert updated successfully',
    })
  } catch (error) {
    console.error('Alert PATCH error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE is not allowed: activity logs and alerts are immutable for audit compliance
export async function DELETE() {
  return NextResponse.json(
    { success: false, error: 'Method not allowed. Alerts are immutable for audit compliance.' },
    { status: 405 }
  )
}
