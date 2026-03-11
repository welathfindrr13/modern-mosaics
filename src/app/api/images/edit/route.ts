import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { generateImage } from '../../../../lib/openai';
import { requireAuth, getAuthenticatedUser } from '@/lib/api-auth';
import sharp from 'sharp';
import crypto from 'crypto';
import {
  buildRateLimitKey,
  checkRateLimit,
  createPayloadTooLargeResponse,
  createRateLimitResponse,
  enforceContentLengthLimit,
  getRateLimitHeaders,
  resolveRateLimitPolicy,
} from '@/lib/rate-limit';

// =============================================================================
// RELIABILITY: Timeout protection for edit route
// 
// Investigation found this route had NO timeout - could hang forever.
// Edit operations with multiple variants can be particularly slow.
// =============================================================================
const OPENAI_TIMEOUT_MS = 65_000; // 65s timeout for single edit
const OPENAI_MULTI_TIMEOUT_MS = 90_000; // 90s for multiple variants (3 parallel calls)
const MAX_MULTIPART_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_FILE_BYTES = 8 * 1024 * 1024;
const MAX_MASK_FILE_BYTES = 4 * 1024 * 1024;
const MAX_PROMPT_LENGTH = 2_000;

function generateRequestId(): string {
  return crypto.randomBytes(8).toString('hex');
}

