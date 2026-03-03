/**
 * Image Provider Factory
 * 
 * Unified entry point for image generation across multiple providers.
 * Use this module instead of calling providers directly.
 */

import type { GenerateImageRequest, GeneratedImage, ImageProviderName } from './types';
import { generateWithOpenAI, generateMultipleWithOpenAI } from './openai';
import { generateWithGemini, generateMultipleWithGemini } from './gemini';

// Re-export types for convenience
export type { GenerateImageRequest, GeneratedImage, ImageProviderName, AspectRatio } from './types';
export { PROVIDER_CONFIG, ASPECT_RATIO_DIMENSIONS } from './types';

/**
 * Generate an image using the specified provider
 * 
 * @param request - Generation request with provider, prompt, and options
 * @returns Generated image with base64 data
 * 
 * @example
 * ```typescript
 * const image = await generateImage({
 *   provider: 'gemini',
 *   prompt: 'A serene mountain landscape at sunset',
 *   aspectRatio: '4:5',
 * });
 * 
 * // Use the base64 data
 * const dataUrl = `data:${image.mimeType};base64,${image.base64}`;
 * ```
 */
export async function generateImage(request: GenerateImageRequest): Promise<GeneratedImage> {
  const { provider, ...rest } = request;

  console.log(`[ImageProvider] Generating with provider: ${provider}`);

  switch (provider) {
    case 'openai':
      return generateWithOpenAI(rest);

    case 'gemini':
      return generateWithGemini(rest);

    default:
      throw new Error(`Unknown image provider: ${provider}`);
  }
}

/**
 * Generate multiple images using the specified provider
 * 
 * @param request - Generation request
 * @param count - Number of images to generate
 * @returns Array of generated images
 */
export async function generateMultipleImages(
  request: GenerateImageRequest,
  count: number
): Promise<GeneratedImage[]> {
  const { provider, ...rest } = request;

  console.log(`[ImageProvider] Generating ${count} images with provider: ${provider}`);

  switch (provider) {
    case 'openai':
      return generateMultipleWithOpenAI(rest, count);

    case 'gemini':
      return generateMultipleWithGemini(rest, count);

    default:
      throw new Error(`Unknown image provider: ${provider}`);
  }
}

/**
 * Check if a provider is available (has required env vars)
 */
export function isProviderAvailable(provider: ImageProviderName): boolean {
  switch (provider) {
    case 'openai':
      return !!process.env.OPENAI_API_KEY;

    case 'gemini':
      return !!process.env.GEMINI_API_KEY;

    default:
      return false;
  }
}

/**
 * Get list of available providers
 */
export function getAvailableProviders(): ImageProviderName[] {
  const providers: ImageProviderName[] = ['openai', 'gemini'];
  return providers.filter(isProviderAvailable);
}

/**
 * Convert GeneratedImage to a data URL for display
 */
export function toDataUrl(image: GeneratedImage): string {
  return `data:${image.mimeType};base64,${image.base64}`;
}

/**
 * Get raw base64 string (without data: prefix) from GeneratedImage
 */
export function toBase64(image: GeneratedImage): string {
  return image.base64;
}



