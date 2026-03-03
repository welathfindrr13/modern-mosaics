/**
 * Image Generation and Upload API Route
 * 
 * POST /api/images/generate-and-upload
 * 
 * Generates an image using the specified provider (OpenAI or Gemini)
 * and uploads it to Cloudinary for permanent storage.
 */

import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { generateImage, type ImageProviderName, isProviderAvailable } from '@/lib/image-providers';
import { requireAuth, getAuthenticatedUser } from '@/lib/api-auth';
import { uploadB64Stream } from '@/lib/cloudinary-upload';
import { adminImageOperations, adminUserOperations } from '@/utils/firestore-admin';
import crypto from 'crypto';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';

// =============================================================================
// RELIABILITY: Server-side timeout constants
// 
// TIMEOUT BUDGET (investigation-based):
// - Client deadline: 75s (hard abort via AbortController)
// - Server OpenAI timeout: 65s (must complete before client aborts)
// - Server Cloudinary timeout: 30s (upload typically fast)
// 
// Previous 45s OpenAI timeout caused ~10% false-positive timeouts.
// OpenAI gpt-image-1 can take 5-60s; 65s allows most legitimate requests to complete.
// =============================================================================
const OPENAI_TIMEOUT_MS = 65_000;     // 65s for AI generation (OpenAI can be slow)
const CLOUDINARY_TIMEOUT_MS = 30_000; // 30s for upload (should be fast)
const FIRESTORE_TIMEOUT_MS = 10_000;  // 10s for database writes

// Step names for error classification
type TimeoutStep = 'auth' | 'openai' | 'cloudinary' | 'firestore';

/**
 * Generate a unique request ID for correlation across logs
 */
function generateRequestId(): string {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * RELIABILITY: Wrap a promise with a timeout
 * If the promise doesn't resolve within the timeout, reject with a clear error
 */
function withTimeout<T>(promise: Promise<T>, ms: number, step: TimeoutStep): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => {
        const err = new Error(`${step} timed out after ${ms / 1000}s`);
        (err as any).step = step;
        (err as any).isTimeout = true;
        reject(err);
      }, ms)
    )
  ]);
}

/**
 * Create structured error response with step classification
 */
function createErrorResponse(
  requestId: string,
  message: string,
  step: TimeoutStep | 'validation' | 'unknown',
  statusCode: number,
  durations: Record<string, number>
) {
  return NextResponse.json({
    error: message,
    step,
    requestId,
    durations,
  }, { status: statusCode });
}

export interface GenerateAndUploadRequest {
  /** Text prompt for image generation */
  prompt: string;
  /** Which AI provider to use (default: 'openai') */
  provider?: ImageProviderName;
  /** Whether to save the image to the user's gallery (default: true) */
  saveToGallery?: boolean;
}

export interface GenerateAndUploadResponse {
  /** Cloudinary secure URL */
  imageUrl: string;
  /** Cloudinary public ID */
  publicId: string;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** Which provider generated the image */
  provider: ImageProviderName;
  /** Firestore image ID (if saved to gallery) */
  imageId?: string;
}

