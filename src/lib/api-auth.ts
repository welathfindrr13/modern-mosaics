import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, verifyIdToken } from './firebase-admin-auth'

// Get authenticated user from Firebase ID token
export async function getAuthenticatedUser(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    return user;
  } catch (error) {
    console.error('Authentication error:', error);
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
    };
  } catch (error) {
    console.error('Authentication error:', error);
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
