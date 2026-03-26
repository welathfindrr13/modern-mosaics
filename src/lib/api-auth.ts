import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, verifyIdToken } from './firebase-admin-auth'

function isDynamicServerUsageError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const digest = 'digest' in error ? error.digest : null;
  const message = 'message' in error ? error.message : null;

  return (
    digest === 'DYNAMIC_SERVER_USAGE' ||
    (typeof message === 'string' && message.includes('Dynamic server usage'))
  );
}

function logAuthenticationFailure(error: unknown) {
  if (isDynamicServerUsageError(error)) {
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.warn('Authentication check failed', error);
    return;
  }

  console.warn('Authentication check failed');
}

// Get authenticated user from Firebase ID token
export async function getAuthenticatedUser(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    return user;
  } catch (error) {
    logAuthenticationFailure(error);
    return null;
  }
}

// Get authenticated user from server components
export async function getAuthenticatedUserFromCookies() {
  try {
    const cookieStore = cookies();
    const idTokenCookie = cookieStore.get('firebase-id-token');
    
    if (!idTokenCookie?.value) {
      return null;
    }
    
    const decodedToken = await verifyIdToken(idTokenCookie.value);
    if (!decodedToken) {
      return null;
    }
    
    return {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      emailVerified: decodedToken.email_verified || false,
      name: decodedToken.name || null,
      picture: decodedToken.picture || null,
      isAnonymous: decodedToken.firebase?.sign_in_provider === 'anonymous',
      signInProvider:
        typeof decodedToken.firebase?.sign_in_provider === 'string'
          ? decodedToken.firebase.sign_in_provider
          : null,
    };
  } catch (error) {
    logAuthenticationFailure(error);
    return null;
  }
}

// Legacy function for backward compatibility
export async function isAuthenticated(req?: NextRequest) {
  if (req) {
    const user = await getAuthenticatedUser(req);
    return !!user;
  } else {
    const user = await getAuthenticatedUserFromCookies();
    return !!user;
  }
}

// Helper function to get user email (legacy compatibility)
export async function getUserEmail(req?: NextRequest): Promise<string | null> {
  if (req) {
    const user = await getAuthenticatedUser(req);
    return user?.email || null;
  } else {
    const user = await getAuthenticatedUserFromCookies();
    return user?.email || null;
  }
}

// Utility for API routes to check auth and return 401 if not authenticated
export async function requireAuth(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  return null; // Continue if authenticated
}

function getDebugAdminAllowlist(): Set<string> {
  const raw = process.env.DEBUG_ADMIN_EMAILS || '';
  return new Set(
    raw
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isDebugAdminEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }

  return getDebugAdminAllowlist().has(email.trim().toLowerCase());
}

type DebugAccessFailureReason = 'unauthenticated' | 'not_allowlisted';

function createDebugAccessResponse(reason: DebugAccessFailureReason) {
  return process.env.NODE_ENV === 'production'
    ? NextResponse.json({ error: 'Not Found' }, { status: 404 })
    : NextResponse.json({ error: 'Unauthorized', reason }, { status: 403 });
}

export async function requireDebugAdmin(
  req: NextRequest,
  path: string
): Promise<NextResponse | null> {
  const user = await getAuthenticatedUser(req);
  const normalizedEmail = user?.email?.trim().toLowerCase() ?? null;
  const allowlisted = isDebugAdminEmail(normalizedEmail);

  if (allowlisted) {
    return null;
  }

  const reason: DebugAccessFailureReason = normalizedEmail ? 'not_allowlisted' : 'unauthenticated';

  console.warn(
    '[DEBUG_ACCESS_DENIED]',
    JSON.stringify({
      path,
      reason,
      env: process.env.NODE_ENV || 'unknown',
      timestamp: new Date().toISOString(),
    })
  );

  return createDebugAccessResponse(reason);
}
