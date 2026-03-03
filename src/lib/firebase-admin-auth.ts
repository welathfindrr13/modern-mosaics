/**
 * Firebase Admin Authentication utilities
 * For server-side ID token verification
 */

import { adminApp } from '@/utils/firestore-admin';
import { DecodedIdToken } from 'firebase-admin/auth';

/**
 * Verify Firebase ID token on the server
 */
export async function verifyIdToken(token: string): Promise<DecodedIdToken | null> {
  try {
    const decodedToken = await adminApp.auth().verifyIdToken(token);
    return decodedToken;
  } catch (error: any) {
    console.error('Token verification failed:', error.message);
    return null;
  }
}

/**
 * Get authenticated user from Firebase ID token
 */
export async function getUserFromToken(token: string) {
  const decodedToken = await verifyIdToken(token);
  if (!decodedToken) return null;
  
  return {
    uid: decodedToken.uid,
    email: decodedToken.email || null,
    emailVerified: decodedToken.email_verified || false,
    name: decodedToken.name || null,
    picture: decodedToken.picture || null,
  };
}

/**
 * Get user from request headers (for API routes)
 */
export async function getUserFromRequest(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    // Fallback to cookie-based token
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) return null;
    
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {} as Record<string, string>);
    
    const token = cookies['firebase-id-token'];
    if (!token) return null;
    
    return await getUserFromToken(token);
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  return await getUserFromToken(token);
}
