import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { QuickBooksClient } from '@/lib/quickbooks'
import { randomBytes } from 'crypto'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Generate a CSRF state token
    const state = randomBytes(16).toString('hex')

    const authUrl = QuickBooksClient.getAuthUrl(state)

    return NextResponse.json({
      success: true,
      data: { authUrl, state },
    })
  } catch (error) {
    console.error('QuickBooks connect error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate QuickBooks auth URL' },
      { status: 500 }
    )
  }
}
