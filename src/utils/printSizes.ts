/**
 * Print size definitions with pixel dimensions including 4mm bleed at 300 DPI
 * This serves as the single source of truth for all print size calculations
 */

import type { ProductType, SizeKey } from '@/data/printLabCatalog';

/** Friendly keys for UI and existing code compatibility */
export const PRINT_SIZES = {  
  'poster-12x16': { w: 3694, h: 4894 },  
  'poster-16x20': { w: 4894, h: 6094 },  
  'poster-18x24': { w: 5494, h: 7294 },  
  'poster-24x36': { w: 7294, h: 10894 },  
  'canvas-8x10-slim':  { w: 3510, h: 4693 },  
  'canvas-12x16-slim': { w: 4407, h: 5740 },  
  'canvas-16x20-slim': { w: 4996, h: 6191 },  
  'canvas-16x20-thick': { w: 5134, h: 6323 },  
  'canvas-24x36-thick': { w: 7205, h: 10748 },  
} as const;

/** Full Gelato product UIDs mapped to exact pixel dimensions */
export const GELATO_SKU_DIMENSIONS = {
  // ==========================================================================
  // POSTERS - Matte (170gsm uncoated)
  // ==========================================================================
  'flat_300x400-mm-12x16-inch_170-gsm-65lb-uncoated_4-0_ver': { w: 3694, h: 4894 },
  'flat_400x500-mm-16x20-inch_170-gsm-65lb-uncoated_4-0_ver': { w: 4894, h: 6094 },
  'flat_450x600-mm-18x24-inch_170-gsm-65lb-uncoated_4-0_ver': { w: 5494, h: 7294 },
  'flat_600x900-mm-24x36-inch_170-gsm-65lb-uncoated_4-0_ver': { w: 7294, h: 10894 },
  
  // ==========================================================================
  // FINE ART PRINTS - Archival (200gsm archival paper)
  // Same physical dimensions as posters, same pixel requirements
  // ==========================================================================
  'flat_400x500-mm-16x20-inch_200-gsm-80lb-archival-paper_4-0_ver': { w: 4894, h: 6094 },
  'flat_450x600-mm-18x24-inch_200-gsm-80lb-archival-paper_4-0_ver': { w: 5494, h: 7294 },
  
  // ==========================================================================
  // CANVAS - Stretched (full Gelato UIDs from gelatoPosterSkus.ts)
  // ==========================================================================
  'canvas_200x250-mm-8x10-inch_fine-art-stretched_4-0_ver': { w: 3510, h: 4693 },
  'canvas_300x400-mm-12x16-inch_fine-art-stretched_4-0_ver': { w: 4407, h: 5740 },
  'canvas_400x500-mm-16x20-inch_fine-art-stretched_4-0_ver': { w: 4996, h: 6191 },
  'canvas_400x500-mm-16x20-inch_thick-frame-fine-art-stretched_4-0_ver': { w: 5134, h: 6323 },
  
  // Legacy short-form canvas keys (for backward compatibility)
  'canvas_8x10-inch_slim': { w: 3510, h: 4693 },
  'canvas_12x16-inch_slim': { w: 4407, h: 5740 },
  'canvas_16x20-inch_slim': { w: 4996, h: 6191 },
  'canvas_16x20-inch_thick': { w: 5134, h: 6323 },
  'canvas_24x36-inch_thick': { w: 7205, h: 10748 },
} as const;

// =============================================================================
// SIZE KEY BASED DIMENSIONS (new, recommended approach)
// =============================================================================

/**
 * Dimension lookup by simple size key (e.g., "12x16", "16x20")
 * These are the base dimensions at 300 DPI with 4mm bleed.
 * Same dimensions apply across product types for the same physical size.
 */
const SIZE_KEY_DIMENSIONS: Record<SizeKey, { w: number; h: number }> = {
  '8x10': { w: 3510, h: 4693 },
  '12x16': { w: 3694, h: 4894 },
  '16x20': { w: 4894, h: 6094 },
  '18x24': { w: 5494, h: 7294 },
};

/**
 * Get dimensions using sizeKey (new preferred method).
 * Works for all product types since physical dimensions are the same per size.
 * 
 * @param sizeKey - Size key like "12x16", "16x20", etc.
 * @returns Pixel dimensions { w, h } at 300 DPI with bleed
 * @throws Error if sizeKey is unknown
 */
export function getDimensionsFromSizeKey(sizeKey: SizeKey): { w: number; h: number } {
  const dims = SIZE_KEY_DIMENSIONS[sizeKey];
  if (!dims) {
    throw new Error(`Unknown size key: ${sizeKey}`);
  }
  return dims;
}

// Type definitions
export type FriendlyKey = keyof typeof PRINT_SIZES;
export type GelatoSku = keyof typeof GELATO_SKU_DIMENSIONS;
export type PrintSizeKey = FriendlyKey | GelatoSku;

/**
 * Get dimensions for any print size key (friendly or full SKU)
 */
export function getDimensions(size: PrintSizeKey): { w: number; h: number } {
  // First try Gelato SKU mapping
  const gelatoMatch = GELATO_SKU_DIMENSIONS[size as GelatoSku];
  if (gelatoMatch) return gelatoMatch;
  
  // Fall back to friendly key mapping
  const friendlyMatch = PRINT_SIZES[size as FriendlyKey];
  if (friendlyMatch) return friendlyMatch;
  
  throw new Error(`Unknown print size: ${size}`);
}

/**
 * Map friendly keys to full Gelato SKUs (for backward compatibility)
 */
export const FRIENDLY_TO_SKU_MAP: Record<FriendlyKey, GelatoSku> = {
  'poster-12x16': 'flat_300x400-mm-12x16-inch_170-gsm-65lb-uncoated_4-0_ver',
  'poster-16x20': 'flat_400x500-mm-16x20-inch_170-gsm-65lb-uncoated_4-0_ver',
  'poster-18x24': 'flat_450x600-mm-18x24-inch_170-gsm-65lb-uncoated_4-0_ver',
  'poster-24x36': 'flat_600x900-mm-24x36-inch_170-gsm-65lb-uncoated_4-0_ver',
  'canvas-8x10-slim': 'canvas_8x10-inch_slim',
  'canvas-12x16-slim': 'canvas_12x16-inch_slim',
  'canvas-16x20-slim': 'canvas_16x20-inch_slim',
  'canvas-16x20-thick': 'canvas_16x20-inch_thick',
  'canvas-24x36-thick': 'canvas_24x36-inch_thick',
};

/**
 * Convert friendly key to full Gelato SKU
 */
export function getGelatoSku(friendlyKey: FriendlyKey): GelatoSku {
  const sku = FRIENDLY_TO_SKU_MAP[friendlyKey];
  if (!sku) {
    throw new Error(`No Gelato SKU mapping found for: ${friendlyKey}`);
  }
  return sku;
}
