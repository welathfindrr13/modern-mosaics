/**
 * Curated list of Gelato poster and canvas products
 * VERIFIED WORKING - May 2025
 * Last updated: Based on successful quote response from Gelato API
 * 
 * SIZE LIMITS (Phase A):
 * - Maximum poster size: 18×24″ (for AI-generated images)
 * - Reason: AI upscaling above 8× produces soft/hallucinated details
 * - 24×36″ at 300DPI = 7200×10800px, requires too much upscaling from 1024px base
 * 
 * For larger sizes, consider:
 * - 150-200 DPI (viewing distance compensation)
 * - User-uploaded high-res images only
 */

// Maximum safe dimensions for AI-generated prints at 300 DPI
export const MAX_SAFE_POSTER = {
  width: 18, // inches
  height: 24, // inches
  dpi: 300,
  maxPixels: 18 * 24 * 300 * 300, // ~38.9 million pixels
  maxUpscale: 8, // 1024 * 8 = 8192px max after single-pass Clarity upscale
};

export default [
  // Matte Posters - CONFIRMED WORKING FORMAT
  // Smaller sizes - safe for AI generation
  { uid: "flat_300x400-mm-12x16-inch_170-gsm-65lb-uncoated_4-0_ver", name: "Poster – 12×16″ Premium Matte", recommended: true },
  { uid: "flat_400x500-mm-16x20-inch_170-gsm-65lb-uncoated_4-0_ver", name: "Poster – 16×20″ Premium Matte", recommended: true }, // ✅ VERIFIED via quote
  { uid: "flat_450x600-mm-18x24-inch_170-gsm-65lb-uncoated_4-0_ver", name: "Poster – 18×24″ Premium Matte", recommended: true },
  
  // REMOVED: 24×36″ - requires 7200×10800px which needs 16× upscale from 1024px base
  // { uid: "flat_600x900-mm-24x36-inch_170-gsm-65lb-uncoated_4-0_ver", name: "Poster – 24×36″ Premium Matte" },
  
  // Note: Glossy variants removed - not available with this SKU format
  
  // Canvas prints - Slim frame (FSC wood) - ✅ VERIFIED with Gelato Quote API Jan 2026
  { uid: "canvas_200x250-mm-8x10-inch_canvas_wood-fsc-slim_4-0_ver", name: "Canvas – 8×10″ Slim Frame", recommended: true },
  { uid: "canvas_12x16-inch-300x400-mm_canvas_wood-fsc-slim_4-0_ver", name: "Canvas – 12×16″ Slim Frame", recommended: true },
  { uid: "canvas_16x20-inch-400x500-mm_canvas_wood-fsc-slim_4-0_ver", name: "Canvas – 16×20″ Slim Frame", recommended: true },
  
  // REMOVED: Canvas thick frame and larger sizes - not needed for MVP
  // REMOVED: Fine art prints - Gelato doesn't support archival paper SKU format
];

/**
 * Product size validation
 * Returns true if the size is safe for AI-generated images
 */
export function isSizeSafeForAI(widthInches: number, heightInches: number, dpi: number = 300): boolean {
  const totalPixels = widthInches * dpi * heightInches * dpi;
  const maxPixels = MAX_SAFE_POSTER.maxPixels;
  
  // Also check if upscale would exceed 8× from 1024px base
  const requiredLongEdge = Math.max(widthInches, heightInches) * dpi;
  const maxSafeEdge = 1024 * MAX_SAFE_POSTER.maxUpscale; // 8192px
  
  return totalPixels <= maxPixels && requiredLongEdge <= maxSafeEdge;
}
