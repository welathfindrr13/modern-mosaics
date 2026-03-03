/**
 * Replicate Upscaling Service
 * 
 * High-quality image upscaling using Replicate models.
 * Supports Clarity Upscaler (up to 8x) and UltraSharp/Real-ESRGAN (2x, 4x).
 */

import Replicate from 'replicate';

// ============================================================================
// Types
// ============================================================================

export type UpscaleModel = 'clarity-8x' | 'ultrasharp-4x' | 'ultrasharp-2x' | 'esrgan-4x';

export interface UpscaleStrategy {
  model: UpscaleModel;
  scale: number;
  /** For scales > 8x, chain another pass */
  chain?: UpscaleStrategy;
}

export interface UpscaleRequest {
  /** URL of the image to upscale */
  imageUrl: string;
  /** Target width in pixels */
  targetWidth: number;
  /** Target height in pixels */
  targetHeight: number;
}

export interface UpscaleResult {
  /** URL of the upscaled image (temporary Replicate URL) */
  url: string;
  /** Actual width after upscaling */
  width: number;
  /** Actual height after upscaling */
  height: number;
  /** Which model was used */
  model: UpscaleModel;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

// ============================================================================
// Model Configuration
// ============================================================================

/**
 * Replicate model identifiers
 * 
 * Clarity Upscaler: Best for AI-generated art, up to 8x
 * Real-ESRGAN: Fast, good for photos, 4x
 */
const REPLICATE_MODELS: Record<UpscaleModel, string> = {
  // Clarity Upscaler - best quality for AI art, supports up to 8x
  'clarity-8x': 'philz1337x/clarity-upscaler:dfad41707589d68ecdccd1dfa600571f95560153d5a21d74d29a8f0a13a60fe8',
  
  // Real-ESRGAN variants for faster processing
  'ultrasharp-4x': 'nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa',
  'ultrasharp-2x': 'nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa',
  
  // Legacy ESRGAN (fallback)
  'esrgan-4x': 'xinntao/esrgan:c263265e04b16fda1046d1828997fc27b46610647a3348df1c72fbffbdbac912',
};

// ============================================================================
// Client
// ============================================================================

let replicateInstance: Replicate | null = null;

function getReplicateClient(): Replicate {
  if (!replicateInstance) {
    const apiToken = process.env.REPLICATE_API_TOKEN;
    
    if (!apiToken) {
      throw new Error('REPLICATE_API_TOKEN is not defined in environment variables');
    }
    
    replicateInstance = new Replicate({ auth: apiToken });
    console.log('[Replicate] Client initialized');
  }
  
  return replicateInstance;
}

// ============================================================================
// Strategy Selection
// ============================================================================

/**
 * Determine the optimal upscaling strategy based on required scale factor
 * 
 * Rules (locked):
 * - Scale ≤2x → UltraSharp 2x
 * - Scale ≤4x → UltraSharp 4x  
 * - Scale ≤8x → Clarity 8x (single pass preferred)
 * - Scale >8x → Clarity 8x then UltraSharp 2x (max 2 models in chain)
 * - NEVER UltraSharp before Clarity
 * - NEVER more than 2 models in chain
 */
export function determineUpscaleStrategy(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): UpscaleStrategy | null {
  const widthRatio = targetWidth / sourceWidth;
  const heightRatio = targetHeight / sourceHeight;
  const requiredScale = Math.max(widthRatio, heightRatio);

  console.log(`[Replicate] Source: ${sourceWidth}x${sourceHeight}, Target: ${targetWidth}x${targetHeight}`);
  console.log(`[Replicate] Required scale factor: ${requiredScale.toFixed(2)}x`);

  // No upscaling needed
  if (requiredScale <= 1) {
    console.log('[Replicate] No upscaling needed');
    return null;
  }

  // Small upscale: UltraSharp 2x
  if (requiredScale <= 2) {
    return { model: 'ultrasharp-2x', scale: 2 };
  }

  // Medium upscale: UltraSharp 4x
  if (requiredScale <= 4) {
    return { model: 'ultrasharp-4x', scale: 4 };
  }

  // Large upscale: Clarity 8x (single pass)
  if (requiredScale <= 8) {
    return { model: 'clarity-8x', scale: 8 };
  }

  // Very large (>8x): Clarity 8x → UltraSharp 2x
  // This gives us up to 16x total scale
  console.log('[Replicate] Scale >8x, using chained upscaling');
  return {
    model: 'clarity-8x',
    scale: 8,
    chain: { model: 'ultrasharp-2x', scale: 2 },
  };
}

// ============================================================================
// Upscaling Functions
// ============================================================================

/**
 * Run a single upscale pass with specified model
 */
async function runUpscalePass(
  imageUrl: string,
  model: UpscaleModel,
  scale: number
): Promise<{ url: string; processingTimeMs: number }> {
  const startTime = Date.now();
  const replicate = getReplicateClient();
  const modelId = REPLICATE_MODELS[model];

  console.log(`[Replicate] Running ${model} at ${scale}x on: ${imageUrl.substring(0, 50)}...`);

  try {
    let output: any;

    if (model === 'clarity-8x') {
      // Clarity Upscaler has specific input format
      output = await replicate.run(modelId as `${string}/${string}:${string}`, {
        input: {
          image: imageUrl,
          scale_factor: scale,
          resemblance: 0.6, // Balance between detail and original
          creativity: 0.35,
          prompt: 'high quality, detailed, sharp',
          negative_prompt: 'blurry, low quality, artifacts',
        },
      });
    } else {
      // Real-ESRGAN / UltraSharp
      output = await replicate.run(modelId as `${string}/${string}:${string}`, {
        input: {
          image: imageUrl,
          scale: scale,
          face_enhance: false,
        },
      });
    }

    const processingTimeMs = Date.now() - startTime;
    console.log(`[Replicate] ${model} completed in ${processingTimeMs}ms`);

    // Extract URL from output
    let resultUrl: string;
    if (typeof output === 'string') {
      resultUrl = output;
    } else if (Array.isArray(output) && output.length > 0) {
      resultUrl = output[0];
    } else if (output && typeof output === 'object') {
      // Try to find URL in object
      const values = Object.values(output);
      const urlValue = values.find(v => typeof v === 'string' && v.startsWith('http'));
      if (urlValue) {
        resultUrl = urlValue as string;
      } else {
        throw new Error('Could not extract URL from Replicate response');
      }
    } else {
      throw new Error('Unexpected Replicate output format');
    }

    return { url: resultUrl, processingTimeMs };
  } catch (error: any) {
    console.error(`[Replicate] ${model} failed:`, error);
    throw error;
  }
}

/**
 * Upscale an image using the optimal strategy
 * 
 * @param request - Upscale request with image URL and target dimensions
 * @returns Upscaled image result
 */
export async function upscaleImage(request: UpscaleRequest): Promise<UpscaleResult> {
  const { imageUrl, targetWidth, targetHeight } = request;

  if (!imageUrl) {
    throw new Error('Image URL is required');
  }

  // For now, estimate source dimensions
  // In production, you'd want to fetch actual dimensions
  const estimatedSourceWidth = 1024;
  const estimatedSourceHeight = 1024;

  const strategy = determineUpscaleStrategy(
    estimatedSourceWidth,
    estimatedSourceHeight,
    targetWidth,
    targetHeight
  );

  if (!strategy) {
    // No upscaling needed, return original
    return {
      url: imageUrl,
      width: estimatedSourceWidth,
      height: estimatedSourceHeight,
      model: 'ultrasharp-2x', // placeholder
      processingTimeMs: 0,
    };
  }

  console.log(`[Replicate] Strategy: ${strategy.model} ${strategy.scale}x${strategy.chain ? ` → ${strategy.chain.model} ${strategy.chain.scale}x` : ''}`);

  // First pass
  const firstPass = await runUpscalePass(imageUrl, strategy.model, strategy.scale);
  let currentUrl = firstPass.url;
  let totalTime = firstPass.processingTimeMs;
  let currentWidth = estimatedSourceWidth * strategy.scale;
  let currentHeight = estimatedSourceHeight * strategy.scale;

  // Chain pass if needed
  if (strategy.chain) {
    const secondPass = await runUpscalePass(currentUrl, strategy.chain.model, strategy.chain.scale);
    currentUrl = secondPass.url;
    totalTime += secondPass.processingTimeMs;
    currentWidth *= strategy.chain.scale;
    currentHeight *= strategy.chain.scale;
  }

  return {
    url: currentUrl,
    width: currentWidth,
    height: currentHeight,
    model: strategy.chain ? strategy.chain.model : strategy.model,
    processingTimeMs: totalTime,
  };
}

/**
 * Upscale an image with explicit source dimensions
 */
export async function upscaleImageWithDimensions(
  imageUrl: string,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): Promise<UpscaleResult> {
  const strategy = determineUpscaleStrategy(
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight
  );

  if (!strategy) {
    return {
      url: imageUrl,
      width: sourceWidth,
      height: sourceHeight,
      model: 'ultrasharp-2x',
      processingTimeMs: 0,
    };
  }

  console.log(`[Replicate] Strategy: ${strategy.model} ${strategy.scale}x${strategy.chain ? ` → ${strategy.chain.model} ${strategy.chain.scale}x` : ''}`);

  // First pass
  const firstPass = await runUpscalePass(imageUrl, strategy.model, strategy.scale);
  let currentUrl = firstPass.url;
  let totalTime = firstPass.processingTimeMs;
  let currentWidth = sourceWidth * strategy.scale;
  let currentHeight = sourceHeight * strategy.scale;

  // Chain pass if needed
  if (strategy.chain) {
    const secondPass = await runUpscalePass(currentUrl, strategy.chain.model, strategy.chain.scale);
    currentUrl = secondPass.url;
    totalTime += secondPass.processingTimeMs;
    currentWidth *= strategy.chain.scale;
    currentHeight *= strategy.chain.scale;
  }

  return {
    url: currentUrl,
    width: currentWidth,
    height: currentHeight,
    model: strategy.chain ? strategy.chain.model : strategy.model,
    processingTimeMs: totalTime,
  };
}

// Legacy export for backwards compatibility
export { getReplicateClient };
