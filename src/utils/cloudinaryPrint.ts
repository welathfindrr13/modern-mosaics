import { PrintSizeKey, getDimensions, getDimensionsFromSizeKey } from './printSizes';
import type { SizeKey } from '@/data/printLabCatalog';

// =============================================================================
// CROP PARAMS TYPE (shared with OrderClient)
// Normalized crop coordinates (0-1 range relative to source image)
// =============================================================================
export interface CropParams {
  x: number       // Left edge (0-1)
  y: number       // Top edge (0-1)
  width: number   // Crop width (0-1)
  height: number  // Crop height (0-1)
  rotation?: 0 | 90 | 180 | 270
}

/**
 * Build Cloudinary crop transform string from normalized params
 * Returns empty string if params invalid
 */
export function buildCropTransform(
  cropParams: CropParams,
  sourceWidth: number,
  sourceHeight: number
): string {
  const px_x = Math.round(sourceWidth * cropParams.x)
  const px_y = Math.round(sourceHeight * cropParams.y)
  const px_w = Math.round(sourceWidth * cropParams.width)
  const px_h = Math.round(sourceHeight * cropParams.height)
  
  let transform = ''
  if (cropParams.rotation) {
    transform += `a_${cropParams.rotation}/`
  }
  transform += `c_crop,x_${px_x},y_${px_y},w_${px_w},h_${px_h}/`
  
  return transform
}

// =============================================================================
// DETERMINISTIC ENHANCEMENT TRANSFORMS
// 
// These mappings MUST match the PHOTO_ENHANCEMENTS in create/page.tsx exactly.
// They are used to apply user-selected enhancements to print URLs.
// 
// CRITICAL: These are Cloudinary transforms only - NO AI, NO generative processing.
// Identity drift is mathematically impossible with these transforms.
// =============================================================================
const PRINT_ENHANCEMENTS: Record<string, string> = {
  enhance: 'e_improve',
  warmer: 'e_tint:40:orange',
  cooler: 'e_tint:40:blue',
  brighter: 'e_brightness:20',
  sharper: 'e_sharpen:100',
  denoise: 'e_noise_reduction:80',
};

/**
 * Generate Gelato-ready print URLs using Cloudinary transformations
 * 
 * URL format (deterministic, no branching):
 *   https://res.cloudinary.com/<cloud>/image/upload/[enhancements/]c_scale,w_<w>,h_<h>/q_90/f_jpg/<publicId>
 * 
 * Constraints enforced:
 *   - Output: JPEG only (f_jpg) — PDF/PNG exceed Cloudinary's 10MB limit at print dimensions
 *   - No AI transforms (e_upscale removed) — requires paid add-on, returns 401
 *   - No fl_srgb (invalid syntax) — was causing HTTP 400
 *   - Quality: q_90 (explicit, not auto) — keeps file under 10MB
 *   - Scaling: c_scale with exact print dimensions
 *   - Enhancements: Optional deterministic Cloudinary transforms (e_improve, e_tint, etc.)
 * 
 * @param publicId - Cloudinary public ID
 * @param size - Print size key (determines dimensions)
 * @param transforms - Optional comma-separated enhancement keys (e.g., "enhance,sharper,brighter")
 * @param cloud - Cloudinary cloud name (defaults to env var)
 */
export function makeCloudinaryPrintUrl(
  publicId: string,
  size: PrintSizeKey,
  transforms?: string,
  cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!,
): string {
  if (!cloud) {
    throw new Error('Missing NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME environment variable');
  }

  const { w, h } = getDimensions(size);
  
  // Build enhancement transform string if provided
  // Order: enhancements → scale → quality → format
  let enhancementTransforms = '';
  if (transforms) {
    enhancementTransforms = transforms
      .split(',')
      .map(key => PRINT_ENHANCEMENTS[key.trim()])
      .filter(Boolean)
      .join('/');
    if (enhancementTransforms) {
      enhancementTransforms += '/';
    }
  }
  
  // Deterministic URL: [enhancements/] scale to print dimensions, quality 90, JPEG output
  const url = `https://res.cloudinary.com/${cloud}/image/upload/${enhancementTransforms}c_scale,w_${w},h_${h}/q_90/f_jpg/${publicId}`;
  
  console.log(`Generated Gelato print URL for ${size} (${w}x${h})${transforms ? ` with transforms: ${transforms}` : ''}:`, url);
  
  return url;
}