export async function POST(req: NextRequest) {
  // OBSERVABILITY: Generate request ID for log correlation
  const requestId = generateRequestId();
  const requestStart = Date.now();
  const durations: Record<string, number> = {};
  
  console.log(`[Generate+Upload] [${requestId}] API called`);
  
  try {
    // =========================================================================
    // STEP 1: Authentication
    // =========================================================================
    const authStart = Date.now();
    const authError = await requireAuth(req);
    if (authError) {
      durations.auth = Date.now() - authStart;
      console.log(`[Generate+Upload] [${requestId}] Auth failed after ${durations.auth}ms`);
      return authError;
    }
    
    const user = await getAuthenticatedUser(req);
    durations.auth = Date.now() - authStart;
    
    if (!user) {
      console.error(`[Generate+Upload] [${requestId}] User not found after ${durations.auth}ms`);
      return createErrorResponse(requestId, 'User not found', 'auth', 401, durations);
    }

    const rateLimit = checkRateLimit(`images:generate-upload:${user.uid}`, 10, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Too many image generation requests. Please wait and try again.',
          step: 'validation',
          requestId,
          durations,
        },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      );
    }
    console.log(`[Generate+Upload] [${requestId}] Auth complete: ${durations.auth}ms`);

    // =========================================================================
    // STEP 2: Parse and validate request
    // =========================================================================
    const body: GenerateAndUploadRequest = await req.json();
    const { 
      prompt, 
      provider = 'openai', 
      saveToGallery = true 
    } = body;
    
    // OBSERVABILITY: Log prompt length, not content (privacy)
    const promptLength = prompt?.length || 0;
    console.log(`[Generate+Upload] [${requestId}] Provider: ${provider}, promptLength: ${promptLength}`);
    
    if (!prompt) {
      return createErrorResponse(requestId, 'Prompt is required', 'validation', 400, durations);
    }

    if (provider !== 'openai' && provider !== 'gemini') {
      return createErrorResponse(requestId, `Invalid provider: ${provider}`, 'validation', 400, durations);
    }

    if (!isProviderAvailable(provider)) {
      return createErrorResponse(requestId, `Provider ${provider} is not configured`, 'validation', 503, durations);
    }

    // =========================================================================
    // STEP 3: Generate image with OpenAI (65s timeout)
    // =========================================================================
    const openaiStart = Date.now();
    console.log(`[Generate+Upload] [${requestId}] Starting image generation...`);
    
    const generatedImage = await withTimeout(
      generateImage({ provider, prompt }),
      OPENAI_TIMEOUT_MS,
      'openai'
    );
    
    durations.openai = Date.now() - openaiStart;
    console.log(`[Generate+Upload] [${requestId}] Image generated: ${generatedImage.width}x${generatedImage.height} in ${durations.openai}ms`);
    
    // =========================================================================
    // STEP 4: Upload to Cloudinary (30s timeout)
    // =========================================================================
    const cloudinaryStart = Date.now();
    console.log(`[Generate+Upload] [${requestId}] Starting Cloudinary upload...`);
    
    const uploadResult = await withTimeout(
      uploadB64Stream(user.uid, generatedImage.base64, {
        tags: ['modern-mosaics', 'generated-image', `provider-${provider}`],
        context: {
          provider: provider,
          save_to_gallery: saveToGallery ? 'true' : 'false'
        }
      }),
      CLOUDINARY_TIMEOUT_MS,
      'cloudinary'
    );
    
    durations.cloudinary = Date.now() - cloudinaryStart;
    console.log(`[Generate+Upload] [${requestId}] Uploaded to Cloudinary in ${durations.cloudinary}ms: ${uploadResult.public_id}`);
    
    // =========================================================================
    // STEP 5: Save to Firestore (10s timeout, non-blocking)
    // =========================================================================
    let imageId: string | undefined;

    if (saveToGallery && user.email) {
      const firestoreStart = Date.now();
      try {
        console.log(`[Generate+Upload] [${requestId}] Saving to Firestore...`);
        
        // RELIABILITY: Wrap Firestore writes with timeout to prevent hangs
        await withTimeout(
          adminUserOperations.createOrUpdate(user.uid, {
            email: user.email,
            firebaseUid: user.uid,
            displayName: user.name || user.email.split('@')[0],
            preferences: {
              currency: 'GBP',
              notifications: true
            }
          }),
          FIRESTORE_TIMEOUT_MS,
          'firestore'
        );
        
        imageId = await withTimeout(
          adminImageOperations.create(user.uid, {
            cloudinaryPublicId: uploadResult.public_id,
            cloudinaryUrl: uploadResult.secure_url,
            prompt: prompt,
            metadata: {
              width: uploadResult.width,
              height: uploadResult.height,
              format: uploadResult.format,
              bytes: uploadResult.bytes,
            },
            tags: ['generated', `provider-${provider}`]
          }),
          FIRESTORE_TIMEOUT_MS,
          'firestore'
        );
        
        durations.firestore = Date.now() - firestoreStart;
        console.log(`[Generate+Upload] [${requestId}] Saved to Firestore in ${durations.firestore}ms: ${imageId}`);
      } catch (firestoreError: any) {
        durations.firestore = Date.now() - firestoreStart;
        // RELIABILITY: Log but don't fail - Cloudinary upload was successful
        console.error(`[Generate+Upload] [${requestId}] Firestore save failed after ${durations.firestore}ms:`, firestoreError.message);
      }
    }
    
    // =========================================================================
    // SUCCESS RESPONSE
    // =========================================================================
    durations.total = Date.now() - requestStart;
    console.log(`[Generate+Upload] [${requestId}] Complete in ${durations.total}ms (auth: ${durations.auth}ms, openai: ${durations.openai}ms, cloudinary: ${durations.cloudinary}ms)`);
    
    const response: GenerateAndUploadResponse = {
      imageUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      width: uploadResult.width,
      height: uploadResult.height,
      provider,
      ...(imageId && { imageId }),
    };

    return NextResponse.json(response, { headers: getRateLimitHeaders(rateLimit) });
    
  } catch (error: any) {
    durations.total = Date.now() - requestStart;
    
    // OBSERVABILITY: Extract step from error if available
    const step: TimeoutStep | 'unknown' = error.step || 'unknown';
    const isTimeout = error.isTimeout === true;
    
    console.error(`[Generate+Upload] [${requestId}] Error at step "${step}" after ${durations.total}ms:`, error.message ?? error);
    
    let errorMessage = error.message || 'Failed to generate and upload image';
    let statusCode = 500;
    
    // RELIABILITY: Handle timeout errors with step classification
    if (isTimeout || errorMessage.includes('timed out')) {
      errorMessage = step === 'openai' 
        ? 'The AI is taking longer than usual. Please try again.'
        : step === 'cloudinary'
        ? 'Image upload is slow. Please try again.'
        : 'Request timed out. Please try again.';
      statusCode = 408; // Request Timeout (more accurate than 504)
    }
    
    // Handle provider-specific errors
    else if (errorMessage.includes('content policy') || 
        errorMessage.includes('safety') ||
        errorMessage.includes('filtered')) {
      errorMessage = 'Your prompt was flagged by the content filter. Please try a different prompt.';
      statusCode = 400;
    }
    
    // Handle rate limits
    else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      errorMessage = 'Too many requests. Please wait a moment and try again.';
      statusCode = 429;
    }
    
    // Handle missing API keys
    else if (errorMessage.includes('API_KEY') || errorMessage.includes('not configured')) {
      errorMessage = 'Image generation service is not properly configured.';
      statusCode = 503;
    }
    
    // Handle Cloudinary errors
    else if (errorMessage.includes('cloudinary') || errorMessage.includes('upload')) {
      errorMessage = 'Failed to save image. Please try again.';
      statusCode = 500;
    }
    
    return createErrorResponse(requestId, errorMessage, step, statusCode, durations);
  }
}

/**
 * GET /api/images/generate-and-upload
 * 
 * Returns info about available providers
 */
export async function GET() {
  const providers = {
    openai: {
      available: isProviderAvailable('openai'),
      model: 'gpt-image-1.5',
      description: 'OpenAI\'s image generation model',
    },
    gemini: {
      available: isProviderAvailable('gemini'),
      model: 'gemini-2.0-flash-preview-image-generation',
      description: 'Google\'s Gemini image generation model',
    },
  };

  return NextResponse.json({
    providers,
    default: 'openai',
  });
}
