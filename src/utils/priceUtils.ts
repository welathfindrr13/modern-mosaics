/**
 * Price Utilities for Modern Mosaics
 * 
 * PRICING PHILOSOPHY (Updated January 2026):
 * ==========================================
 * 
 * We use MSRP-based pricing, NOT markup-based pricing.
 * 
 * WHY THIS MATTERS:
 * - Markup ≠ Margin. A 100% markup only yields 50% gross margin.
 * - Paid acquisition requires ~65% gross margin to support £10-30 CAC.
 * - Our previous markup-based system yielded ~40-50% margins = unprofitable ads.
 * 
 * FORMULAS:
 * - Markup: Price = Cost × (1 + markup%)     → 100% markup on £5 = £10
 * - Margin: Price = Cost / (1 - margin%)     → 65% margin on £5 = £14.29
 * 
 * APPROACH:
 * 1. MSRP_TABLE contains fixed VAT-inclusive retail prices (GBP)
 * 2. These prices target ~65% gross margin based on estimated landed costs
 * 3. A guardrail checks if actual Gelato costs would drop margin below 55%
 * 4. If guardrail fails: log error + flag for review (do NOT auto-adjust)
 * 
 * VAT HANDLING:
 * - All MSRP prices are VAT-INCLUSIVE (UK B2C standard)
 * - Use removeVAT() to get ex-VAT price for margin calculations
 * - NEVER add VAT to MSRP prices (they already include it)
 * 
 * @see https://dashboard.gelato.com/docs/orders/v4/create/
 * @see https://dashboard.gelato.com/docs/orders/v3/quote/
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

/** UK VAT rate (20%) - standard rate for goods */
export const UK_VAT_RATE = 0.20;

/** Stripe UK fees: 1.5% + 20p for UK-issued cards */
const STRIPE_PERCENTAGE = 0.015;
const STRIPE_FIXED_FEE = 0.20; // £0.20

/** 
 * Minimum gross margin threshold for SKU viability.
 * If actual margin falls below this, log a warning.
 * 55% allows some buffer below our 65% target.
 */
export const MIN_GROSS_MARGIN_GUARDRAIL = 0.55;

/** 
 * Estimated UK shipping cost for margin calculations.
 * Used until we wire up live Gelato Quote API.
 * Conservative estimate for standard UK delivery.
 */
export const ESTIMATED_UK_SHIPPING = 3.80;

/** 
 * Estimated per-order variable costs (AI + storage).
 * OpenAI image generation + Cloudinary storage/transforms.
 */
export const ESTIMATED_AI_COST = 0.06;
export const ESTIMATED_CLOUD_COST = 0.03;

// =============================================================================
// MSRP PRICE TABLE (VAT-INCLUSIVE, GBP)
// =============================================================================

/**
 * Master Suggested Retail Price table.
 * All prices are VAT-INCLUSIVE for UK B2C display.
 * These prices target ~65% gross margin based on estimated landed costs.
 * 
 * Landed Cost = Gelato print + UK shipping + AI costs
 * 
 * Size reference:
 * - 12x16" ≈ A4+ (300x400mm)
 * - 16x20" ≈ A3  (400x500mm)  
 * - 18x24" ≈ A2  (450x600mm)
 */
export const MSRP_TABLE: Record<string, Record<string, number>> = {
  // Matte Posters (170gsm uncoated)
  // Estimated landed costs: 12x16=£7.69, 16x20=£9.09, 18x24=£10.89
  poster: {
    '12x16': 26.99,  // Target margin: 65% on ~£7.69 landed
    '16x20': 31.99,  // Target margin: 65% on ~£9.09 landed
    '18x24': 37.99,  // Target margin: 65% on ~£10.89 landed
    '24x36': 49.99,  // Higher price for large format (if re-enabled)
  },
  
  // Canvas (stretched frame, fine art)
  // Higher production costs due to stretcher bars + gallery wrap
  canvas: {
    '8x10': 34.99,   // Slim frame (0.8")
    '12x16': 49.99,  // Slim frame (0.8")
    '16x20': 59.99,  // Slim frame (0.8")
    '16x20_thick': 64.99, // Thick frame (1.6")
    '24x36': 89.99,  // If re-enabled for high-res uploads
  },
  
  // Fine Art Prints (archival 200gsm paper)
  // Premium paper with archival inks
  fineart: {
    '16x20': 39.99,
    '18x24': 44.99,
  },
};

