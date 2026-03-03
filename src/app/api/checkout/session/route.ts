import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getAuthenticatedUser, getUserEmail } from '@/lib/api-auth';
import { getServerStripe } from '@/lib/stripe';
import { OrderCreateRequest } from '@/models/order';
import {
  getTrustedUnitPriceForCurrency,
  deriveProductType,
  deriveSizeKey,
  type CurrencyCode,
} from '@/utils/priceUtils';
import { getCurrencyForCountry } from '@/utils/currency';
import {
  validateCurrency,
  toStripeUnitAmount,
} from '@/utils/fx';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';
import { generateConfirmationNonce } from '@/lib/confirmation-nonce';

// =============================================================================
// HARDENED CHECKOUT SESSION ENDPOINT
// 
// SECURITY: This endpoint is the source of truth for pricing and quantity.
// Client-supplied prices, quantities, and currencies are IGNORED.
// Currency is derived server-side from shipping address country.
// =============================================================================

/**
 * Interface for checkout session request
 */
interface CheckoutSessionRequest extends Omit<OrderCreateRequest, 'cropParams'> {
  productPrice: number;     // IGNORED - computed server-side
  shippingCost: number;     // Trusted (from Gelato quote in derived currency)
  shippingCurrency?: string; // Expected to match derived currency
  total: number;            // IGNORED - computed server-side
  productName: string;
  transforms?: string;
  sizeKey?: string;
  // v1: Crop params for deterministic cropping
  cropParams?: string;      // Serialized crop params (x,y,width,height,rotation)
  sourceWidth?: number;     // Source image width
  sourceHeight?: number;    // Source image height
}

/**
 * POST handler for creating Stripe checkout sessions
 * 
 * SECURITY HARDENING:
 * - Quantity is ALWAYS 1 (multi-qty not supported)
 * - Price is computed server-side from trusted MSRP table
 * - Currency is DERIVED server-side from shipping country
 * - Client-supplied productPrice, total, and currency are IGNORED
 * - FX conversion is performed server-side
 */
