import { NextRequest, NextResponse } from 'next/server';
import {
  getTrustedUnitPriceForCurrency,
  type CurrencyCode,
} from '@/utils/priceUtils';
import { getCurrencyForCountry } from '@/utils/currency';
import { validateCurrency, getFxSnapshot } from '@/utils/fx';
import {
  PRINT_LAB_CATALOG,
  getAvailableSizes,
  type ProductType,
  type SizeKey,
} from '@/data/printLabCatalog';

/**
 * Converted price option for a single size
 */
interface PriceOption {
  sizeKey: SizeKey;
  label: string;
  price: number;           // Converted price in target currency (major units)
  baseGBP: number;         // Original GBP price
  fxRate: number;          // Exchange rate used
  stripeUnitAmount: number; // Stripe-ready amount (cents/yen)
}

/**
 * GET /api/pricing/options
 * 
 * Returns converted prices for ALL available sizes of a product type.
 * Currency is derived server-side from country code.
 * 
 * Query parameters:
 * - productType: 'poster' | 'canvas' | 'fine_art' (required)
 * - country: ISO country code (required)
 * 
 * Response:
 * {
 *   currency: CurrencyCode,
 *   fxRate: number,
 *   base: 'GBP',
 *   productType: string,
 *   country: string,
 *   options: PriceOption[]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const productType = searchParams.get('productType') as ProductType | null;
    const country = searchParams.get('country');
    
    // Validate required params
    if (!productType) {
      return NextResponse.json(
        { error: 'Missing required parameter: productType' },
        { status: 400 }
      );
    }
    
    if (!country) {
      return NextResponse.json(
        { error: 'Missing required parameter: country' },
        { status: 400 }
      );
    }
    
    // Validate product type
    if (!PRINT_LAB_CATALOG[productType]) {
      return NextResponse.json(
        { error: `Invalid productType: ${productType}` },
        { status: 400 }
      );
    }
    
    // Derive currency from country (server-side authority)
    const countryCode = country.toUpperCase();
    const derivedCurrencyRaw = getCurrencyForCountry(countryCode);
    
    let currency: CurrencyCode;
    try {
      currency = validateCurrency(derivedCurrencyRaw);
    } catch (e) {
      console.warn(`[PRICING/OPTIONS] Unsupported currency ${derivedCurrencyRaw} for ${countryCode}, falling back to GBP`);
      currency = 'GBP';
    }
    
    // Get available sizes for this product type (only those with valid SKUs)
    const availableSizes = getAvailableSizes(productType);
    
    if (availableSizes.length === 0) {
      return NextResponse.json(
        { error: `No available sizes for productType: ${productType}` },
        { status: 404 }
      );
    }
    
    // Convert prices for each size
    const options: PriceOption[] = [];
    let fxRateUsed = 1;
    
    for (const sizeOption of availableSizes) {
      const priceResult = getTrustedUnitPriceForCurrency(
        productType,
        sizeOption.key,
        currency
      );
      
      if (priceResult) {
        fxRateUsed = priceResult.fxRate;
        options.push({
          sizeKey: sizeOption.key,
          label: sizeOption.label,
          price: priceResult.converted,
          baseGBP: priceResult.baseGBP,
          fxRate: priceResult.fxRate,
          stripeUnitAmount: priceResult.stripeUnitAmount,
        });
      } else {
        // Fallback: use GBP price directly (should not happen for valid sizes)
        console.warn(`[PRICING/OPTIONS] No price result for ${productType}/${sizeOption.key}`);
        options.push({
          sizeKey: sizeOption.key,
          label: sizeOption.label,
          price: sizeOption.priceGBP,
          baseGBP: sizeOption.priceGBP,
          fxRate: 1,
          stripeUnitAmount: Math.round(sizeOption.priceGBP * 100),
        });
      }
    }
    
    console.log(
      `[PRICING/OPTIONS] ${productType} for ${countryCode}: ${options.length} sizes, ` +
      `currency=${currency}, fxRate=${fxRateUsed}`
    );
    
    return NextResponse.json({
      currency,
      fxRate: fxRateUsed,
      base: 'GBP',
      productType,
      country: countryCode,
      options,
    });
    
  } catch (error: any) {
    console.error('[PRICING/OPTIONS] Error:', error);
    return NextResponse.json(
      { error: `Failed to get pricing options: ${error.message}` },
      { status: 500 }
    );
  }
}