/**
 * Estimated Gelato production costs (ex shipping, ex VAT) for guardrail.
 * These are ESTIMATES until we integrate live Quote API.
 * Update these if Gelato pricing changes significantly.
 */
export const ESTIMATED_GELATO_COSTS: Record<string, Record<string, number>> = {
  poster: {
    '12x16': 3.80,
    '16x20': 5.20,
    '18x24': 7.00,
    '24x36': 12.00,
  },
  canvas: {
    '8x10': 8.50,
    '12x16': 12.00,
    '16x20': 15.00,
    '16x20_thick': 18.00,
    '24x36': 28.00,
  },
  fineart: {
    '16x20': 7.50,
    '18x24': 9.50,
  },
};

// =============================================================================
// GBP-BASE PRICING WITH CURRENCY CONVERSION
// =============================================================================

import {
  CurrencyCode,
  getFxRate,
  convertFromGBP,
  roundToMinorUnits,
  toStripeUnitAmount,
  isSupportedCurrency,
  logFxConversion,
} from './fx';

// Re-export CurrencyCode for convenience
export type { CurrencyCode };

/**
 * Minimum price floors (GBP) - conservative values to prevent losses.
 * These should always be BELOW our MSRP but ABOVE our break-even cost.
 */
export const MIN_PRICE_FLOOR_GBP: Record<string, Record<string, number>> = {
  poster: {
    '12x16': 20.00,
    '16x20': 25.00,
    '18x24': 30.00,
    '24x36': 40.00,
  },
  canvas: {
    '8x10': 28.00,
    '12x16': 40.00,
    '16x20': 50.00,
    '16x20_thick': 55.00,
    '24x36': 75.00,
  },
  fineart: {
    '16x20': 32.00,
    '18x24': 38.00,
  },
};

/**
 * Get the trusted unit price in GBP for a product.
 * This is the canonical source of truth for pricing.
 * 
 * Logic:
 * 1. Look up MSRP from table
 * 2. Apply floor price as minimum
 * 3. Return GBP value (major units, e.g., 26.99)
 * 
 * @param productType Product type (poster, canvas, fineart)
 * @param sizeKey Size key (12x16, 16x20, etc.)
 * @returns Trusted GBP price or null if not found
 */
export function getTrustedUnitPriceGBP(
  productType: string,
  sizeKey: string
): number | null {
  // Get MSRP from trusted table
  const msrp = MSRP_TABLE[productType]?.[sizeKey];
  
  // Get floor price
  const floor = MIN_PRICE_FLOOR_GBP[productType]?.[sizeKey];
  
  if (msrp === undefined && floor === undefined) {
    console.error(`[PRICING] No pricing data for ${productType}/${sizeKey}`);
    return null;
  }
  
  // Use MSRP if available, otherwise use floor
  const basePrice = msrp ?? floor ?? 0;
  
  // Enforce floor (should never trigger if MSRP is correctly set)
  const floorPrice = floor ?? 0;
  const trustedPrice = Math.max(basePrice, floorPrice);
  
  // Log if floor triggered (indicates potential MSRP issue)
  if (floor && trustedPrice === floorPrice && msrp !== undefined && msrp < floorPrice) {
    console.warn(
      `[PRICING] Price floor triggered for ${productType}/${sizeKey}: ` +
      `MSRP £${msrp} < floor £${floorPrice}`
    );
  }
  
  return trustedPrice;
}

/**
 * Result of currency conversion for a product price
 */
export interface ConvertedPriceResult {
  /** Original GBP price (major units) */
  baseGBP: number;
  /** Target currency code */
  currency: CurrencyCode;
  /** Exchange rate used (1 GBP = X target) */
  fxRate: number;
  /** Converted price in target currency (major units, rounded) */
  converted: number;
  /** Stripe-ready unit amount (cents or yen) */
  stripeUnitAmount: number;
}

/**
 * Get the trusted unit price converted to a target currency.
 * 
 * This is the main function for determining what to charge customers.
 * It takes the GBP base price and converts it to the target currency.
 * 
 * @param productType Product type (poster, canvas, fineart)
 * @param sizeKey Size key (12x16, 16x20, etc.)
 * @param currency Target currency code
 * @returns Conversion result or null if pricing not found
 */
