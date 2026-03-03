import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getGelatoClient, GelatoOrderRequest, GelatoOrderFile, mapAddressToGelato, validateGelatoAddress } from '@/lib/gelato';
import { OrderCreateRequest, OrderCreateResponse, OrderStatus, CropParams } from '@/models/order';
import { printUrl, makeCloudinaryPrintUrlFromSizeKey, CropParams as PrintCropParams } from '@/utils/cloudinaryPrint';
import { PRINT_SIZES } from '@/utils/printSizes';
import type { SizeKey } from '@/data/printLabCatalog';
// Note: Pricing is handled at checkout session creation, not here
// This route only handles Gelato order submission
import { getServerCloudinary } from '@/lib/cloudinary';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';

function logDirectOrderAudit(params: {
  uid: string | null;
  enabled: boolean;
  statusCode: number;
  reason: string;
}) {
  console.info(
    '[ORDER_CREATE_AUDIT]',
    JSON.stringify({
      env: process.env.NODE_ENV || 'unknown',
      uid: params.uid,
      enabled: params.enabled,
      statusCode: params.statusCode,
      reason: params.reason,
      timestamp: new Date().toISOString(),
    })
  );
}

/**
 * Parse crop params from serialized string
 * Format: "x,y,width,height,rotation?" e.g. "0.1,0.2,0.6,0.7,90"
 */
function parseCropParamsFromString(cropStr: string | undefined): PrintCropParams | undefined {
  if (!cropStr) return undefined;
  
  const parts = cropStr.split(',').map(s => s.trim());
  if (parts.length < 4) return undefined;
  
  const [xStr, yStr, wStr, hStr, rotStr] = parts;
  const x = parseFloat(xStr);
  const y = parseFloat(yStr);
  const width = parseFloat(wStr);
  const height = parseFloat(hStr);
  
  if ([x, y, width, height].some(n => isNaN(n))) return undefined;
  
  let rotation: 0 | 90 | 180 | 270 | undefined;
  if (rotStr) {
    const rot = parseInt(rotStr, 10);
    if (rot === 0 || rot === 90 || rot === 180 || rot === 270) {
      rotation = rot;
    }
  }
  
  return { x, y, width, height, rotation };
}

/**
 * Upscale image on-demand for print quality
 */
async function upscaleImageForPrint(originalPublicId: string): Promise<string> {
  const cloudinary = await getServerCloudinary();
  
  try {
    // Get the resource information to determine original dimensions
    const resourceInfo = await cloudinary.api.resource(originalPublicId);
    const originalWidth = resourceInfo.width;
    const originalHeight = resourceInfo.height;
    
    // Apply Cloudinary's Super-Resolution upscaling for print quality
    const upscaledUrl = cloudinary.url(originalPublicId, {
      transformation: [
        { effect: 'upscale', crop: 'scale', width: 4.0 },
        { quality: 'auto:best', fetch_format: 'auto', effect: 'sharpen:60' }
      ]
    });
    
    // Upload the upscaled version back to Cloudinary for Gelato to access
    const uploadResult = await cloudinary.uploader.upload(upscaledUrl, {
      folder: 'print_ready',
      overwrite: false,
      tags: ['upscaled', 'print-ready'],
      context: {
        transform_backend: 'cloudinary_sr',
        original_dimensions: `${originalWidth}x${originalHeight}`,
        original_public_id: originalPublicId
      }
    });
    
    console.info('[ORDER_CREATE] Print-ready image created');
    return uploadResult.public_id;
    
  } catch (error: any) {
    console.warn('[ORDER_CREATE] Upscale failed, falling back to original image');
    // Fallback to original image if upscaling fails
    return originalPublicId;
  }
}

/**
 * POST handler for creating orders with Gelato
 * This endpoint creates a print order and returns the order details
 */
