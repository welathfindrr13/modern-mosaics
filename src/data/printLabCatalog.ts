/**
 * Print Lab Catalog - Single Source of Truth
 * 
 * This file defines all supported product types, sizes, prices, and SKU resolution.
 * UI components should use this catalog exclusively for product selection.
 * 
 * IMPORTANT: DO NOT import raw Gelato SKU lists here. All SKUs must be curated
 * and verified to work end-to-end (checkout → Gelato order creation).
 */

import gelatoPosterSkus from './gelatoPosterSkus';

// =============================================================================
// TYPES
// =============================================================================

export type ProductType = 'poster' | 'canvas';
// NOTE: 'fine_art' disabled - Gelato doesn't support archival paper SKU format
// NOTE: 'framed' intentionally excluded until end-to-end support exists

export type SizeKey = '12x16' | '16x20' | '18x24' | '8x10';

export interface SizeOption {
  key: SizeKey;
  label: string;        // Display label e.g., "12×16″"
  priceGBP: number;     // VAT-inclusive MSRP in GBP
}

export interface ProductConfig {
  type: ProductType;
  title: string;
  shortDescription: string;
  bullets: string[];
  icon: string;
  sizes: SizeOption[];
}

export interface PrintLabSelection {
  productType: ProductType;
  sizeKey: SizeKey;
}

// =============================================================================
// CATALOG DEFINITION
// =============================================================================

export const PRINT_LAB_CATALOG: Record<ProductType, ProductConfig> = {
  poster: {
    type: 'poster',
    title: 'Premium Poster',
    shortDescription: 'Lightweight, affordable, perfect for gifts and everyday walls.',
    bullets: [
      '170gsm premium matte paper',
      'Fade-resistant archival inks (designed to last decades indoors)',
      'Ready to frame or mount',
      'Shipped in protective packaging to prevent bends and damage',
    ],
    icon: '📄',
    sizes: [
      { key: '12x16', label: '12×16″', priceGBP: 26.99 },
      { key: '16x20', label: '16×20″', priceGBP: 31.99 },
      { key: '18x24', label: '18×24″', priceGBP: 37.99 },
    ],
  },
  
  canvas: {
    type: 'canvas',
    title: 'Gallery Canvas',
    shortDescription: 'Stretched and ready to hang, designed for statement wall art.',
    bullets: [
      'Premium cotton canvas with gallery-wrap edges',
      'FSC-certified solid wood stretcher bars',
      '0.8″ slim frame depth (approx. 20mm)',
      'Ready to hang — mounting hardware included',
      'Fade-resistant archival inks (designed to last decades indoors)',
      'Packaged with reinforced protection for safe delivery',
    ],
    icon: '🖼️',
    sizes: [
      { key: '8x10', label: '8×10″', priceGBP: 34.99 },
      { key: '12x16', label: '12×16″', priceGBP: 49.99 },
      { key: '16x20', label: '16×20″', priceGBP: 59.99 },
    ],
  },
};

// =============================================================================
// SKU RESOLUTION
// =============================================================================

/**
 * SKU UID patterns - VERIFIED with Gelato Quote API
 * Maps (productType, sizeKey) -> Gelato SKU UID
 * 
 * Last verified: Jan 2026
 */
const SKU_MAP: Record<ProductType, Record<SizeKey, string | null>> = {
  poster: {
    '8x10': null, // Not available for poster
    '12x16': 'flat_300x400-mm-12x16-inch_170-gsm-65lb-uncoated_4-0_ver', // ✅ VERIFIED
    '16x20': 'flat_400x500-mm-16x20-inch_170-gsm-65lb-uncoated_4-0_ver', // ✅ VERIFIED
    '18x24': 'flat_450x600-mm-18x24-inch_170-gsm-65lb-uncoated_4-0_ver', // ✅ VERIFIED
  },
  canvas: {
    // ✅ VERIFIED with Gelato Quote API - correct SKU format (FSC-certified slim frame)
    '8x10': 'canvas_200x250-mm-8x10-inch_canvas_wood-fsc-slim_4-0_ver',   // ✅ VERIFIED
    '12x16': 'canvas_12x16-inch-300x400-mm_canvas_wood-fsc-slim_4-0_ver', // ✅ VERIFIED
    '16x20': 'canvas_16x20-inch-400x500-mm_canvas_wood-fsc-slim_4-0_ver', // ✅ VERIFIED
    '18x24': null, // Too large for AI-generated images
  },
};

/**
 * Resolve a product selection to a Gelato SKU UID.
 * Returns null if the combination is not supported.
 * 
 * @param selection - The product type and size selection
 * @returns Gelato SKU UID or null if invalid
 */
export function resolveSkuUid(selection: PrintLabSelection): string | null {
  const { productType, sizeKey } = selection;
  
  const typeMap = SKU_MAP[productType];
  if (!typeMap) {
    console.warn(`[PrintLabCatalog] Unknown product type: ${productType}`);
    return null;
  }
  
  const skuUid = typeMap[sizeKey];
  if (!skuUid) {
    console.warn(`[PrintLabCatalog] No SKU for ${productType} at size ${sizeKey}`);
    return null;
  }
  
  // Verify SKU exists in curated list (sanity check)
  const exists = gelatoPosterSkus.some(sku => sku.uid === skuUid);
  if (!exists) {
    console.error(`[PrintLabCatalog] SKU ${skuUid} not found in gelatoPosterSkus - catalog mismatch!`);
    return null;
  }
  
  return skuUid;
}

/**
 * Get the price for a product selection.
 * Returns null if the combination is not supported.
 */
export function getPrice(selection: PrintLabSelection): number | null {
  const config = PRINT_LAB_CATALOG[selection.productType];
  if (!config) return null;
  
  const sizeOption = config.sizes.find(s => s.key === selection.sizeKey);
  return sizeOption?.priceGBP ?? null;
}

/**
 * Get all supported product types (those with at least one resolvable SKU).
 */
export function getSupportedProductTypes(): ProductType[] {
  return (Object.keys(PRINT_LAB_CATALOG) as ProductType[]).filter(type => {
    const config = PRINT_LAB_CATALOG[type];
    return config.sizes.some(size => resolveSkuUid({ productType: type, sizeKey: size.key }) !== null);
  });
}

/**
 * Get available sizes for a product type (only those with resolvable SKUs).
 */
export function getAvailableSizes(productType: ProductType): SizeOption[] {
  const config = PRINT_LAB_CATALOG[productType];
  if (!config) return [];
  
  return config.sizes.filter(size => 
    resolveSkuUid({ productType, sizeKey: size.key }) !== null
  );
}

/**
 * Validate that a selection can be fulfilled.
 */
export function isValidSelection(selection: PrintLabSelection): boolean {
  return resolveSkuUid(selection) !== null;
}