export function getTrustedUnitPriceForCurrency(
  productType: string,
  sizeKey: string,
  currency: CurrencyCode
): ConvertedPriceResult | null {
  // Get base GBP price
  const baseGBP = getTrustedUnitPriceGBP(productType, sizeKey);
  
  if (baseGBP === null) {
    return null;
  }
  
  // If target is GBP, no conversion needed
  if (currency === 'GBP') {
    return {
      baseGBP,
      currency: 'GBP',
      fxRate: 1,
      converted: baseGBP,
      stripeUnitAmount: toStripeUnitAmount(baseGBP, 'GBP'),
    };
  }
  
  // Convert to target currency
  const fxRate = getFxRate('GBP', currency);
  const rawConverted = convertFromGBP(baseGBP, currency);
  const converted = roundToMinorUnits(rawConverted, currency);
  
  // Log conversion for debugging
  logFxConversion(baseGBP, currency, converted);
  
  return {
    baseGBP,
    currency,
    fxRate,
    converted,
    stripeUnitAmount: toStripeUnitAmount(converted, currency),
  };
}

/**
 * Derive product type from Gelato product UID.
 * Exported for use in API routes.
 */
export function deriveProductType(productUid: string): 'poster' | 'canvas' | 'fineart' | null {
  if (productUid.startsWith('canvas_')) {
    return 'canvas';
  }
  if (productUid.startsWith('flat_')) {
    if (productUid.includes('archival')) {
      return 'fineart';
    }
    return 'poster';
  }
  return null;
}

/**
 * Derive size key from Gelato product UID.
 * Exported for use in API routes.
 */
export function deriveSizeKey(productUid: string): string | null {
  // Check for common size patterns in UID
  if (productUid.includes('8x10')) return '8x10';
  if (productUid.includes('12x16')) return '12x16';
  if (productUid.includes('16x20')) {
    // Check for thick frame canvas
    if (productUid.includes('thick')) return '16x20_thick';
    return '16x20';
  }
  if (productUid.includes('18x24')) return '18x24';
  if (productUid.includes('24x36')) return '24x36';
  return null;
}

// =============================================================================
// CORE PRICE FUNCTIONS
// =============================================================================

/**
 * Add VAT to a price (UK 20%)
 * @param priceExVat Price excluding VAT
 * @returns Price including VAT
 */
export function addVAT(priceExVat: number): number {
  return priceExVat * (1 + UK_VAT_RATE);
}

/**
 * Remove VAT from a price (UK 20%)
 * @param priceIncVat Price including VAT
 * @returns Price excluding VAT
 */
export function removeVAT(priceIncVat: number): number {
  return priceIncVat / (1 + UK_VAT_RATE);
}

/**
 * Calculate Stripe fee for a given amount
 * @param amount Transaction amount
 * @returns Stripe fee amount
 */
export function calculateStripeFee(amount: number): number {
  return (amount * STRIPE_PERCENTAGE) + STRIPE_FIXED_FEE;
}

/**
 * Format price with currency symbol
 * @param price Price value
 * @param currency Currency code (default: GBP)
 * @returns Formatted price string
 */
export function formatPrice(price: number, currency: string = 'GBP'): string {
  const { getLocaleForCurrency } = require('./currency');
  const locale = getLocaleForCurrency(currency);
  
  return new Intl.NumberFormat(locale, { 
    style: 'currency', 
    currency: currency 
  }).format(price);
}

// =============================================================================
// PRODUCT INFO EXTRACTION
// =============================================================================

/**
 * Extract product type and size from Gelato SKU
 * @param productUid Gelato product UID
 * @returns Object with type, size, and frameType (for canvas)
 */
export function getProductInfo(productUid: string): { 
  type: 'poster' | 'canvas' | 'fineart'; 
  size: string;
  frameType?: 'slim' | 'thick';
} {
  // Determine product type
  let type: 'poster' | 'canvas' | 'fineart' = 'poster';
  if (productUid.startsWith('canvas_')) {
    type = 'canvas';
  } else if (productUid.includes('archival')) {
    type = 'fineart';
  }
  
  // Extract size from UID
  let size = '16x20'; // default
  if (productUid.includes('8x10')) size = '8x10';
  else if (productUid.includes('12x16')) size = '12x16';
  else if (productUid.includes('16x20')) size = '16x20';
  else if (productUid.includes('18x24')) size = '18x24';
  else if (productUid.includes('24x36')) size = '24x36';
  
  // For canvas, detect frame type
  let frameType: 'slim' | 'thick' | undefined;
  if (type === 'canvas') {
    frameType = productUid.includes('thick') ? 'thick' : 'slim';
    // Adjust size key for thick frame canvas
    if (frameType === 'thick' && size === '16x20') {
      size = '16x20_thick';
    }
  }
  
  return { type, size, frameType };
}

