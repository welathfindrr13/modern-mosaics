import { adminImageOperations } from '@/utils/firestore-admin';

export type CheckoutImageOwnershipResult =
  | { ok: true; proof: 'firestore' | 'prefix' }
  | { ok: false; reason: string };

function sanitizeUserFolder(userUid: string): string {
  return userUid.replace(/[^a-zA-Z0-9]/g, '_');
}

function hasStrictCurrentUserPrefix(userUid: string, imagePublicId: string): boolean {
  const userFolder = sanitizeUserFolder(userUid);
  return imagePublicId.startsWith(`modern-mosaics/${userFolder}/`);
}

export async function verifyCheckoutImageOwnership(
  userUid: string,
  imagePublicId: string
): Promise<CheckoutImageOwnershipResult> {
  try {
    const ownedImage = await adminImageOperations.getByCloudinaryPublicId(userUid, imagePublicId);
    if (ownedImage) {
      return { ok: true, proof: 'firestore' };
    }
  } catch (error) {
    console.warn('[CHECKOUT_IMAGE_OWNERSHIP] Firestore ownership lookup failed:', error);
  }

  if (hasStrictCurrentUserPrefix(userUid, imagePublicId)) {
    return { ok: true, proof: 'prefix' };
  }

  return { ok: false, reason: 'Image is not owned by the authenticated user.' };
}
