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
  console.log('[Upscale API] Request received');

  try {
    // Verify authentication
    const authError = await requireAuth(req);
    if (authError) {
      return authError;
    }

    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    // Parse request body
    const body: UpscaleRequestBody = await req.json();
    const {
      imageUrl,
      sourceWidth,
      sourceHeight,
      targetWidth,
      targetHeight,
      uploadToCloudinary = true,
    } = body;

    // Validate required fields
    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 });
    }
    if (!sourceWidth || !sourceHeight) {
      return NextResponse.json({ error: 'sourceWidth and sourceHeight are required' }, { status: 400 });
    }
    if (!targetWidth || !targetHeight) {
      return NextResponse.json({ error: 'targetWidth and targetHeight are required' }, { status: 400 });
    }

    console.log(`[Upscale API] User: ${user.email}`);
    console.log(`[Upscale API] Source: ${sourceWidth}x${sourceHeight}, Target: ${targetWidth}x${targetHeight}`);

    // Check if upscaling is actually needed
    const strategy = determineUpscaleStrategy(sourceWidth, sourceHeight, targetWidth, targetHeight);
    
    if (!strategy) {
      console.log('[Upscale API] No upscaling needed, returning original');
      return NextResponse.json({
        upscaledUrl: imageUrl,
        width: sourceWidth,
        height: sourceHeight,
        model: 'none',
        processingTimeMs: 0,
      });
    }

    // Perform upscaling
    console.log('[Upscale API] Starting upscale...');
    const result = await upscaleImageWithDimensions(
      imageUrl,
      sourceWidth,
      sourceHeight,
      targetWidth,
      targetHeight
    );

    console.log(`[Upscale API] Upscale complete: ${result.width}x${result.height} in ${result.processingTimeMs}ms`);

    let finalUrl = result.url;
    let publicId: string | undefined;

    // Upload to Cloudinary for permanent storage
    if (uploadToCloudinary) {
      console.log('[Upscale API] Uploading to Cloudinary...');
      
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
        
        console.log(`[Upscale API] Uploaded to Cloudinary: ${publicId}`);
      } catch (cloudinaryError: any) {
        console.error('[Upscale API] Cloudinary upload failed:', cloudinaryError);
        // Return Replicate URL if Cloudinary fails (it's temporary but usable)
        console.log('[Upscale API] Returning Replicate URL instead');
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
    console.error('[Upscale API] Error:', error);

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
      { error: `Upscaling failed: ${error.message}` },
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
