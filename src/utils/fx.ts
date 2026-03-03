/**
 * Foreign Exchange (FX) Utilities for Modern Mosaics
 * 
 * IMPORTANT: This module provides currency conversion with GBP as the base currency.
 * All product pricing is defined in GBP and converted to target currencies at checkout.
 * 
 * TODO: Replace static rates with a live FX provider (e.g., Open Exchange Rates, Fixer.io)
 * Current rates are PLACEHOLDER values for development/MVP.
 * 
 * @see https://www.xe.com/currencyconverter/ for reference rates
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Supported currency codes.
 * These are the currencies we actively support for checkout.
 */
export type CurrencyCode = 'GBP' | 'USD' | 'CAD' | 'EUR' | 'AUD' | 'JPY' | 'CNY';

/**
 * FX rate entry with metadata
 */
export interface FxRateEntry {
  rate: number;
  source: 'static' | 'api';
  updatedAt: string;
}

/**
 * FX snapshot for debugging/audit
 */
export interface FxSnapshot {
  baseCurrency: 'GBP';
  rates: Record<CurrencyCode, FxRateEntry>;
  lastUpdatedAt: string;
}

// =============================================================================
// STATIC FX RATES (GBP BASE)
// =============================================================================

/**
 * Static exchange rates from GBP to target currencies.
 * 
 * TODO: These are placeholder rates as of January 2026.
 * Must be updated regularly or replaced with live API.
 * 
 * Rate interpretation: 1 GBP = X target currency
 */
const STATIC_FX_RATES: Record<CurrencyCode, number> = {
  GBP: 1.0,      // Base currency
  USD: 1.27,     // 1 GBP = 1.27 USD
  CAD: 1.72,     // 1 GBP = 1.72 CAD
  EUR: 1.17,     // 1 GBP = 1.17 EUR
  AUD: 1.95,     // 1 GBP = 1.95 AUD
  JPY: 190.0,    // 1 GBP = 190 JPY
  CNY: 9.20,     // 1 GBP = 9.20 CNY
};

/**
 * Last updated timestamp for static rates
 */
const STATIC_RATES_UPDATED_AT = '2026-01-30T00:00:00Z';

// =============================================================================
// IN-MEMORY CACHE
// =============================================================================

/**
 * Simple in-memory cache for FX rates.
 * In production, this could be replaced with Redis or similar.
 */
let cachedRates: Record<CurrencyCode, FxRateEntry> | null = null;
let cacheUpdatedAt: string | null = null;

/**
 * Initialize or refresh the rate cache
 */
function ensureCache(): void {
  if (cachedRates === null) {
    // Initialize with static rates
    const now = new Date().toISOString();
    cachedRates = {} as Record<CurrencyCode, FxRateEntry>;
    
    for (const [currency, rate] of Object.entries(STATIC_FX_RATES)) {
      cachedRates[currency as CurrencyCode] = {
        rate,
        source: 'static',
        updatedAt: STATIC_RATES_UPDATED_AT,
      };
    }
    
    cacheUpdatedAt = now;
  }
}

// =============================================================================
// CORE FX FUNCTIONS
// =============================================================================

/**
 * Get the exchange rate from GBP to a target currency.
 * 
 * @param from Must be 'GBP' (base currency)
 * @param to Target currency code
 * @returns Exchange rate (1 GBP = X target)
 * @throws Error if currency not supported
 */
export function getFxRate(from: 'GBP', to: CurrencyCode): number {
  if (from !== 'GBP') {
    throw new Error(`FX conversion only supports GBP as base currency, got: ${from}`);
  }
  
  ensureCache();
  
  const entry = cachedRates![to];
  if (!entry) {
    throw new Error(`Unsupported currency code: ${to}`);
  }
  
  return entry.rate;
}

/**
 * Convert an amount from GBP to a target currency.
 * 
 * @param amountGBP Amount in GBP (major units, e.g., 26.99)
 * @param to Target currency code
 * @returns Amount in target currency (major units, not rounded)
 */
export function convertFromGBP(amountGBP: number, to: CurrencyCode): number {
  if (to === 'GBP') {
    return amountGBP;
  }
  
  const rate = getFxRate('GBP', to);
  return amountGBP * rate;
}

