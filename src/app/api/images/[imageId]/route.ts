import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { requireAuth, getAuthenticatedUser } from '@/lib/api-auth';
import { adminImageOperations, adminOrderOperations } from '@/utils/firestore-admin';

/**
 * DELETE /api/images/[imageId]
 * 
 * Remove an image from the user's gallery.
 * 
 * Safety checks:
 * - Requires authentication
 * - Only allows deleting own images
 * - Blocks deletion if image is referenced by any order
 * - Does NOT delete Cloudinary assets (preserves order history)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { imageId: string } }
) {
  try {
    const { imageId } = params;
    
    if (!imageId) {
      return NextResponse.json(
        { error: 'MISSING_IMAGE_ID', message: 'Image ID is required' },
        { status: 400 }
      );
    }

    // Verify user is authenticated
    const authError = await requireAuth(req);
    if (authError) {
      return authError;
    }
    
    // Get authenticated user
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { error: 'USER_NOT_FOUND', message: 'User not found' },
        { status: 401 }
      );
    }
    
    const userId = user.uid;
    console.log(`[Delete Image] User ${userId} attempting to delete image ${imageId}`);

    // Load the image document to get cloudinaryPublicId
    const image = await adminImageOperations.getById(userId, imageId);
    
    if (!image) {
      return NextResponse.json(
        { error: 'IMAGE_NOT_FOUND', message: 'Image not found' },
        { status: 404 }
      );
    }

    const cloudinaryPublicId = image.cloudinaryPublicId;
    console.log(`[Delete Image] Found image with cloudinaryPublicId: ${cloudinaryPublicId}`);

    // Check if this image is referenced by any order
    const orders = await adminOrderOperations.getByUserId(userId);
    const referencingOrder = orders.find(order => order.imageId === cloudinaryPublicId);

    if (referencingOrder) {
      console.log(`[Delete Image] Image is referenced by order ${referencingOrder.id}, blocking deletion`);
      return NextResponse.json(
        { 
          error: 'IMAGE_IN_USE', 
          message: "This image is used in an order and can't be removed.",
          orderId: referencingOrder.id
        },
        { status: 409 }
      );
    }

    // Safe to delete - remove from Firestore only (NOT Cloudinary)
    await adminImageOperations.delete(userId, imageId);
    console.log(`[Delete Image] Successfully deleted image ${imageId} from gallery`);

    return NextResponse.json({ ok: true });

  } catch (error: any) {
    console.error('[Delete Image] Error:', error);
    return NextResponse.json(
      { 
        error: 'DELETE_FAILED', 
        message: error.message || 'Failed to delete image' 
      },
      { status: 500 }
    );
  }
}
