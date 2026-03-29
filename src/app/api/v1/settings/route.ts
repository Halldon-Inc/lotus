import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { settingsSchema } from '@/lib/validations'

const DEFAULT_SETTINGS: Record<string, string> = {
  'alert.overdue_threshold_days': '7',
  'alert.missing_item_enabled': 'true',
  'alert.deadline_reminder_days': '3',
  'workflow.auto_assign_requests': 'true',
  'workflow.require_quote_approval': 'false',
  'workflow.auto_close_fulfilled_orders': 'true',
  'integration.hubspot_enabled': 'false',
  'integration.hubspot_sync_interval': '60',
  'integration.email_notifications': 'true',
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const savedSettings = await prisma.systemSettings.findMany()

    // Merge saved settings over defaults
    const settingsMap: Record<string, string> = { ...DEFAULT_SETTINGS }
    for (const setting of savedSettings) {
      settingsMap[setting.key] = setting.value
    }

    // Convert to array format for easier frontend consumption
    const settings = Object.entries(settingsMap).map(([key, value]) => ({
      key,
      value,
    }))

    return NextResponse.json({
      success: true,
      data: settings,
    })
  } catch (error) {
    console.error('Settings GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validation = settingsSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { settings } = validation.data

    // Upsert each setting in a transaction
    await prisma.$transaction(
      settings.map((setting) =>
        prisma.systemSettings.upsert({
          where: { key: setting.key },
          update: { value: setting.value },
          create: { key: setting.key, value: setting.value },
        })
      )
    )

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'system',
        entityId: 'settings',
        action: 'updated',
        details: JSON.stringify({
          updatedKeys: settings.map((s) => s.key),
        }),
      },
    })

    // Return the full updated settings
    const savedSettings = await prisma.systemSettings.findMany()
    const settingsMap: Record<string, string> = { ...DEFAULT_SETTINGS }
    for (const setting of savedSettings) {
      settingsMap[setting.key] = setting.value
    }

    const updatedSettings = Object.entries(settingsMap).map(([key, value]) => ({
      key,
      value,
    }))

    return NextResponse.json({
      success: true,
      data: updatedSettings,
      message: 'Settings updated successfully',
    })
  } catch (error) {
    console.error('Settings PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
