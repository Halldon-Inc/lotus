import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { QuickBooksClient } from '@/lib/quickbooks'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const realmId = searchParams.get('realmId')
    const error = searchParams.get('error')

    if (error) {
      const redirectUrl = new URL('/settings/quickbooks', request.url)
      redirectUrl.searchParams.set('error', error)
      return NextResponse.redirect(redirectUrl)
    }

    if (!code || !realmId) {
      const redirectUrl = new URL('/settings/quickbooks', request.url)
      redirectUrl.searchParams.set('error', 'missing_params')
      return NextResponse.redirect(redirectUrl)
    }

    const redirectUri = process.env.QB_REDIRECT_URI || ''
    const tokens = await QuickBooksClient.exchangeCode(code, redirectUri)

    // Create a temporary client to fetch company info
    const tempClient = new QuickBooksClient(
      '',
      realmId,
      tokens.access_token,
      tokens.refresh_token
    )

    let companyName: string | null = null
    try {
      const companyInfo = await tempClient.getCompanyInfo()
      const info = companyInfo.CompanyInfo as Record<string, unknown> | undefined
      companyName = (info?.CompanyName as string) || null
    } catch {
      // Non-critical: proceed without company name
    }

    // Upsert the connection (one active connection per realm)
    await prisma.quickBooksConnection.upsert({
      where: { realmId },
      create: {
        realmId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        companyName,
        isActive: true,
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        companyName,
        isActive: true,
      },
    })

    // Log the connection
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'quickbooks',
        entityId: realmId,
        action: 'connected',
        details: JSON.stringify({ realmId, companyName }),
      },
    })

    const redirectUrl = new URL('/settings/quickbooks', request.url)
    redirectUrl.searchParams.set('connected', 'true')
    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.error('QuickBooks callback error:', error)
    const redirectUrl = new URL('/settings/quickbooks', request.url)
    redirectUrl.searchParams.set('error', 'exchange_failed')
    return NextResponse.redirect(redirectUrl)
  }
}
