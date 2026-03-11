import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getAuthenticatedUser } from '@/lib/api-auth';
import { getServerCloudinary } from '@/lib/cloudinary';
import { ensurePublicId } from '@/utils/gelatoUrls';
import {
  buildRateLimitKey,
  checkRateLimit,
  createRateLimitResponse,
  getRateLimitHeaders,
  resolveRateLimitPolicy,
} from '@/lib/rate-limit';
import {
  cloudinaryPublicIdSchema,
  getValidationMessage,
  imageVerifyRequestSchema,
} from '@/schemas/api';

/**
 * Verify that an image exists in Cloudinary and return minimal metadata.
 */
export async function POST(request: NextRequest) {
  const authResponse = await requireAuth(request);
  if (authResponse) {
    return authResponse;
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ exists: false, error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const rateLimitPolicy = resolveRateLimitPolicy('imagesVerify', user);
    const rateLimit = await checkRateLimit(
      buildRateLimitKey('images:verify', request, user.uid),
      rateLimitPolicy.limit,
      rateLimitPolicy.windowMs
    );
    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimitPolicy.message,
        rateLimit,
        {
          exists: false,
          ...rateLimitPolicy.body,
        }
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { exists: false, error: 'Invalid JSON body', code: 'INVALID_INPUT' },
        { status: 400, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    const parsedBody = imageVerifyRequestSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { exists: false, error: getValidationMessage(parsedBody.error), code: 'INVALID_INPUT' },
        { status: 400, headers: getRateLimitHeaders(rateLimit) }
      );
    }
    const { imageIdentifier } = parsedBody.data;

    const publicIdResult = cloudinaryPublicIdSchema.safeParse(ensurePublicId(imageIdentifier));
    if (!publicIdResult.success) {
      return NextResponse.json(
        { exists: false, error: getValidationMessage(publicIdResult.error), code: 'INVALID_INPUT' },
        { status: 400, headers: getRateLimitHeaders(rateLimit) }
      );
    }
    const publicId = publicIdResult.data;
    const cloudinary = await getServerCloudinary();

    const trySearch = async () => {
      const searchResult = await cloudinary.search
        .expression(`public_id:${publicId}`)
        .max_results(1)
        .execute();
      if (!searchResult.resources?.length) return null;
      const resource = searchResult.resources[0];
      return {
        format: resource.format,
        width: resource.width,
        height: resource.height,
        bytes: resource.bytes,
        url: resource.secure_url,
      };
    };

    const tryResource = async () => {
      const result = await cloudinary.api.resource(publicId, { resource_type: 'image' });
      return {
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        url: result.secure_url,
      };
    };

    let imageDetails: Awaited<ReturnType<typeof tryResource>> | null = null;
    try {
      imageDetails = await trySearch();
    } catch {
      imageDetails = null;
    }

    if (!imageDetails) {
      try {
        imageDetails = await tryResource();
      } catch (resourceError: any) {
        const isNotFound =
          resourceError?.error?.http_code === 404 ||
          resourceError?.http_code === 404 ||
          resourceError?.error?.message?.includes('not found') ||
          resourceError?.message?.includes('not found');

        if (isNotFound) {
          return NextResponse.json(
            { exists: false, publicId, error: 'Image not found', code: 'NOT_FOUND' },
            { headers: getRateLimitHeaders(rateLimit) }
          );
        }
        throw resourceError;
      }
    }

    return NextResponse.json(
      {
        exists: true,
        publicId,
        imageDetails,
      },
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (error: any) {
    console.error('[IMAGES_VERIFY] Verification failed:', error?.message || error);
    return NextResponse.json(
      { exists: false, error: `Failed to verify image: ${error?.message || 'Unknown error'}`, code: 'VERIFY_ERROR' },
      { status: 500 }
    );
  }
}
