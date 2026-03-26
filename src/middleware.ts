import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const isAuth = !!token
    const isAuthPage = req.nextUrl.pathname.startsWith('/login')

    // If user is on auth page but already authenticated, redirect to dashboard
    if (isAuthPage && isAuth) {
      return NextResponse.redirect(new URL('/', req.url))
    }

    // If user is not authenticated and not on auth page, redirect to login
    if (!isAuthPage && !isAuth) {
      let from = req.nextUrl.pathname
      if (req.nextUrl.search) {
        from += req.nextUrl.search
      }

      return NextResponse.redirect(
        new URL(`/login?from=${encodeURIComponent(from)}`, req.url)
      )
    }

    // Role-based access control
    if (isAuth && token?.role) {
      const pathname = req.nextUrl.pathname

      // Admin-only routes
      if (pathname.startsWith('/settings') && token.role !== 'ADMIN' && token.role !== 'MANAGER') {
        return NextResponse.redirect(new URL('/unauthorized', req.url))
      }

      // Manager and Admin routes
      if (pathname.startsWith('/reports') && !['ADMIN', 'MANAGER'].includes(token.role)) {
        return NextResponse.redirect(new URL('/unauthorized', req.url))
      }

      // Procurement-specific routes
      if (pathname.startsWith('/procurement') && !['ADMIN', 'MANAGER', 'PROCUREMENT', 'OPERATIONS'].includes(token.role)) {
        return NextResponse.redirect(new URL('/unauthorized', req.url))
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        // Allow access to auth pages without token
        return true
      },
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
