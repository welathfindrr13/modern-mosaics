/**
 * Image Upscaling API Route
 * 
 * POST /api/upscale
 * 
 * Upscales an image using Replicate models (Clarity/UltraSharp)
 * and uploads the result to Cloudinary for permanent storage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getAuthenticatedUser } from '@/lib/api-auth';
import { upscaleImageWithDimensions, determineUpscaleStrategy } from '@/lib/replicate';
import { getServerCloudinary } from '@/lib/cloudinary';
import {
  buildRateLimitKey,
  checkRateLimit,
  createRateLimitResponse,
  enforceContentLengthLimit,
  resolveRateLimitPolicy,
} from '@/lib/rate-limit';
import {
  parseJsonWithSchema,
  upscaleRequestSchema,
} from '@/schemas/api';

export interface UpscaleRequestBody {
  /** URL of the image to upscale (Cloudinary or other public URL) */
  imageUrl: string;
  /** Source image width in pixels */
  sourceWidth: number;
  /** Source image height in pixels */
  sourceHeight: number;
  /** Target width in pixels (for print) */
  targetWidth: number;
  /** Target height in pixels (for print) */
  targetHeight: number;
  /** Optional: Upload result to Cloudinary and return permanent URL */
  uploadToCloudinary?: boolean;
}

export interface UpscaleResponse {
  /** URL of the upscaled image */
  upscaledUrl: string;
  /** Width after upscaling */
  width: number;
  /** Height after upscaling */
  height: number;
  /** Which model was used */
  model: string;
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Cloudinary public ID (if uploaded) */
  publicId?: string;
}

export async function POST(req: NextRequest) {
  const payloadTooLarge = enforceContentLengthLimit(req, 8 * 1024);
  if (payloadTooLarge) {
    return payloadTooLarge;
  }

  try {
    const authError = await requireAuth(req);
    if (authError) {
      return authError;
    }

    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    const rateLimitPolicy = resolveRateLimitPolicy('imagesUpscale', user);
    const rateLimit = await checkRateLimit(
      buildRateLimitKey('images:upscale', req, user.uid),
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

    const parsedBody = await parseJsonWithSchema(req, upscaleRequestSchema);
    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const body: UpscaleRequestBody = parsedBody.data;
    const {
      imageUrl,
      sourceWidth,
      sourceHeight,
      targetWidth,
      targetHeight,
      uploadToCloudinary = true,
    } = body;

    console.log(
      '[UPSCALE_REQUEST]',
      JSON.stringify({
        sourceWidth,
        sourceHeight,
        targetWidth,
        targetHeight,
        uploadToCloudinary,
        timestamp: new Date().toISOString(),
      })
    );

    const strategy = determineUpscaleStrategy(sourceWidth, sourceHeight, targetWidth, targetHeight);
    
    if (!strategy) {
      console.log('[UPSCALE_REQUEST] No upscaling needed');
      return NextResponse.json({
        upscaledUrl: imageUrl,
        width: sourceWidth,
        height: sourceHeight,
        model: 'none',
        processingTimeMs: 0,
      });
    }

    const result = await upscaleImageWithDimensions(
      imageUrl,
      sourceWidth,
      sourceHeight,
      targetWidth,
      targetHeight
    );

    let finalUrl = result.url;
    let publicId: string | undefined;

    if (uploadToCloudinary) {
      try {
        const cloudinary = await getServerCloudinary();
        
        const uploadResult = await cloudinary.uploader.upload(result.url, {
          folder: `modern-mosaics/${user.uid}/upscaled`,
          tags: ['modern-mosaics', 'upscaled', 'print-ready'],
          context: {
            source_url: imageUrl,
            source_width: sourceWidth.toString(),
            source_height: sourceHeight.toString(),
            target_width: targetWidth.toString(),
            target_height: targetHeight.toString(),
            upscale_model: result.model,
          },
        });

        finalUrl = uploadResult.secure_url;
        publicId = uploadResult.public_id;
      } catch (cloudinaryError: any) {
        console.error('[UPSCALE_REQUEST] Cloudinary upload failed:', cloudinaryError?.message || cloudinaryError);
      }
    }

    const response: UpscaleResponse = {
      upscaledUrl: finalUrl,
      width: result.width,
      height: result.height,
      model: result.model,
      processingTimeMs: result.processingTimeMs,
      ...(publicId && { publicId }),
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('[UPSCALE_REQUEST] Error:', error?.message || error);

    // Handle specific errors
    if (error.message?.includes('REPLICATE_API_TOKEN')) {
      return NextResponse.json(
        { error: 'Upscaling service not configured' },
        { status: 503 }
      );
    }

    if (error.message?.includes('rate limit') || error.message?.includes('429')) {
      return NextResponse.json(
        { error: 'Upscaling service is busy. Please try again in a moment.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'Upscaling failed. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/upscale
 * 
 * Returns info about the upscaling service
 */
export async function GET() {
  return NextResponse.json({
    service: 'Modern Mosaics Upscaling',
    models: {
      'clarity-8x': 'Best for AI art, up to 8x scale',
      'ultrasharp-4x': 'Fast, good quality, 4x scale',
      'ultrasharp-2x': 'Fast, good quality, 2x scale',
    },
    strategy: 'Automatic model selection based on required scale factor',
    limits: {
      maxScale: 16, // 8x + 2x chain
      maxTargetPixels: 100_000_000, // ~10K x 10K
    },
  });
}
