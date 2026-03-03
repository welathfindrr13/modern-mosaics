/**
 * Image Provider Abstraction Types
 * 
 * Unified interface for multiple image generation providers (OpenAI, Gemini, Flux, etc.)
 */

/**
 * Supported image generation providers
 */
export type ImageProviderName = 'openai' | 'gemini';

/**
 * Supported aspect ratios for image generation
 */
export type AspectRatio = '1:1' | '4:5' | '2:3' | '3:4' | '16:9' | '9:16';

/**
 * Request to generate an image
 */
export interface GenerateImageRequest {
  /** Which provider to use */
  provider: ImageProviderName;
  /** Text prompt describing the image */
  prompt: string;
  /** Desired aspect ratio (default: '1:1') */
  aspectRatio?: AspectRatio;
  /** Number of images to generate (default: 1) */
  count?: number;
}

/**
 * Result from image generation
 */
export interface GeneratedImage {
  /** Which provider generated this image */
  provider: ImageProviderName;
  /** Raw base64 image data (without data: prefix) */
  base64: string;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** MIME type of the image */
  mimeType: string;
}

/**
 * Provider-specific configuration
 */
export interface ProviderConfig {
  openai: {
    model: string;
    maxSize: string;
  };
  gemini: {
    model: string;
    maxSize: string;
  };
}

/**
 * Default provider configuration
 */
export const PROVIDER_CONFIG: ProviderConfig = {
  openai: {
    model: 'gpt-image-1.5',
    maxSize: '1024x1024',
  },
  gemini: {
    model: 'gemini-2.0-flash-preview-image-generation',
    maxSize: '2048x2048', // Gemini supports larger images
  },
};

/**
 * Map aspect ratio to approximate dimensions
 */
export const ASPECT_RATIO_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '4:5': { width: 1024, height: 1280 },
  '2:3': { width: 1024, height: 1536 },
  '3:4': { width: 1024, height: 1365 },
  '16:9': { width: 1024, height: 576 },
  '9:16': { width: 576, height: 1024 },
};