// =============================================================================
// MARGIN CALCULATIONS
// =============================================================================

/**
 * Calculate landed cost for a product (for margin guardrail)
 * 
 * Landed cost = Gelato print + Shipping + AI + Cloud
 * 
 * @param type Product type
 * @param size Product size
 * @returns Estimated landed cost in GBP
 */
export function calculateLandedCost(type: string, size: string): number {
  const gelatoCost = ESTIMATED_GELATO_COSTS[type]?.[size] ?? 10.00; // fallback
  return gelatoCost + ESTIMATED_UK_SHIPPING + ESTIMATED_AI_COST + ESTIMATED_CLOUD_COST;
}

/**
 * Calculate gross margin for a given price and cost
 * 
 * Gross Margin = (Price - Cost) / Price
 * 
 * @param priceExVat Selling price (ex VAT)
 * @param landedCost Total cost to fulfill
 * @returns Gross margin as decimal (0.65 = 65%)
 */
export function calculateGrossMargin(priceExVat: number, landedCost: number): number {
  if (priceExVat <= 0) return 0;
  return (priceExVat - landedCost) / priceExVat;
}

/**
 * Check margin guardrail and log warning if below threshold
 * 
 * @param productUid Product SKU
 * @param priceIncVat VAT-inclusive retail price
 * @param landedCost Estimated landed cost
 * @returns Object with margin info and warning flag
 */
export function checkMarginGuardrail(
  productUid: string,
  priceIncVat: number,
  landedCost: number
): { 
  grossMargin: number; 
  isHealthy: boolean; 
  warning?: string;
} {
  const priceExVat = removeVAT(priceIncVat);
  const grossMargin = calculateGrossMargin(priceExVat, landedCost);
  const isHealthy = grossMargin >= MIN_GROSS_MARGIN_GUARDRAIL;
  
  if (!isHealthy) {
    const warning = `[MARGIN ALERT] SKU ${productUid} has ${(grossMargin * 100).toFixed(1)}% margin (below ${MIN_GROSS_MARGIN_GUARDRAIL * 100}% threshold). ` +
      `Price: £${priceIncVat.toFixed(2)} inc VAT, Landed cost: £${landedCost.toFixed(2)}. ` +
      `Review pricing or mark SKU for removal.`;
    
    // Log to console (in production, this should go to monitoring)
    console.error(warning);
    
    return { grossMargin, isHealthy, warning };
  }
  
  return { grossMargin, isHealthy };
}

// =============================================================================
// MAIN PRICING FUNCTION
// =============================================================================

/**
 * Get the retail price for a product (VAT-inclusive).
 * 
 * PRIMARY: Returns MSRP from table (fixed, stable pricing)
 * FALLBACK: If MSRP missing, compute from margin target formula
 * GUARDRAIL: Logs warning if margin drops below 55%
 * 
 * @param gelatoBasePrice Gelato's quoted base price (used for guardrail, can be 0)
 * @param productUid Gelato product SKU
 * @returns VAT-inclusive retail price in GBP
 */
export function calculateSmartPrice(gelatoBasePrice: number, productUid: string): number {
  const { type, size } = getProductInfo(productUid);
  
  // PRIMARY: Look up MSRP from table
  const msrp = MSRP_TABLE[type]?.[size];
  
  if (msrp !== undefined) {
    // Run margin guardrail check
    const landedCost = calculateLandedCost(type, size);
    checkMarginGuardrail(productUid, msrp, landedCost);
    
    return msrp;
  }
  
  // FALLBACK: Compute price from margin target formula
  // Price = Cost / (1 - targetMargin)
  // Then add VAT for display price
  console.warn(`[PRICING] No MSRP found for ${type}/${size}, using margin-target fallback`);
  
  const landedCost = gelatoBasePrice > 0 
    ? gelatoBasePrice + ESTIMATED_UK_SHIPPING + ESTIMATED_AI_COST + ESTIMATED_CLOUD_COST
    : calculateLandedCost(type, size);
  
  const targetMargin = 0.65;
  const priceExVat = landedCost / (1 - targetMargin);
  const priceIncVat = addVAT(priceExVat);
  
  // Round to .99 pricing
  const roundedPrice = Math.ceil(priceIncVat) - 0.01;
  
  return roundedPrice;
}

