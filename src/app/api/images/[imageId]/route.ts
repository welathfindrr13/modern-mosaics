import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { requireAuth, getAuthenticatedUser } from '@/lib/api-auth';
import { adminImageOperations, adminOrderOperations } from '@/utils/firestore-admin';
import {
  imageRouteParamsSchema,
  parseRouteParamsWithSchema,
} from '@/schemas/api';

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
    const parsedParams = parseRouteParamsWithSchema(params, imageRouteParamsSchema);
    if (!parsedParams.success) {
      return parsedParams.response;
    }
    const { imageId } = parsedParams.data;

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
    console.log('[IMAGE_DELETE] Delete requested');

    // Load the image document to get cloudinaryPublicId
    const image = await adminImageOperations.getById(userId, imageId);
    
    if (!image) {
      return NextResponse.json(
        { error: 'IMAGE_NOT_FOUND', message: 'Image not found' },
        { status: 404 }
      );
    }

    const cloudinaryPublicId = image.cloudinaryPublicId;

    // Check if this image is referenced by any order
    const orders = await adminOrderOperations.getByUserId(userId);
    const referencingOrder = orders.find(order => order.imageId === cloudinaryPublicId);

    if (referencingOrder) {
      console.log('[IMAGE_DELETE] Blocked because image is referenced by an order');
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
    console.log('[IMAGE_DELETE] Completed successfully');

    return NextResponse.json({ ok: true });

  } catch (error: any) {
    console.error('[IMAGE_DELETE] Error:', error?.message || error);
    return NextResponse.json(
      { 
        error: 'DELETE_FAILED', 
        message: error.message || 'Failed to delete image' 
      },
      { status: 500 }
    );
  }
}