export async function POST(request: NextRequest) {
  const isProduction = process.env.NODE_ENV === 'production';
  const isEnabledByFlag = process.env.ENABLE_DIRECT_ORDER_CREATE === 'true';
  const enabled = !isProduction && isEnabledByFlag;
  const authUser = await getAuthenticatedUser(request);
  const uid = authUser?.uid || null;

  // Production is hard-disabled with no override.
  if (isProduction) {
    logDirectOrderAudit({
      uid,
      enabled: false,
      statusCode: 410,
      reason: 'hard_disabled_in_production',
    });
    return NextResponse.json(
      {
        error: 'Direct order creation is permanently disabled in production.',
        code: 'ENDPOINT_DISABLED',
      },
      { status: 410 }
    );
  }

  if (!enabled) {
    logDirectOrderAudit({
      uid,
      enabled: false,
      statusCode: 403,
      reason: 'feature_flag_disabled',
    });
    return NextResponse.json(
      {
        error: 'Direct order creation is disabled. Use checkout flow.',
        code: 'ENDPOINT_DISABLED',
      },
      { status: 403 }
    );
  }

  if (!authUser?.uid) {
    logDirectOrderAudit({
      uid: null,
      enabled: true,
      statusCode: 401,
      reason: 'unauthorized',
    });
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const rateLimit = checkRateLimit(`orders:create:${authUser.uid}`, 3, 60_000);
    if (!rateLimit.allowed) {
      logDirectOrderAudit({
        uid: authUser.uid,
        enabled: true,
        statusCode: 429,
        reason: 'rate_limited',
      });
      return NextResponse.json(
        { error: 'Too many direct order attempts. Please wait and try again.', code: 'RATE_LIMITED' },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    // Parse request body
    const orderData: OrderCreateRequest = await request.json();
    
    // Validate required fields
    if (!orderData.productUid || 
        !orderData.imagePublicId || 
        !orderData.shippingAddress || 
        !orderData.shippingMethodUid ||
        !orderData.size) {
      return NextResponse.json(
        { error: 'Missing required order information', code: 'INVALID_INPUT' }, 
        { status: 400 }
      );
    }
    
    // RELIABILITY: Validate address has all required fields before sending to Gelato
    const addressValidationError = validateGelatoAddress(orderData.shippingAddress);
    if (addressValidationError) {
      return NextResponse.json(
        { error: `Invalid shipping address: ${addressValidationError}`, code: 'INVALID_INPUT' }, 
        { status: 400 }
      );
    }
    
    // Generate unique order reference IDs from verified UID (no email fallback).
    const seed = authUser.uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'user';
    const orderReferenceId = `MM-${seed}-${Date.now()}`;
    const customerReferenceId = `CUST-${seed}-${Date.now()}`;
    
    // Upscale image on-demand for print quality
    const printReadyPublicId = await upscaleImageForPrint(orderData.imagePublicId);
    
    // Get print-ready file URL using the upscaled image
    // Derive sizeKey from orderData.size (normalize to match SizeKey format)
    const sizeKey = orderData.size.toString().toLowerCase().replace('_', 'x') as SizeKey;
    
    // Parse crop params if provided (v1: for deterministic cropping)
    const cropParams = orderData.cropParams 
      ? (typeof orderData.cropParams === 'string' 
          ? parseCropParamsFromString(orderData.cropParams as unknown as string)
          : orderData.cropParams)
      : undefined;
    
    // Generate print URL with crop params if available
    let printFileUrl: string;
    if (cropParams && orderData.sourceWidth && orderData.sourceHeight) {
      // Use new function with crop params
      printFileUrl = makeCloudinaryPrintUrlFromSizeKey(
        printReadyPublicId,
        sizeKey,
        orderData.transforms,
        cropParams as PrintCropParams,
        orderData.sourceWidth,
        orderData.sourceHeight
      );
    } else {
      // Legacy: use old function without crop params (backward compatible)
      let sku: keyof typeof PRINT_SIZES;
      if (orderData.productUid.startsWith('flat_')) {
        sku = `poster-${orderData.size.toLowerCase()}` as keyof typeof PRINT_SIZES;
      } else if (orderData.productUid.startsWith('canvas_')) {
        const sizeStr = orderData.size.toLowerCase().replace('_', '-');
        sku = `canvas-${sizeStr}` as keyof typeof PRINT_SIZES;
      } else {
        return NextResponse.json({ error: 'Invalid product type', code: 'INVALID_INPUT' }, { status: 400 });
      }
      printFileUrl = printUrl(printReadyPublicId, sku, orderData.transforms);
    }
    
    // Create order files array
    const files: GelatoOrderFile[] = [
      { type: 'default', url: printFileUrl }
    ];
    
    // RELIABILITY: Map internal address fields to Gelato's required field names
    // Internal: line1, postalCode → Gelato: addressLine1, postCode
    const gelatoShippingAddress = mapAddressToGelato(orderData.shippingAddress);

    // Create order request using v4 structure
    const gelatoOrderRequest: GelatoOrderRequest = {
      orderReferenceId,
      customerReferenceId,
      currency: orderData.currency || 'USD',
      items: [{
        itemReferenceId: `item-${Date.now()}`,
        productUid: orderData.productUid,
        quantity: orderData.quantity || 1,
        files
      }],
      shippingAddress: gelatoShippingAddress,
      shippingMethodUid: orderData.shippingMethodUid
    };
    
    // Submit order to Gelato
    const gelatoClient = getGelatoClient();
    const orderResponse = await gelatoClient.createOrder(gelatoOrderRequest);
    
    // Format the response
    const response: OrderCreateResponse = {
      success: true,
      order: {
        id: orderResponse.gelatoOrderId,
        referenceId: orderResponse.orderReferenceId,
        status: orderResponse.status as OrderStatus,
        created: orderResponse.created
      }
    };
    
    logDirectOrderAudit({
      uid: authUser.uid,
      enabled: true,
      statusCode: 200,
      reason: 'success',
    });
    return NextResponse.json(response, { headers: getRateLimitHeaders(rateLimit) });
    
  } catch (error: any) {
    logDirectOrderAudit({
      uid: authUser.uid,
      enabled: true,
      statusCode: 500,
      reason: 'order_error',
    });
    console.error('[ORDER_CREATE] Order creation failed:', error?.message || error);
    return NextResponse.json(
      { error: 'Failed to create order. Please try again.', code: 'ORDER_ERROR' },
      { status: 500 }
    );
  }
}
