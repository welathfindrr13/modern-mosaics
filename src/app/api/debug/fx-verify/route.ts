import { NextRequest, NextResponse } from 'next/server';
import { requireDebugAdmin } from '@/lib/api-auth';
import {
  getTrustedUnitPriceForCurrency,
} from '@/utils/priceUtils';
import { getCurrencyForCountry } from '@/utils/currency';
import {
  getFxSnapshot,
  CurrencyCode,
} from '@/utils/fx';

/**
 * GET /api/debug/fx-verify
 * 
 * DEV-ONLY: Verify FX conversion is working correctly.
 * Tests pricing for poster 12x16 across multiple countries.
 * 
 * Expected results (with current static rates):
 * - GB: £26.99 GBP
 * - US: ~$34.27 USD (26.99 × 1.27)
 * - JP: ~¥5,128 JPY (26.99 × 190)
 * - CN: ~¥248 CNY (26.99 × 9.2)
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    const accessResponse = await requireDebugAdmin(request, '/api/debug/fx-verify');
    if (accessResponse) {
      return accessResponse;
    }
  }
  
  try {
    const testCountries = ['GB', 'US', 'JP', 'CN', 'DE', 'CA', 'AU'];
    const testProduct = {
      productType: 'poster',
      sizeKey: '12x16',
      baseGBP: 26.99,
    };
    
    const results: Array<{
      country: string;
      currency: string;
      baseGBP: number;
      fxRate: number;
      convertedPrice: number;
      stripeUnitAmount: number;
      expectedApprox: string;
      status: 'OK' | 'WARNING' | 'ERROR';
      notes: string;
    }> = [];
    
    for (const country of testCountries) {
      const currency = getCurrencyForCountry(country) as CurrencyCode;
      
      const priceResult = getTrustedUnitPriceForCurrency(
        testProduct.productType,
        testProduct.sizeKey,
        currency
      );
      
      if (!priceResult) {
        results.push({
          country,
          currency,
          baseGBP: testProduct.baseGBP,
          fxRate: 0,
          convertedPrice: 0,
          stripeUnitAmount: 0,
          expectedApprox: 'N/A',
          status: 'ERROR',
          notes: 'Failed to get price',
        });
        continue;
      }
      
      // Calculate expected approximate values
      let expectedApprox = '';
      let status: 'OK' | 'WARNING' | 'ERROR' = 'OK';
      let notes = '';
      
      switch (currency) {
        case 'GBP':
          expectedApprox = '£26.99';
          if (priceResult.converted !== 26.99) {
            status = 'ERROR';
            notes = 'GBP should not be converted';
          }
          break;
        case 'USD':
          expectedApprox = '~$34.27';
          if (priceResult.converted < 30 || priceResult.converted > 40) {
            status = 'WARNING';
            notes = 'USD conversion may be off';
          }
          break;
        case 'JPY':
          expectedApprox = '~¥5,128';
          if (priceResult.converted < 4000 || priceResult.converted > 6000) {
            status = 'ERROR';
            notes = `JPY should be thousands, got ${priceResult.converted}`;
          }
          break;
        case 'CNY':
          expectedApprox = '~¥248';
          if (priceResult.converted < 200 || priceResult.converted > 300) {
            status = 'WARNING';
            notes = `CNY should be hundreds, got ${priceResult.converted}`;
          }
          break;
        case 'EUR':
          expectedApprox = '~€31.58';
          if (priceResult.converted < 28 || priceResult.converted > 36) {
            status = 'WARNING';
            notes = 'EUR conversion may be off';
          }
          break;
        case 'CAD':
          expectedApprox = '~$46.42 CAD';
          if (priceResult.converted < 40 || priceResult.converted > 55) {
            status = 'WARNING';
            notes = 'CAD conversion may be off';
          }
          break;
        case 'AUD':
          expectedApprox = '~$52.63 AUD';
          if (priceResult.converted < 45 || priceResult.converted > 60) {
            status = 'WARNING';
            notes = 'AUD conversion may be off';
          }
          break;
      }
      
      results.push({
        country,
        currency,
        baseGBP: priceResult.baseGBP,
        fxRate: priceResult.fxRate,
        convertedPrice: priceResult.converted,
        stripeUnitAmount: priceResult.stripeUnitAmount,
        expectedApprox,
        status,
        notes: notes || 'Conversion looks correct',
      });
    }
    
    // Get FX snapshot
    const fxSnapshot = getFxSnapshot();
    
    // Summary
    const errorCount = results.filter(r => r.status === 'ERROR').length;
    const warningCount = results.filter(r => r.status === 'WARNING').length;
    
    let overallStatus = 'PASS';
    if (errorCount > 0) {
      overallStatus = 'FAIL';
    } else if (warningCount > 0) {
      overallStatus = 'WARN';
    }
    
    // Critical check: JPY should NOT be ~27
    const jpyResult = results.find(r => r.currency === 'JPY');
    if (jpyResult && jpyResult.convertedPrice < 100) {
      overallStatus = 'CRITICAL_FAIL';
    }
    
    return NextResponse.json({
      status: overallStatus,
      message: overallStatus === 'PASS' 
        ? '✅ FX conversion working correctly' 
        : overallStatus === 'CRITICAL_FAIL'
        ? '🚨 CRITICAL: JPY is not converted - would charge ¥27 instead of ¥5000+'
        : '⚠️ Some conversions may need review',
      testProduct,
      results,
      fxSnapshot,
      summary: {
        countriesTested: testCountries.length,
        errors: errorCount,
        warnings: warningCount,
        passed: results.length - errorCount - warningCount,
      },
    });
    
  } catch (error: any) {
    console.error('[FX-VERIFY] Error:', error);
    return NextResponse.json(
      { error: `Verification failed: ${error.message}` },
      { status: 500 }
    );
  }
}
