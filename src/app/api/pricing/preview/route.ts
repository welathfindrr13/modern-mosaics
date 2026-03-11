import { NextRequest, NextResponse } from 'next/server';
import {
  getTrustedUnitPriceForCurrency,
  deriveProductType,
  deriveSizeKey,
  type CurrencyCode,
} from '@/utils/priceUtils';
import { getCurrencyForCountry } from '@/utils/currency';
import { validateCurrency, getFxSnapshot } from '@/utils/fx';
import {
  parseJsonWithSchema,
  parseSearchParamsWithSchema,
  pricingPreviewBatchRequestSchema,
  pricingPreviewQuerySchema,
} from '@/schemas/api';

/**
 * GET /api/pricing/preview
 * 
 * Returns the converted product price for display in the UI.
 * Currency is derived server-side from country code.
 * 
 * Query parameters:
 * - productUid: Gelato product UID (required)
 * - country: ISO country code (required)
 * - productType: Optional override for product type
 * - sizeKey: Optional override for size key
 * 
 * Response:
 * {
 *   currency: CurrencyCode,
 *   baseGBP: number,
 *   fxRate: number,
 *   price: number,  // converted major units
 *   stripeUnitAmount: number
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const parsedQuery = parseSearchParamsWithSchema(
      request.nextUrl.searchParams,
      pricingPreviewQuerySchema
    );
    if (!parsedQuery.success) {
      return parsedQuery.response;
    }

    const {
      country,
      productUid,
      productType: productTypeOverride,
      sizeKey: sizeKeyOverride,
    } = parsedQuery.data;
    
    // Derive currency from country
    const countryCode = country.toUpperCase();
    const derivedCurrencyRaw = getCurrencyForCountry(countryCode);
    
    let currency: CurrencyCode;
    try {
      currency = validateCurrency(derivedCurrencyRaw);
    } catch (e) {
      console.warn(`[PRICING/PREVIEW] Unsupported currency ${derivedCurrencyRaw} for country ${countryCode}, falling back to GBP`);
      currency = 'GBP';
    }
    
    // Determine product type and size
    let productType: string | null = productTypeOverride ?? null;
    let sizeKey: string | null = sizeKeyOverride ?? null;
    
    if (productUid) {
      if (!productType) {
        productType = deriveProductType(productUid);
      }
      if (!sizeKey) {
        sizeKey = deriveSizeKey(productUid);
      }
    }
    
    if (!productType || !sizeKey) {
      return NextResponse.json(
        { error: 'Cannot determine product type and size. Provide productUid or both productType and sizeKey.' },
        { status: 400 }
      );
    }
    
    // Get converted price
    const priceResult = getTrustedUnitPriceForCurrency(productType, sizeKey, currency);
    
    if (!priceResult) {
      return NextResponse.json(
        { error: `No pricing found for ${productType}/${sizeKey}` },
        { status: 404 }
      );
    }
    
    console.log(
      `[PRICING/PREVIEW] ${productType}/${sizeKey} for ${countryCode}: ` +
      `£${priceResult.baseGBP} GBP → ${currency} ${priceResult.converted} (rate: ${priceResult.fxRate})`
    );
    
    return NextResponse.json({
      currency: priceResult.currency,
      baseGBP: priceResult.baseGBP,
      fxRate: priceResult.fxRate,
      price: priceResult.converted,
      stripeUnitAmount: priceResult.stripeUnitAmount,
      country: countryCode,
      productType,
      sizeKey,
    });
    
  } catch (error: unknown) {
    console.error('[PRICING/PREVIEW] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get pricing.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pricing/preview
 * 
 * Batch pricing preview for multiple products/sizes.
 * Useful for getting all prices at once when loading the order page.
 * 
 * Request body:
 * {
 *   country: string,
 *   items: Array<{ productType: string, sizeKey: string }>
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const parsedBody = await parseJsonWithSchema(request, pricingPreviewBatchRequestSchema);
    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const { country, items } = parsedBody.data;
    
    // Derive currency from country
    const countryCode = country.toUpperCase();
    const derivedCurrencyRaw = getCurrencyForCountry(countryCode);
    
    let currency: CurrencyCode;
    try {
      currency = validateCurrency(derivedCurrencyRaw);
    } catch (e) {
      currency = 'GBP';
    }
    
    // Get prices for all items
    const prices = items.map((item: { productType: string; sizeKey: string }) => {
      const result = getTrustedUnitPriceForCurrency(item.productType, item.sizeKey, currency);
      
      if (!result) {
        return {
          productType: item.productType,
          sizeKey: item.sizeKey,
          error: 'Price not found',
        };
      }
      
      return {
        productType: item.productType,
        sizeKey: item.sizeKey,
        baseGBP: result.baseGBP,
        price: result.converted,
        currency: result.currency,
        fxRate: result.fxRate,
      };
    });
    
    // Get FX snapshot for reference
    const fxSnapshot = getFxSnapshot();
    
    return NextResponse.json({
      country: countryCode,
      currency,
      fxRate: currency === 'GBP' ? 1 : fxSnapshot.rates[currency]?.rate,
      fxSource: 'static',
      prices,
    });
    
  } catch (error: unknown) {
    console.error('[PRICING/PREVIEW] Batch error:', error);
    return NextResponse.json(
      { error: 'Failed to get pricing.' },
      { status: 500 }
    );
  }
}
