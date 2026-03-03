import { NextRequest, NextResponse } from 'next/server'

// Define public routes that don't require authentication
const PUBLIC_ROUTES = ['/', '/signin']
const PUBLIC_PATH_PATTERNS = ['/_next', '/favicon', '/images']
const PUBLIC_API_ROUTES = ['/api/checkout/webhook', '/api/checkout/success', '/api/health']
const FILE_EXTENSIONS = ['.css', '.jpg', '.jpeg', '.png', '.svg', '.ico', '.js']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

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

  const isPublicApiRoute = PUBLIC_API_ROUTES.includes(pathname)
  if (isPublicApiRoute) {
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
  return NextResponse.redirect(new URL('/signin', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