/**
 * Generate print URL using sizeKey (new preferred method).
 * This avoids relying on full SKU UID strings for dimension lookup.
 * 
 * @param publicId - Cloudinary public ID
 * @param sizeKey - Simple size key like "12x16", "16x20", etc.
 * @param transforms - Optional comma-separated enhancement keys
 * @param cropParams - Optional crop params (normalized 0-1)
 * @param sourceWidth - Source image width (required if cropParams provided)
 * @param sourceHeight - Source image height (required if cropParams provided)
 * @param cloud - Cloudinary cloud name (defaults to env var)
 */
export function makeCloudinaryPrintUrlFromSizeKey(
  publicId: string,
  sizeKey: SizeKey,
  transforms?: string,
  cropParams?: CropParams,
  sourceWidth?: number,
  sourceHeight?: number,
  cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!,
): string {
  if (!cloud) {
    throw new Error('Missing NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME environment variable');
  }

  const { w, h } = getDimensionsFromSizeKey(sizeKey);
  
  // 1. Build crop transform (if crop params + source dimensions available)
  let cropTransform = '';
  if (cropParams && sourceWidth && sourceHeight) {
    cropTransform = buildCropTransform(cropParams, sourceWidth, sourceHeight);
  }
  
  // 2. Build enhancement transform string if provided
  let enhancementTransforms = '';
  if (transforms) {
    enhancementTransforms = transforms
      .split(',')
      .map(key => PRINT_ENHANCEMENTS[key.trim()])
      .filter(Boolean)
      .join('/');
    if (enhancementTransforms) {
      enhancementTransforms += '/';
    }
  }
  
  // 3. Build final URL: crop → enhancements → scale → quality → format
  const url = `https://res.cloudinary.com/${cloud}/image/upload/${cropTransform}${enhancementTransforms}c_scale,w_${w},h_${h}/q_90/f_jpg/${publicId}`;
  
  console.log(`Generated print URL for sizeKey ${sizeKey} (${w}x${h})${cropParams ? ' with crop' : ''}${transforms ? ` with transforms: ${transforms}` : ''}:`, url);
  
  return url;
}

/**
 * Legacy function name for backward compatibility
 * @deprecated Use makeCloudinaryPrintUrl directly
 */
export function makeGelatoPrintUrl(
  publicId: string,
  size: PrintSizeKey,
  transforms?: string,
  cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!,
): string {
  return makeCloudinaryPrintUrl(publicId, size, transforms, cloud);
}

/**
 * Legacy function name for backward compatibility  
 * @deprecated Use makeCloudinaryPrintUrl directly
 */
export function printUrl(publicId: string, size: PrintSizeKey, transforms?: string): string {
  return makeCloudinaryPrintUrl(publicId, size, transforms);
}

/**
 * Legacy function name for backward compatibility
 * @deprecated Use makeCloudinaryPrintUrl directly (outputs JPEG, not PDF)
 */
export function printUrlPDF(publicId: string, size: PrintSizeKey, transforms?: string): string {
  return makeCloudinaryPrintUrl(publicId, size, transforms);
}

/**
 * Validate that a Cloudinary URL is accessible
 */
export async function validatePrintUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.error('Print URL validation failed:', error);
    return false;
  }
}

/**
 * Build a Gelato line item using the print URL generator
 * This is useful for creating Gelato order payloads
 */
export function makeGelatoLineItem(params: {
  publicId: string;
  sku: PrintSizeKey;
  quantity?: number;
  itemReferenceId?: string;
  transforms?: string;
}): {
  itemReferenceId: string;
  productUid: string;
  quantity: number;
  files: { type: string; url: string }[];
} {
  const { publicId, sku, quantity = 1, itemReferenceId = publicId, transforms } = params;
  
  return {
    itemReferenceId,
    productUid: typeof sku === 'string' && sku.includes('flat_') || sku.includes('canvas_') ? sku : sku,
    quantity,
    files: [
      {
        type: 'default',
        url: makeCloudinaryPrintUrl(publicId, sku, transforms),
      },
    ],
  };
}
