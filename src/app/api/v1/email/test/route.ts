import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { poReceived } from '@/lib/email-templates'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: ADMIN role required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { to } = body as { to?: string }

    if (!to || typeof to !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing required field: to (email address)' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address format' },
        { status: 400 }
      )
    }

    // Send a sample email using the poReceived template
    const template = poReceived('Test Client', 'PO-TEST-001')
    const success = await sendEmail(to, template.subject, template.html)

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to send test email. Check server logs for details.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${to}`,
    })
  } catch (error) {
    console.error('Email test POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