function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => {
        const err = new Error(`${operation} timed out after ${ms / 1000}s`);
        (err as any).isTimeout = true;
        reject(err);
      }, ms)
    )
  ]);
}

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  const requestStart = Date.now();
  const payloadTooLarge = enforceContentLengthLimit(req, MAX_MULTIPART_BYTES);
  if (payloadTooLarge) {
    return payloadTooLarge;
  }
  
  console.log(`[Edit] [${requestId}] API called`);
  
  try {
    // Verify user is authenticated
    const authStart = Date.now();
    const authError = await requireAuth(req);
    if (authError) {
      return authError;
    }
    
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', requestId }, { status: 401 });
    }

    const rateLimitPolicy = resolveRateLimitPolicy('imagesEdit', user);
    const rateLimit = await checkRateLimit(
      buildRateLimitKey('images:edit', req, user.uid),
      rateLimitPolicy.limit,
      rateLimitPolicy.windowMs
    );
    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimitPolicy.message,
        rateLimit,
        {
          requestId,
          ...rateLimitPolicy.body,
        }
      );
    }

    const authDuration = Date.now() - authStart;
    console.log(`[Edit] [${requestId}] Auth complete: ${authDuration}ms`);

    // Get parameters from multipart form data
    const formData = await req.formData();
    
    const prompt = formData.get('prompt') as string;
    const image = formData.get('image') as File;
    const mask = formData.get('mask') as File | undefined;
    const generateMultiple = formData.get('generateMultiple') as string;
    
    const promptLength = prompt?.length || 0;
    
    if (!prompt) {
      console.log(`[Edit] [${requestId}] Error: No prompt provided`);
      return NextResponse.json(
        { error: 'Prompt is required', requestId },
        { status: 400 }
      );
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: 'Prompt must be 2000 characters or fewer', requestId },
        { status: 400 }
      );
    }
    
    if (!image) {
      console.log(`[Edit] [${requestId}] Error: No image provided`);
      return NextResponse.json(
        { error: 'Image is required for editing', requestId },
        { status: 400 }
      );
    }

    if (!(image instanceof File) || image.size <= 0) {
      return NextResponse.json(
        { error: 'Image file is invalid', requestId },
        { status: 400 }
      );
    }

    if (!image.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Image must be an image file', requestId },
        { status: 400 }
      );
    }

    if (image.size > MAX_IMAGE_FILE_BYTES) {
      return createPayloadTooLargeResponse(MAX_IMAGE_FILE_BYTES);
    }

    if (mask) {
      if (!(mask instanceof File) || mask.size <= 0) {
        return NextResponse.json(
          { error: 'Mask file is invalid', requestId },
          { status: 400 }
        );
      }

      if (!mask.type.startsWith('image/')) {
        return NextResponse.json(
          { error: 'Mask must be an image file', requestId },
          { status: 400 }
        );
      }

      if (mask.size > MAX_MASK_FILE_BYTES) {
        return createPayloadTooLargeResponse(MAX_MASK_FILE_BYTES);
      }
    }
    
    // OBSERVABILITY: Log metadata, not content
    const count = generateMultiple === 'true' ? 3 : 1;
    console.log(`[Edit] [${requestId}] promptLength: ${promptLength}, imageSize: ${image.size}, count: ${count}`);

    // Resize image to 512x512
    const resizeStart = Date.now();
    const imageBuffer = await image.arrayBuffer();
    const resizedImageBuffer = await sharp(imageBuffer)
      .resize(512, 512, { fit: 'cover' })
      .png()
      .toBuffer();
    
    const resizedImage = new File([resizedImageBuffer], 'resized-image.png', { 
      type: 'image/png' 
    });
    
    const resizeDuration = Date.now() - resizeStart;
    console.log(`[Edit] [${requestId}] Image resized: ${resizeDuration}ms (${image.size} → ${resizedImageBuffer.length} bytes)`);
    
    // RELIABILITY: Generate with timeout protection
    // Use longer timeout for multiple variants (3 parallel OpenAI calls)
    const timeoutMs = count > 1 ? OPENAI_MULTI_TIMEOUT_MS : OPENAI_TIMEOUT_MS;
    const openaiStart = Date.now();
    console.log(`[Edit] [${requestId}] Starting OpenAI edit (timeout: ${timeoutMs}ms)...`);
    
    const raw = await withTimeout(
      generateImage({ 
        prompt, 
        mode: "edit", 
        image: resizedImage, 
        mask: mask || undefined,
        count,
        quality: 'standard'
      }),
      timeoutMs,
      'OpenAI edit'
    );
    
    const openaiDuration = Date.now() - openaiStart;
    const totalDuration = Date.now() - requestStart;
    
    // Handle response based on whether we generated single or multiple images
    if (count > 1 && Array.isArray(raw)) {
      console.log(`[Edit] [${requestId}] Complete: ${totalDuration}ms (auth: ${authDuration}ms, resize: ${resizeDuration}ms, openai: ${openaiDuration}ms) - ${raw.length} variants`);
      return NextResponse.json(
        { variants: raw, requestId },
        { status: 200, headers: getRateLimitHeaders(rateLimit) }
      );
    } else {
      const imageUrl = Array.isArray(raw) ? raw[0] : raw;
      console.log(`[Edit] [${requestId}] Complete: ${totalDuration}ms (auth: ${authDuration}ms, resize: ${resizeDuration}ms, openai: ${openaiDuration}ms)`);
      return NextResponse.json(
        { imageUrl, requestId },
        { status: 200, headers: getRateLimitHeaders(rateLimit) }
      );
    }
    
  } catch (error: any) {
    const totalDuration = Date.now() - requestStart;
    const isTimeout = error.isTimeout === true || error.message?.includes('timed out');
    
    console.error(`[Edit] [${requestId}] Error after ${totalDuration}ms:`, error.message ?? error);
    
    let errorMessage = error.message || "Failed to edit image";
    let statusCode = 500;
    
    // Handle timeout
    if (isTimeout) {
      errorMessage = "The AI is taking longer than usual. Please try again.";
      statusCode = 408;
    }
    
    // Check for content policy violation
    else if (errorMessage.includes("content policy") || 
        errorMessage.includes("policy") || 
        errorMessage.includes("filtered")) {
      errorMessage = "Your prompt was flagged by the content filter. Please try a different prompt.";
      statusCode = 400;
    }
    
    // Check for rate limits
    else if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
      errorMessage = "Too many requests. Please wait a moment and try again.";
      statusCode = 429;
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      requestId,
    }, { status: statusCode });
  }
}
