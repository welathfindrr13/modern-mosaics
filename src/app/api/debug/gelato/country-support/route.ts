/**
 * DEBUG ROUTE: Gelato Country Support Checker
 * 
 * HOW TO RUN:
 *   GET http://localhost:3000/api/debug/gelato/country-support
 * 
 * WHAT IT DOES:
 *   Tests whether Gelato can fulfill orders to various countries by:
 *   1. Requesting a quote for each country with a test address
 *   2. Checking if shipment methods are returned
 *   3. Reporting which countries are supported
 * 
 * SAFE: This route ONLY calls the quote endpoint (read-only).
 *       It never creates actual orders.
 * 
 * EXPECTED OUTPUT:
 *   JSON object with per-country support status, shipment methods count,
 *   and an overall conclusion about Gelato's geographic coverage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireDebugAdmin } from '@/lib/api-auth';
import { getGelatoClient, GelatoQuoteRequest, GelatoRecipient } from '@/lib/gelato';

export const dynamic = 'force-dynamic';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Countries to test (from Order page dropdown)
 */
const COUNTRIES_TO_TEST = ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES', 'JP', 'CN'];

/**
 * Representative SKUs to test (one poster, one canvas)
 */
const SKUS_TO_TEST = [
  'flat_300x400-mm-12x16-inch_170-gsm-65lb-uncoated_4-0_ver',  // Poster 12x16
  'canvas_12x16-inch-300x400-mm_canvas_wood-fsc-slim_4-0_ver', // Canvas 12x16
];

/**
 * Placeholder addresses per country (minimal required fields)
 * These are generic/fake addresses for testing purposes only
 */
const TEST_ADDRESSES: Record<string, Partial<GelatoRecipient>> = {
  US: {
    firstName: 'Test',
    lastName: 'User',
    addressLine1: '123 Test Street',
    city: 'New York',
    postCode: '10001',
    state: 'NY',
    country: 'US',
    email: 'test@test.com',
  },
  CA: {
    firstName: 'Test',
    lastName: 'User',
    addressLine1: '123 Test Street',
    city: 'Toronto',
    postCode: 'M5V 1J2',
    state: 'ON',
    country: 'CA',
    email: 'test@test.com',
  },
  GB: {
    firstName: 'Test',
    lastName: 'User',
    addressLine1: '123 Test Street',
    city: 'London',
    postCode: 'SW1A 1AA',
    country: 'GB',
    email: 'test@test.com',
  },
  AU: {
    firstName: 'Test',
    lastName: 'User',
    addressLine1: '123 Test Street',
    city: 'Sydney',
    postCode: '2000',
    state: 'NSW',
    country: 'AU',
    email: 'test@test.com',
  },
  DE: {
    firstName: 'Test',
    lastName: 'User',
    addressLine1: '123 Test Straße',
    city: 'Berlin',
    postCode: '10115',
    country: 'DE',
    email: 'test@test.com',
  },
  FR: {
    firstName: 'Test',
    lastName: 'User',
    addressLine1: '123 Rue Test',
    city: 'Paris',
    postCode: '75001',
    country: 'FR',
    email: 'test@test.com',
  },
  IT: {
    firstName: 'Test',
    lastName: 'User',
    addressLine1: '123 Via Test',
    city: 'Rome',
    postCode: '00100',
    country: 'IT',
    email: 'test@test.com',
  },
  ES: {
    firstName: 'Test',
    lastName: 'User',
    addressLine1: '123 Calle Test',
    city: 'Madrid',
    postCode: '28001',
    country: 'ES',
    email: 'test@test.com',
  },
  JP: {
    firstName: 'Test',
    lastName: 'User',
    addressLine1: '1-1-1 Test',
    city: 'Tokyo',
    postCode: '100-0001',
    country: 'JP',
    email: 'test@test.com',
  },
  CN: {
    firstName: 'Test',
    lastName: 'User',
    addressLine1: '123 Test Road',
    city: 'Beijing',
    postCode: '100000',
    country: 'CN',
    email: 'test@test.com',
  },
};