/**
 * Get the number of decimal places (minor units) for a currency.
 * 
 * @param currency Currency code
 * @returns 0 for zero-decimal currencies (JPY), 2 for others
 */
export function getMinorUnits(currency: CurrencyCode): 0 | 2 {
  // Zero-decimal currencies
  const zeroDecimalCurrencies: CurrencyCode[] = ['JPY'];
  
  return zeroDecimalCurrencies.includes(currency) ? 0 : 2;
}

/**
 * Round an amount to the appropriate minor units for a currency.
 * 
 * @param amount Amount in major units
 * @param currency Currency code
 * @returns Rounded amount (whole number for JPY, 2 decimals for others)
 */
export function roundToMinorUnits(amount: number, currency: CurrencyCode): number {
  const minorUnits = getMinorUnits(currency);
  
  if (minorUnits === 0) {
    return Math.round(amount);
  }
  
  // Round to 2 decimal places
  return Math.round(amount * 100) / 100;
}

/**
 * Convert an amount to Stripe's unit_amount format.
 * 
 * Stripe requires amounts in the smallest currency unit:
 * - JPY: integer yen (no decimals)
 * - USD/GBP/EUR/etc: cents (multiply by 100)
 * 
 * @param amount Amount in major units (e.g., 26.99 GBP or 5130 JPY)
 * @param currency Currency code
 * @returns Integer suitable for Stripe unit_amount
 */
export function toStripeUnitAmount(amount: number, currency: CurrencyCode): number {
  const minorUnits = getMinorUnits(currency);
  
  if (minorUnits === 0) {
    // Zero-decimal currency (JPY): amount is already in smallest unit
    return Math.round(amount);
  }
  
  // Standard currency: multiply by 100 to get cents
  return Math.round(amount * 100);
}

/**
 * Convert from Stripe's unit_amount back to major units.
 * 
 * @param unitAmount Stripe unit_amount (cents or yen)
 * @param currency Currency code
 * @returns Amount in major units
 */
export function fromStripeUnitAmount(unitAmount: number, currency: CurrencyCode): number {
  const minorUnits = getMinorUnits(currency);
  
  if (minorUnits === 0) {
    return unitAmount;
  }
  
  return unitAmount / 100;
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Supported currency codes as a Set for validation
 */
export const SUPPORTED_CURRENCIES = new Set<CurrencyCode>([
  'GBP', 'USD', 'CAD', 'EUR', 'AUD', 'JPY', 'CNY'
]);

/**
 * Check if a currency code is supported.
 * 
 * @param code Currency code to check
 * @returns True if supported
 */
export function isSupportedCurrency(code: string): code is CurrencyCode {
  return SUPPORTED_CURRENCIES.has(code as CurrencyCode);
}

/**
 * Validate and cast a currency code.
 * 
 * @param code Currency code to validate
 * @returns Validated CurrencyCode
 * @throws Error if not supported
 */
export function validateCurrency(code: string): CurrencyCode {
  const upper = code.toUpperCase();
  
  if (!isSupportedCurrency(upper)) {
    throw new Error(
      `Unsupported currency: ${code}. Supported currencies: ${Array.from(SUPPORTED_CURRENCIES).join(', ')}`
    );
  }
  
  return upper as CurrencyCode;
}

// =============================================================================
// DEBUGGING / AUDIT
// =============================================================================

/**
 * Get a snapshot of current FX rates for debugging/audit.
 * 
 * @returns FxSnapshot with all rates and metadata
 */
export function getFxSnapshot(): FxSnapshot {
  ensureCache();
  
  return {
    baseCurrency: 'GBP',
    rates: { ...cachedRates! },
    lastUpdatedAt: cacheUpdatedAt!,
  };
}

/**
 * Log FX conversion details for debugging.
 * 
 * @param amountGBP Original GBP amount
 * @param to Target currency
 * @param converted Converted amount
 */
export function logFxConversion(
  amountGBP: number,
  to: CurrencyCode,
  converted: number
): void {
  const rate = getFxRate('GBP', to);
  console.log(
    `[FX] £${amountGBP.toFixed(2)} GBP → ${to} ${converted.toFixed(getMinorUnits(to) === 0 ? 0 : 2)} ` +
    `(rate: ${rate}, source: static)`
  );
}
