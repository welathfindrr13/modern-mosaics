import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Check if the path is for authentication or public routes
  const isAuthRoute = pathname.startsWith('/auth')
  const isPublicRoute = pathname === '/' || pathname.startsWith('/_next') || pathname.includes('.')
  
  // Get the session token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  // Allow access to auth routes if not authenticated
  if (isAuthRoute) {
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  // Allow access to public routes regardless of authentication
  if (isPublicRoute) {
    return NextResponse.next()
  }

  // Redirect to signin if not authenticated and trying to access protected routes
  if (!token) {
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api/auth).*)'],
}
