import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { requireAuth, getAuthenticatedUser } from '@/lib/api-auth';
import { getServerCloudinary } from '@/lib/cloudinary';
import { uploadB64Stream } from '@/lib/cloudinary-upload';
import { adminImageOperations, adminUserOperations } from '@/utils/firestore-admin';
import {
  buildRateLimitKey,
  checkRateLimit,
  createPayloadTooLargeResponse,
  createRateLimitResponse,
  enforceContentLengthLimit,
  getRateLimitHeaders,
  resolveRateLimitPolicy,
} from '@/lib/rate-limit';
import {
  estimateBase64DecodedBytes,
  extractBase64ImageData,
  parseJsonWithSchema,
  uploadImageRequestSchema,
} from '@/schemas/api';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const payloadTooLarge = enforceContentLengthLimit(req, MAX_UPLOAD_BYTES);
    if (payloadTooLarge) {
      return payloadTooLarge;
    }

    const authError = await requireAuth(req);
    if (authError) {
      return authError;
    }
    
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    const rateLimitPolicy = resolveRateLimitPolicy('imagesUpload', user);
    const rateLimit = await checkRateLimit(
      buildRateLimitKey('images:upload', req, user.uid),
      rateLimitPolicy.limit,
      rateLimitPolicy.windowMs
    );
    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimitPolicy.message,
        rateLimit,
        rateLimitPolicy.body
      );
    }
    
    const parsedBody = await parseJsonWithSchema(req, uploadImageRequestSchema);
    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const { imageUrl, prompt, save, cloudinaryPublicId } = parsedBody.data;

    if (imageUrl) {
      const encodedBytes = Buffer.byteLength(imageUrl, 'utf8');
      if (encodedBytes > MAX_UPLOAD_BYTES) {
        return createPayloadTooLargeResponse(MAX_UPLOAD_BYTES);
      }

      const decodedBytes = estimateBase64DecodedBytes(extractBase64ImageData(imageUrl));
      if (decodedBytes > MAX_UPLOAD_BYTES) {
        return createPayloadTooLargeResponse(MAX_UPLOAD_BYTES);
      }
    }

    let folder;
    const userFolder = user.uid.replace(/[^a-zA-Z0-9]/g, '_');
    
    if (save) {
      // For saving to gallery, use the user's folder
      folder = `modern-mosaics/${userFolder}`;
    } else {
      // For temporary storage (like before upscaling), use a processing folder
      folder = 'modern-mosaics-processing';
    }
    
    const tags = ['modern-mosaics', 'generated-image'];
    if (!save) {
      tags.push('temp');
    }
    
    let cloudinary;
    try {
      cloudinary = await getServerCloudinary();
    } catch (cloudinaryError) {
      console.error('[IMAGE_UPLOAD] Cloudinary init failed:', cloudinaryError);
      return NextResponse.json({ error: 'Cloudinary configuration error' }, { status: 500 });
    }
    
    let uploadResult;
    
    try {
      if (cloudinaryPublicId) {
        const existingUrl = cloudinary.url(cloudinaryPublicId, { secure: true });
        uploadResult = await cloudinary.uploader.upload(existingUrl, {
          folder,
          tags,
          context: {
            prompt: prompt || 'No prompt provided',
            save_to_gallery: save ? 'true' : 'false'
          }
        });
      } else {
        if (!imageUrl) {
          return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 });
        }

        uploadResult = await uploadB64Stream(user.uid, extractBase64ImageData(imageUrl), {
          folder,
          tags,
          context: {
            prompt: prompt || 'No prompt provided',
            save_to_gallery: save ? 'true' : 'false'
          }
        });
      }
    } catch (uploadError: any) {
      console.error('[IMAGE_UPLOAD] Cloudinary upload failed:', uploadError?.message || uploadError);
      return NextResponse.json({ 
        error: 'Failed to upload to Cloudinary.' 
      }, { status: 500 });
    }

    if (save && user.email) {
      try {
        const userId = user.uid;
        await adminUserOperations.createOrUpdate(userId, {
          email: user.email,
          firebaseUid: user.uid,
          displayName: user.name || user.email.split('@')[0],
          preferences: {
            currency: 'GBP',
            notifications: true
          }
        });

        await adminImageOperations.create(userId, {
          cloudinaryPublicId: uploadResult.public_id,
          cloudinaryUrl: uploadResult.secure_url,
          prompt: prompt || '',
          metadata: {
            width: uploadResult.width || 1024,
            height: uploadResult.height || 1024,
            format: uploadResult.format || 'png',
            bytes: uploadResult.bytes || 0
          },
          tags: ['generated']
        });
      } catch (firestoreError) {
        console.error('[IMAGE_UPLOAD] Firestore sync failed:', firestoreError);
      }
    }
    
    return NextResponse.json(
      {
        publicId: uploadResult.public_id,
        secureUrl: uploadResult.secure_url
      },
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (error: any) {
    console.error('[IMAGE_UPLOAD] Error:', error?.message || error);
    return NextResponse.json({ 
      error: 'Failed to upload image'
    }, { status: 500 });
  }
}
