import { NextRequest, NextResponse } from 'next/server'

// Define public routes that don't require authentication
const PUBLIC_ROUTES = ['/', '/signin', '/privacy', '/terms', '/support']
const PUBLIC_PATH_PATTERNS = ['/_next', '/favicon', '/images']
const FILE_EXTENSIONS = ['.css', '.jpg', '.jpeg', '.png', '.svg', '.ico', '.js']
const PRODUCTION_BLOCKED_ROUTES = ['/debug', '/cloudinary-test', '/firebase-auth']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProduction = process.env.NODE_ENV === 'production'

  if (isProduction && PRODUCTION_BLOCKED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return new NextResponse('Not found', { status: 404 })
  }

  // First, check if this is a public asset or route
  const isPublicAsset = PUBLIC_PATH_PATTERNS.some(pattern => pathname.startsWith(pattern)) ||
                         FILE_EXTENSIONS.some(ext => pathname.endsWith(ext))
  
  if (isPublicAsset) {
    return NextResponse.next()
  }

  // Then check if it's a defined public route
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname)
  if (isPublicRoute) {
    return NextResponse.next()
  }

  // Let API routes handle their own auth and error contracts.
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Check for Firebase ID token
  const idTokenCookie = request.cookies.get('firebase-id-token')
  if (idTokenCookie) {
    // Optional: Verify token validity (adds latency but more secure)
    // For now, just check if the token exists
    return NextResponse.next()
  }

  // Fallback to legacy auth cookie for backward compatibility
  const legacyAuthCookie = request.cookies.get('auth-session')
  if (legacyAuthCookie) {
    return NextResponse.next()
  }

  // If not authenticated, redirect to signin
  const signinUrl = new URL('/signin', request.url)
  if (pathname.startsWith('/dashboard')) {
    signinUrl.searchParams.set('reason', 'orders')
  }
  return NextResponse.redirect(signinUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