export async function POST(request: NextRequest) {
  // Check authentication using Firebase Auth
  const authResponse = await requireAuth(request);
  if (authResponse) {
    return authResponse;
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const rateLimit = checkRateLimit(`checkout:session:${user.uid}`, 12, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many checkout attempts. Please wait and try again.', code: 'RATE_LIMITED' },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    // Parse request body
    const orderData: CheckoutSessionRequest = await request.json();
    
    // ==========================================================================
    // QUANTITY ENFORCEMENT (MVP: only quantity=1 allowed)
    // ==========================================================================
    if (orderData.quantity !== undefined && orderData.quantity !== 1) {
      return NextResponse.json(
        { error: 'Invalid quantity. Only single-item orders are currently supported.', code: 'INVALID_INPUT' }, 
        { status: 400 }
      );
    }
    const quantity = 1; // LOCKED
    
    // ==========================================================================
    // VALIDATE REQUIRED FIELDS
    // ==========================================================================
    if (!orderData.productUid || 
        !orderData.imagePublicId || 
        !orderData.shippingAddress || 
        !orderData.shippingMethodUid ||
        !orderData.productName) {
      return NextResponse.json(
        { error: 'Missing required order information', code: 'INVALID_INPUT' }, 
        { status: 400 }
      );
    }

    // ==========================================================================
    // DERIVE CURRENCY SERVER-SIDE (ignore client currency)
    // ==========================================================================
    const countryCode = orderData.shippingAddress.country?.toUpperCase();
    if (!countryCode) {
      return NextResponse.json(
        { error: 'Missing shipping country', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }
    
    const derivedCurrencyRaw = getCurrencyForCountry(countryCode);
    
    // Validate it's a supported currency
    let currency: CurrencyCode;
    try {
      currency = validateCurrency(derivedCurrencyRaw);
    } catch (e) {
      // Fallback to GBP for unsupported currencies
      currency = 'GBP';
    }

    // ==========================================================================
    // DERIVE PRODUCT TYPE AND SIZE FROM productUid
    // ==========================================================================
    const productType = deriveProductType(orderData.productUid);
    if (!productType) {
      return NextResponse.json(
        { error: 'Invalid product configuration', code: 'INVALID_INPUT' }, 
        { status: 400 }
      );
    }
    
    // Prefer sizeKey from payload, fall back to deriving from UID
    const sizeKey = orderData.sizeKey || deriveSizeKey(orderData.productUid);
    if (!sizeKey) {
      return NextResponse.json(
        { error: 'Invalid product size configuration', code: 'INVALID_INPUT' }, 
        { status: 400 }
      );
    }
    
    // ==========================================================================
    // COMPUTE TRUSTED PRICE WITH FX CONVERSION (ignore client price)
    // ==========================================================================
    const priceResult = getTrustedUnitPriceForCurrency(productType, sizeKey, currency);
    
    if (!priceResult) {
      return NextResponse.json(
        { error: 'Unable to determine product price. Please try again.', code: 'INVALID_INPUT' }, 
        { status: 400 }
      );
    }
    
    // ==========================================================================
    // VALIDATE SHIPPING COST AND CURRENCY
    // ==========================================================================
    const shippingCost = orderData.shippingCost ?? 0;
    if (shippingCost < 0 || isNaN(shippingCost)) {
      return NextResponse.json(
        { error: 'Invalid shipping cost', code: 'INVALID_INPUT' }, 
        { status: 400 }
      );
    }
    
    // Validate shipping currency matches derived currency
    // TODO: Make shippingCurrency required once UI is updated
    if (orderData.shippingCurrency && orderData.shippingCurrency.toUpperCase() !== currency) {
      return NextResponse.json(
        { error: `Currency mismatch: shipping is in ${orderData.shippingCurrency} but checkout is in ${currency}`, code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }
    
    // ==========================================================================
    // COMPUTE TOTAL SERVER-SIDE (ignore client total)
    // ==========================================================================
    const trustedProductPrice = priceResult.converted;
    const trustedProductTotal = trustedProductPrice * quantity;
    const trustedTotal = trustedProductTotal + shippingCost;
    
    // ==========================================================================
    // BUILD STRIPE LINE ITEMS WITH CONVERTED PRICES
    // ==========================================================================
    const authenticatedEmail = await getUserEmail(request);
    const checkoutEmail = authenticatedEmail || orderData.shippingAddress.email || undefined;
    const stripe = getServerStripe();

    // Product line item with converted price
    const productUnitAmount = priceResult.stripeUnitAmount;
    
    const lineItems: Array<{
      price_data: {
        currency: string;
        product_data: { name: string; description: string; images: string[] };
        unit_amount: number;
      };
      quantity: number;
    }> = [
      {
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: orderData.productName,
            description: `Custom mosaic artwork - ${sizeKey}`,
            images: [`https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/${orderData.imagePublicId}`],
          },
          unit_amount: productUnitAmount,
        },
        quantity: quantity, // ALWAYS 1
      },
    ];

    // Add shipping as separate line item if present
    if (shippingCost > 0) {
      const shippingUnitAmount = toStripeUnitAmount(shippingCost, currency);
      lineItems.push({
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: 'Shipping',
            description: 'Delivery to your address',
            images: [],
          },
          unit_amount: shippingUnitAmount,
        },
        quantity: 1,
      });
    }

    // ==========================================================================
    // INTEGRITY ASSERTIONS (fail-safe)
    // ==========================================================================
    const stripeShippingAmount = toStripeUnitAmount(shippingCost, currency);
    // Sanity check: amounts should be positive integers
    if (productUnitAmount <= 0 || !Number.isInteger(productUnitAmount)) {
      return NextResponse.json(
        { error: 'Price calculation error. Please try again.', code: 'CHECKOUT_ERROR' }, 
        { status: 500 }
      );
    }

    console.info(`[CHECKOUT] Session create request accepted (${productType}/${sizeKey}, ${currency})`);

    const confirmationNonce = generateConfirmationNonce();
    const successUrl = new URL(
      process.env.STRIPE_SUCCESS_URL || 'http://localhost:3000/order/confirmation'
    );
    successUrl.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');
    successUrl.searchParams.set('confirmation_nonce', confirmationNonce);

    // Create the checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: user.uid,
      ...(checkoutEmail ? { customer_email: checkoutEmail } : {}),
      line_items: lineItems,
      success_url: successUrl.toString(),
      cancel_url: process.env.STRIPE_CANCEL_URL || 'http://localhost:3000/order',
      metadata: {
        // =================================================================
        // FULL AUDIT TRAIL for currency conversion verification
        // =================================================================
        productUid: orderData.productUid,
        productType: productType,
        sizeKey: sizeKey,
        quantity: quantity.toString(), // ALWAYS "1"
        
        // GBP base pricing (canonical source)
        basePriceGBP: priceResult.baseGBP.toFixed(2),
        
        // FX conversion details
        fxRateUsed: priceResult.fxRate.toFixed(6),
        fxSource: 'static', // TODO: Update when live FX is added
        
        // Charged amounts (in target currency)
        chargedUnitPrice: priceResult.converted.toFixed(2),
        chargedCurrency: currency,
        shippingCost: shippingCost.toFixed(2),
        shippingCurrency: currency,
        trustedTotal: trustedTotal.toFixed(2),
        
        // Stripe unit amounts (for verification)
        stripeProductAmount: productUnitAmount.toString(),
        stripeShippingAmount: stripeShippingAmount.toString(),
        
        // Original request data
        userUid: user.uid,
        confirmationNonce,
        imagePublicId: orderData.imagePublicId,
        shippingMethodUid: orderData.shippingMethodUid,
        shippingAddress: JSON.stringify(orderData.shippingAddress),
        transforms: orderData.transforms || '',
        
        // v1: Crop params for deterministic cropping
        cropParams: orderData.cropParams || '',
        sourceWidth: orderData.sourceWidth?.toString() || '',
        sourceHeight: orderData.sourceHeight?.toString() || '',
        
        // Country for verification
        destinationCountry: countryCode,
        
        // Legacy field for backward compatibility
        size: orderData.size || sizeKey,
        currency: currency, // Legacy field
      },
      shipping_address_collection: {
        allowed_countries: ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'JP'],
      },
      billing_address_collection: 'auto',
    });

    return NextResponse.json(
      {
        sessionId: checkoutSession.id,
        url: checkoutSession.url,
        // Include derived currency for UI confirmation
        derivedCurrency: currency,
      },
      { headers: getRateLimitHeaders(rateLimit) }
    );

  } catch (error: any) {
    console.error('[CHECKOUT] Session creation failed:', error?.message);
    return NextResponse.json(
      { error: 'Failed to create checkout session. Please try again.', code: 'CHECKOUT_ERROR' },
      { status: 500 }
    );
  }
}
