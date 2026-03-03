/**
 * OpenAI Image Provider
 * 
 * Generates images using OpenAI's gpt-image-1 model.
 * Refactored from the original src/lib/openai.ts
 * 
 * RELIABILITY: OpenAI SDK configured with explicit timeout to prevent indefinite hangs.
 * Investigation showed default SDK has no timeout, causing requests to hang forever
 * when OpenAI is unresponsive.
 */

import OpenAI from 'openai';
import type { GenerateImageRequest, GeneratedImage } from './types';

// =============================================================================
// RELIABILITY: OpenAI SDK timeout configuration
// 
// The SDK timeout ensures the HTTP request itself is cancelled after the deadline,
// not just racing with a timer that leaves the request running in the background.
// 
// - timeout: 65s (matches server-side wrapper, ensures real cancellation)
// - maxRetries: 0 (no automatic retries - we handle this at a higher level)
// =============================================================================
const OPENAI_SDK_TIMEOUT_MS = 65_000;
const OPENAI_MAX_RETRIES = 0;

// Cached client instance
let openaiClient: OpenAI | null = null;

// Initialize OpenAI client with timeout configuration
function getOpenAIClient(): OpenAI {
  if (openaiClient) {
    return openaiClient;
  }
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY environment variable');
  }
  
  // RELIABILITY: Configure SDK with explicit timeout and no auto-retries
  openaiClient = new OpenAI({ 
    apiKey,
    timeout: OPENAI_SDK_TIMEOUT_MS,
    maxRetries: OPENAI_MAX_RETRIES,
  });
  
  return openaiClient;
}

/**
 * Generate an image using OpenAI's gpt-image-1 model
 * 
 * @param request - Generation request with prompt and options
 * @returns Generated image with base64 data
 */
export async function generateWithOpenAI(
  request: Omit<GenerateImageRequest, 'provider'>
): Promise<GeneratedImage> {
  const { prompt, count = 1 } = request;

  if (!prompt) {
    throw new Error('Prompt is required');
  }

  console.log(`[OpenAI] Generating image with prompt: ${prompt.substring(0, 100)}...`);

  const openai = getOpenAIClient();

  try {
    // gpt-image-1 only supports n=1, so we make a single call
    // (Multiple images would require multiple calls, handled at a higher level)
    const response = await openai.images.generate({
      model: 'gpt-image-1.5',
      prompt,
      n: 1,
      size: '1024x1024',
      // gpt-image-1 always returns base64
    });

    console.log('[OpenAI] Generation successful');

    const item = response.data?.[0];
    const b64Data = item?.b64_json;

    if (!b64Data) {
      throw new Error('No image data returned from OpenAI');
    }

    return {
      provider: 'openai',
      base64: b64Data, // Raw base64, no data: prefix
      width: 1024,
      height: 1024,
      mimeType: 'image/png',
    };
  } catch (error: any) {
    console.error('[OpenAI] Generation error:', error);

    // Handle specific OpenAI errors
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;

      console.error('[OpenAI] Response status:', status);
      console.error('[OpenAI] Error details:', JSON.stringify(errorData, null, 2));

      // Check for content policy violation
      if (
        error.message?.includes('content policy') ||
        error.message?.includes('policy') ||
        error.message?.includes('filtered')
      ) {
        throw new Error(
          'Your prompt was flagged by OpenAI\'s content filter. ' +
          'Please try a more detailed, neutral prompt.'
        );
      }
    }

    throw error;
  }
}

/**
 * Generate multiple images using OpenAI (makes parallel calls)
 * 
 * @param request - Generation request
 * @param count - Number of images to generate
 * @returns Array of generated images
 */
export async function generateMultipleWithOpenAI(
  request: Omit<GenerateImageRequest, 'provider'>,
  count: number
): Promise<GeneratedImage[]> {
  console.log(`[OpenAI] Generating ${count} images in parallel`);

  const promises = Array.from({ length: count }, () =>
    generateWithOpenAI(request)
  );

  const results = await Promise.all(promises);
  console.log(`[OpenAI] Successfully generated ${results.length} images`);

  return results;
}



