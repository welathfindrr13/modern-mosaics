import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getUserEmail, getAuthenticatedUser } from '@/lib/api-auth';
import { getGelatoClient, GelatoQuoteRequest } from '@/lib/gelato';
import {
  getTrustedUnitPriceForCurrency,
  deriveProductType,
  deriveSizeKey,
  type CurrencyCode,
} from '@/utils/priceUtils';
import { getCurrencyForCountry } from '@/utils/currency';
import { validateCurrency } from '@/utils/fx';
import {
  buildRateLimitKey,
  checkRateLimit,
  createRateLimitResponse,
  getRateLimitHeaders,
  resolveRateLimitPolicy,
} from '@/lib/rate-limit';
import { getValidationMessage, orderQuoteRequestSchema } from '@/schemas/api';

/**
 * POST handler for getting shipping quotes from Gelato
 * This endpoint calculates shipping options and costs for a given product and address
 * 
 * SECURITY: Currency is derived SERVER-SIDE from country, NOT trusted from client.
 */
export async function POST(request: NextRequest) {
  // Check authentication using Firebase Auth
  const authResponse = await requireAuth(request);
  if (authResponse) {
    // If requireAuth returns a response, it means auth failed
    return authResponse;
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const rateLimitPolicy = resolveRateLimitPolicy('ordersQuote', user);
    const rateLimit = await checkRateLimit(
      buildRateLimitKey('orders:quote', request, user.uid),
      rateLimitPolicy.limit,
      rateLimitPolicy.windowMs
    );
    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimitPolicy.message,
        rateLimit,
        rateLimitPolicy.body
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    const parsedBody = orderQuoteRequestSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: getValidationMessage(parsedBody.error), code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    const quoteData = parsedBody.data;
    
    // ==========================================================================
    // DERIVE CURRENCY SERVER-SIDE (ignore client currency)
    // ==========================================================================
    const countryCode = quoteData.shippingAddress.country.toUpperCase();
    const derivedCurrencyRaw = getCurrencyForCountry(countryCode);
    
    // Validate it's a supported currency
    let currency: CurrencyCode;
    try {
      currency = validateCurrency(derivedCurrencyRaw);
    } catch (e) {
      // Fallback to GBP for unsupported currencies
      currency = 'GBP';
    }
    
    // Set default values
    const quantity = quoteData.quantity || 1;
    
    // Generate unique reference IDs for the quote
    const email = await getUserEmail(request) || 'user@example.com';
    const userId = email.split('@')[0] || 'user';
    const orderReferenceId = `QUOTE-${userId.substring(0, 8)}-${Date.now()}`;
    const customerReferenceId = `CUST-${userId.substring(0, 8)}-${Date.now()}`;
    
    // Create Gelato v4 quote request
    const gelatoQuoteRequest: GelatoQuoteRequest = {
      orderReferenceId,
      customerReferenceId,
      currency,
      allowMultipleQuotes: false,
      recipient: {
        firstName: quoteData.shippingAddress.firstName,
        lastName: quoteData.shippingAddress.lastName,
        addressLine1: quoteData.shippingAddress.line1,
        addressLine2: quoteData.shippingAddress.line2,
        city: quoteData.shippingAddress.city,
        postCode: quoteData.shippingAddress.postalCode,
        state: quoteData.shippingAddress.state,
        country: quoteData.shippingAddress.country.toUpperCase(),
        email: quoteData.shippingAddress.email || email,
        phone: quoteData.shippingAddress.phone
      },
      products: [{
        itemReferenceId: `item-${Date.now()}`,
        productUid: quoteData.productUid,
        quantity,
        files: [] // Empty for quotes
      }]
    };
    
    // Get shipping quote from Gelato
    const gelatoClient = getGelatoClient();
    const quoteResponse = await gelatoClient.quoteOrder(gelatoQuoteRequest);
    
    // Extract data from Gelato v4 response structure
    const firstQuote = quoteResponse.quotes[0];
    if (!firstQuote) {
      throw new Error('No quotes returned from Gelato');
    }
    
    const gelatoProductPrice = firstQuote.products[0]?.price || 0;
    // Convert Gelato shipment methods to our expected format
    const shippingMethods = firstQuote.shipmentMethods.map(method => ({
      uid: method.shipmentMethodUid,
      name: method.name,
      price: method.price,
      currency: method.currency,
      minTransitDays: method.minDeliveryDays,
      maxTransitDays: method.maxDeliveryDays,
    }));
    
    // ==========================================================================
    // GET CONVERTED RETAIL PRICE (server-side FX conversion)
    // ==========================================================================
    const productType = deriveProductType(quoteData.productUid);
    const sizeKey = deriveSizeKey(quoteData.productUid);
    
    if (!productType || !sizeKey) {
      return NextResponse.json(
        { error: 'Invalid product configuration', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }
    
    const priceResult = getTrustedUnitPriceForCurrency(productType, sizeKey, currency);
    
    if (!priceResult) {
      return NextResponse.json(
        { error: 'Unable to determine product price', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }
    
    // Format the response with converted price
    const response = {
      // Gelato costs (informational only)
      gelatoProductPrice,
      fulfillmentCountry: firstQuote.fulfillmentCountry,
      
      // Shipping methods (in derived currency from Gelato)
      shippingMethods,
      
      // Derived currency (server-side, authoritative)
      derivedCurrency: currency,
      
      // Converted retail price (MSRP converted to target currency)
      productPrice: priceResult.converted,
      baseGBP: priceResult.baseGBP,
      fxRate: priceResult.fxRate,
      currency: currency, // Explicitly set to derived currency
      
      // Legacy field (for backward compatibility)
      total: priceResult.converted,
    };
    
    return NextResponse.json(response, { headers: getRateLimitHeaders(rateLimit) });
    
  } catch (error: any) {
    console.error('[QUOTE] Shipping quote failed:', error?.message || error);
    return NextResponse.json(
      { error: `Failed to get shipping quote: ${error.message}`, code: 'QUOTE_ERROR' },
      { status: 500 }
    );
  }
}
