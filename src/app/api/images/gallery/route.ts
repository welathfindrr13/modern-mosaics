import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { requireAuth, getAuthenticatedUser } from '@/lib/api-auth';
import { adminImageOperations } from '@/utils/firestore-admin';

export async function GET(req: NextRequest) {
  try {
    // Verify user is authenticated
    const authError = await requireAuth(req);
    if (authError) {
      return authError;
    }
    
    // Get authenticated user
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ 
        error: 'User not found. You may need to log out and log in again.',
        code: 'UNAUTHORIZED',
      }, { status: 401 });
    }
    // Block anonymous sessions for private gallery routes.
    if (!user.email) {
      return NextResponse.json(
        { error: 'Sign in with Google or email to access your private gallery.', code: 'EMAIL_REQUIRED' },
        { status: 403 }
      );
    }
    
    // Use Firebase UID as the userId for Firestore
    const userId = user.uid;
    
    try {
      // Get images from Firestore
      const images = await adminImageOperations.getByUserId(userId);
      
      // Transform results to match the expected gallery format
      const galleryImages = images.map(image => ({
        id: image.id,
        publicId: image.cloudinaryPublicId,
        secureUrl: image.cloudinaryUrl,
        prompt: image.prompt || '',
        createdAt: image.createdAt
      }));
      
      return NextResponse.json({ images: galleryImages });
    } catch (firestoreError: any) {
      console.error('[GALLERY_API] Firestore read failed:', firestoreError?.message || firestoreError);
      
      // Fallback to empty gallery for now
      return NextResponse.json({ 
        images: [],
        message: 'Firestore not available, showing empty gallery'
      });
    }
  } catch (error: any) {
    console.error('[GALLERY_API] API error:', error?.message || error);
    return NextResponse.json({ 
      error: `Failed to retrieve gallery: ${error.message || 'Unknown error'}`,
      code: 'GALLERY_ERROR',
    }, { status: 500 });
  }
}