/**
 * Get MSRP directly from table (no fallback computation)
 * Useful for displaying prices when you don't have Gelato quote yet.
 * 
 * @param productUid Gelato product SKU
 * @returns VAT-inclusive MSRP or null if not found
 */
export function getMSRP(productUid: string): number | null {
  const { type, size } = getProductInfo(productUid);
  return MSRP_TABLE[type]?.[size] ?? null;
}

// =============================================================================
// LEGACY FUNCTIONS (kept for backward compatibility)
// =============================================================================

/**
 * @deprecated Use calculateSmartPrice() instead
 * Apply a percentage markup to a base price
 */
export function applyMarkup(basePrice: number, markupPercent: number = 0): number {
  if (markupPercent <= 0) return basePrice;
  return basePrice * (1 + (markupPercent / 100));
}

/**
 * @deprecated Use calculateSmartPrice() instead
 * Calculate final customer price using markup (old method)
 */
export function calculateFinalPrice(basePrice: number, markupPercent: number = 0): number {
  const markedUpPrice = applyMarkup(basePrice, markupPercent);
  return addVAT(markedUpPrice);
}

/**
 * @deprecated Markup percentage is no longer used for pricing
 * Get the markup percentage from environment variables
 */
export function getMarkupPercentage(): number {
  console.warn('[DEPRECATED] getMarkupPercentage() is deprecated. Pricing now uses MSRP table.');
  const markupStr = process.env.NEXT_PUBLIC_MARKUP_PERCENT;
  if (!markupStr) return 120;
  const markup = parseFloat(markupStr);
  return isNaN(markup) || markup < 0 ? 120 : markup;
}

// =============================================================================
// PROFIT CALCULATIONS
// =============================================================================

/**
 * Calculate net profit after all fees and costs
 * 
 * @param sellPrice Final price paid by customer (inc VAT)
 * @param landedCost Total cost to fulfill (Gelato + shipping + AI + cloud)
 * @returns Net profit after Stripe fees and VAT
 */
export function calculateNetProfit({
  sellPrice,
  landedCost,
}: {
  sellPrice: number;
  landedCost: number;
}): number {
  const stripeFee = calculateStripeFee(sellPrice);
  const priceExVat = removeVAT(sellPrice);
  
  // Net profit = Revenue (ex VAT) - Landed cost - Stripe fee
  // Note: We don't subtract VAT as cost because we remit it to HMRC
  return priceExVat - landedCost - stripeFee;
}

/**
 * Calculate total price including product price and shipping
 * Note: Both inputs should be in the same VAT state (both inc or both ex)
 * 
 * @param productPrice Product price
 * @param shippingPrice Shipping price
 * @returns Total price
 */
export function calculateTotal(productPrice: number, shippingPrice: number): number {
  return productPrice + shippingPrice;
}

// =============================================================================
// PRICING SUMMARY (for debugging/admin)
// =============================================================================

/**
 * Get a pricing summary for all SKUs (useful for admin/debugging)
 */
export function getPricingSummary(): Array<{
  type: string;
  size: string;
  msrp: number;
  landedCost: number;
  grossMargin: number;
  isHealthy: boolean;
}> {
  const summary: Array<{
    type: string;
    size: string;
    msrp: number;
    landedCost: number;
    grossMargin: number;
    isHealthy: boolean;
  }> = [];
  
  for (const [type, sizes] of Object.entries(MSRP_TABLE)) {
    for (const [size, msrp] of Object.entries(sizes)) {
      const landedCost = calculateLandedCost(type, size);
      const priceExVat = removeVAT(msrp);
      const grossMargin = calculateGrossMargin(priceExVat, landedCost);
      
      summary.push({
        type,
        size,
        msrp,
        landedCost,
        grossMargin,
        isHealthy: grossMargin >= MIN_GROSS_MARGIN_GUARDRAIL,
      });
    }
  }
  
  return summary;
}