// =============================================================================
// TYPES
// =============================================================================

interface CountryTestResult {
  shipmentMethodsCount: number;
  quoteOk: boolean;
  fulfillmentCountry?: string;
  productPrice?: number;
  cheapestShipping?: number;
  errorCode?: string;
  errorMessage?: string;
  inferredSupport: boolean;
  skuResults?: Record<string, {
    quoteOk: boolean;
    shipmentMethodsCount: number;
    errorMessage?: string;
  }>;
}

interface TestResponse {
  testedAt: string;
  skusTested: string[];
  countriesTested: string[];
  countries: Record<string, CountryTestResult>;
  summary: {
    supportedCountries: string[];
    unsupportedCountries: string[];
    isGlobalReach: boolean;
    conclusion: string;
  };
}

// =============================================================================
// QUOTE TESTING FUNCTION
// =============================================================================

async function testQuoteForCountry(
  gelatoClient: ReturnType<typeof getGelatoClient>,
  countryCode: string,
  skuUid: string
): Promise<{
  quoteOk: boolean;
  shipmentMethodsCount: number;
  fulfillmentCountry?: string;
  productPrice?: number;
  cheapestShipping?: number;
  errorCode?: string;
  errorMessage?: string;
}> {
  const address = TEST_ADDRESSES[countryCode];
  if (!address) {
    return {
      quoteOk: false,
      shipmentMethodsCount: 0,
      errorCode: 'NO_TEST_ADDRESS',
      errorMessage: `No test address configured for ${countryCode}`,
    };
  }

  const quoteRequest: GelatoQuoteRequest = {
    orderReferenceId: `TEST-${countryCode}-${Date.now()}`,
    customerReferenceId: `TEST-CUST-${countryCode}`,
    currency: 'GBP',
    allowMultipleQuotes: false,
    recipient: address as GelatoRecipient,
    products: [
      {
        itemReferenceId: `item-${Date.now()}`,
        productUid: skuUid,
        quantity: 1,
        files: [], // Empty for quotes
      },
    ],
  };

  try {
    const response = await gelatoClient.quoteOrder(quoteRequest);
    
    const firstQuote = response.quotes?.[0];
    if (!firstQuote) {
      return {
        quoteOk: false,
        shipmentMethodsCount: 0,
        errorCode: 'NO_QUOTES',
        errorMessage: 'No quotes returned from Gelato',
      };
    }

    const shipmentMethods = firstQuote.shipmentMethods || [];
    const productPrice = firstQuote.products?.[0]?.price;
    const cheapestShipping = shipmentMethods.length > 0
      ? Math.min(...shipmentMethods.map(m => m.price))
      : undefined;

    return {
      quoteOk: true,
      shipmentMethodsCount: shipmentMethods.length,
      fulfillmentCountry: firstQuote.fulfillmentCountry,
      productPrice,
      cheapestShipping,
    };
  } catch (error: any) {
    // Parse Gelato error response if possible
    let errorCode = 'UNKNOWN_ERROR';
    let errorMessage = error.message;

    if (error.message.includes('Gelato API error')) {
      try {
          const jsonMatch = error.message.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const errorData = JSON.parse(jsonMatch[0]);
          errorCode = errorData.code || 'API_ERROR';
          errorMessage = errorData.details?.[0]?.message || errorData.message || error.message;
        }
      } catch {
        // Keep original error message
      }
    }

    return {
      quoteOk: false,
      shipmentMethodsCount: 0,
      errorCode,
      errorMessage,
    };
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    const accessResponse = await requireDebugAdmin(request, '/api/debug/gelato/country-support');
    if (accessResponse) {
      return accessResponse;
    }
  }

  console.log('[DEBUG] Gelato country support check started');

  const startTime = Date.now();
  const results: Record<string, CountryTestResult> = {};
  
  let gelatoClient: ReturnType<typeof getGelatoClient>;
  try {
    gelatoClient = getGelatoClient();
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to initialize Gelato client',
      message: error.message,
      hint: 'Check that GELATO_API_KEY is set in environment variables',
    }, { status: 500 });
  }

  // Test each country
  for (const countryCode of COUNTRIES_TO_TEST) {
    console.log(`[DEBUG] Testing country: ${countryCode}`);
    
    const skuResults: Record<string, {
      quoteOk: boolean;
      shipmentMethodsCount: number;
      errorMessage?: string;
    }> = {};

    let bestResult: CountryTestResult = {
      shipmentMethodsCount: 0,
      quoteOk: false,
      inferredSupport: false,
    };

    // Test each SKU for this country
    for (const sku of SKUS_TO_TEST) {
      const result = await testQuoteForCountry(gelatoClient, countryCode, sku);
      
      skuResults[sku] = {
        quoteOk: result.quoteOk,
        shipmentMethodsCount: result.shipmentMethodsCount,
        errorMessage: result.errorMessage,
      };

      // Track the best result (most shipping options)
      if (result.quoteOk && result.shipmentMethodsCount > bestResult.shipmentMethodsCount) {
        bestResult = {
          shipmentMethodsCount: result.shipmentMethodsCount,
          quoteOk: true,
          fulfillmentCountry: result.fulfillmentCountry,
          productPrice: result.productPrice,
          cheapestShipping: result.cheapestShipping,
          inferredSupport: true,
          skuResults,
        };
      }
    }

    // If no SKU worked, capture the error from the first SKU
    if (!bestResult.quoteOk) {
      const firstSkuResult = await testQuoteForCountry(gelatoClient, countryCode, SKUS_TO_TEST[0]);
      bestResult = {
        shipmentMethodsCount: 0,
        quoteOk: false,
        errorCode: firstSkuResult.errorCode,
        errorMessage: firstSkuResult.errorMessage,
        inferredSupport: false,
        skuResults,
      };
    }

    results[countryCode] = bestResult;
    
    console.log(
      `[DEBUG] ${countryCode}: quoteOk=${bestResult.quoteOk}, ` +
      `shipmentMethods=${bestResult.shipmentMethodsCount}, ` +
      `fulfillmentCountry=${bestResult.fulfillmentCountry || 'N/A'}`
    );

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Generate summary
  const supportedCountries = Object.entries(results)
    .filter(([_, r]) => r.inferredSupport)
    .map(([code]) => code);
  
  const unsupportedCountries = Object.entries(results)
    .filter(([_, r]) => !r.inferredSupport)
    .map(([code]) => code);

  const nonGbSupported = supportedCountries.filter(c => c !== 'GB');
  const isGlobalReach = nonGbSupported.length > 0;

  let conclusion: string;
  if (isGlobalReach) {
    conclusion = `✅ Gelato supports GLOBAL fulfillment. ${supportedCountries.length}/${COUNTRIES_TO_TEST.length} countries supported including: ${nonGbSupported.join(', ')}. NOT UK-only.`;
  } else if (supportedCountries.includes('GB')) {
    conclusion = `⚠️ Gelato appears UK-ONLY in this test. Only GB returned valid quotes. Check API credentials or account settings.`;
  } else {
    conclusion = `❌ Gelato returned NO valid quotes for ANY country. Check API key and account configuration.`;
  }

  const response: TestResponse = {
    testedAt: new Date().toISOString(),
    skusTested: SKUS_TO_TEST,
    countriesTested: COUNTRIES_TO_TEST,
    countries: results,
    summary: {
      supportedCountries,
      unsupportedCountries,
      isGlobalReach,
      conclusion,
    },
  };

  const elapsed = Date.now() - startTime;
  console.log(`[DEBUG] Country support check completed in ${elapsed}ms`);
  console.log(`[DEBUG] Conclusion: ${conclusion}`);

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
