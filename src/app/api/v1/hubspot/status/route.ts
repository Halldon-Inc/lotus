import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkConnection } from '@/lib/hubspot'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const portalId = await checkConnection()

    return NextResponse.json({
      success: true,
      data: {
        connected: portalId !== null,
        portalId,
      },
    })
  } catch (error) {
    console.error('HubSpot status check error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
