import { getServerStripe } from '@/lib/stripe';
import {
  getGelatoClient,
  GelatoOrderRequest,
  GelatoOrderFile,
  mapAddressToGelato,
  validateGelatoAddress,
  GelatoAddress,
} from '@/lib/gelato';
import { printUrl, validatePrintUrl, makeCloudinaryPrintUrlFromSizeKey } from '@/utils/cloudinaryPrint';
import { PRINT_SIZES } from '@/utils/printSizes';
import { LocalOrder, OrderStatus } from '@/models/order';
import { adminDb, adminOrderOperations } from '@/utils/firestore-admin';
import type { SizeKey } from '@/data/printLabCatalog';

export type SessionFulfillmentState =
  | 'processing'
  | 'pending_payment'
  | 'fulfilled'
  | 'failed_retryable'
  | 'failed_non_retryable';

export type SessionFulfillmentRecord = {
  status?: SessionFulfillmentState;
  fulfillmentState?: SessionFulfillmentState;
  userUid?: string;
  gelatoOrderId?: string;
  orderDocId?: string;
  stripeSessionId?: string;
  stripePaymentStatus?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  updatedAtMs?: number;
};

type FulfillmentLeaseState = 'acquired' | 'processing' | 'fulfilled';

export type FulfillmentResult =
  | {
      status: 'fulfilled';
      localOrder: LocalOrder;
      idempotent: boolean;
      order: {
        id: string;
        referenceId: string;
        status: string;
        created: string;
      };
    }
  | { status: 'processing' }
  | { status: 'pending_payment'; paymentStatus: string };

export type FulfillmentErrorCode =
  | 'INVALID_SESSION_ID'
  | 'MISSING_METADATA'
  | 'INCOMPLETE_METADATA'
  | 'USER_MAPPING_MISSING'
  | 'INVALID_ADDRESS_PAYLOAD'
  | 'ADDRESS_VALIDATION_FAILED'
  | 'INVALID_PRODUCT_TYPE'
  | 'GELATO_ORDER_ID_MISSING'
  | 'UPSTREAM_TRANSIENT'
  | 'UNKNOWN_TRANSIENT';

export class FulfillmentError extends Error {
  code: FulfillmentErrorCode;
  retryable: boolean;

  constructor(code: FulfillmentErrorCode, message: string, retryable: boolean) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

export type FulfillmentErrorInfo = {
  code: FulfillmentErrorCode;
  message: string;
  retryable: boolean;
};

export type LegacyOrderLookupResult = {
  order: LocalOrder | null;
  failedPrecondition: boolean;
  lookupErrorCode?: string;
};

export function classifyFulfillmentError(error: unknown): FulfillmentErrorInfo {
  if (error instanceof FulfillmentError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    };
  }

  const message = error instanceof Error ? error.message : String(error || 'Unknown fulfillment error');
  const normalized = message.toLowerCase();

  const retryableSignals = [
    'timeout',
    'timed out',
    'fetch failed',
    'network',
    'connection reset',
    'econnreset',
    'enotfound',
    'eai_again',
    'deadline',
    'unavailable',
    'service unavailable',
    'rate limit',
    'too many requests',
    'firestore',
  ];
  const retryableStatusSignal = /\b(429|5\d\d)\b/;

  if (retryableSignals.some((signal) => normalized.includes(signal)) || retryableStatusSignal.test(normalized)) {
    return {
      code: 'UPSTREAM_TRANSIENT',
      message,
      retryable: true,
    };
  }

  return {
    code: 'UNKNOWN_TRANSIENT',
    message,
    retryable: true,
  };
}

const SESSION_FULFILLMENT_COLLECTION = 'stripeSessionFulfillmentState';
const PROCESSING_STALE_MS = 5 * 60 * 1000;

export function resolveSessionLeaseDecision(
  status: SessionFulfillmentState | undefined,
  updatedAtMs: number | undefined,
  nowMs: number,
  staleMs: number
): FulfillmentLeaseState {
  const stale = !updatedAtMs || nowMs - updatedAtMs > staleMs;
  if (status === 'fulfilled') {
    return 'fulfilled';
  }
  if (status === 'processing' && !stale) {
    return 'processing';
  }
  return 'acquired';
}

function sanitizeSessionId(sessionId: string): string {
  return sessionId.split('?')[0].trim();
}

async function acquireFulfillmentLease(stripeSessionId: string): Promise<FulfillmentLeaseState> {
  const ref = adminDb.collection(SESSION_FULFILLMENT_COLLECTION).doc(stripeSessionId);
  const nowMs = Date.now();

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      tx.set(ref, {
        status: 'processing',
        attempts: 1,
        updatedAtMs: nowMs,
        createdAtMs: nowMs,
      });
      return 'acquired' as const;
    }

    const data = snap.data() as
      | {
          status?: SessionFulfillmentState;
          attempts?: number;
          updatedAtMs?: number;
        }
      | undefined;
    const decision = resolveSessionLeaseDecision(data?.status, data?.updatedAtMs, nowMs, PROCESSING_STALE_MS);
    if (decision !== 'acquired') {
      return decision;
    }

    tx.set(
      ref,
      {
        status: 'processing',
        attempts: (data?.attempts ?? 0) + 1,
        updatedAtMs: nowMs,
      },
      { merge: true }
    );
    return 'acquired' as const;
  });
}

async function markFulfillmentState(
  stripeSessionId: string,
  updates: Record<string, unknown>
): Promise<void> {
  await adminDb
    .collection(SESSION_FULFILLMENT_COLLECTION)
    .doc(stripeSessionId)
    .set(
      {
        ...updates,
        updatedAtMs: Date.now(),
      },
      { merge: true }
    );
}

function nonRetryable(code: FulfillmentErrorCode, message: string): never {
  throw new FulfillmentError(code, message, false);
}

function retryable(code: FulfillmentErrorCode, message: string): never {
  throw new FulfillmentError(code, message, true);
}

export function toLocalOrderFromStoredOrder(storedOrder: any): LocalOrder {
  const shippingAddress = storedOrder.shippingAddress || {};
  const gelatoOrderId = storedOrder.gelatoOrderId || storedOrder.id;

  return {
    id: gelatoOrderId,
    referenceId: storedOrder.referenceId || gelatoOrderId,
    productName: storedOrder.productDetails?.name || 'Custom Print',
    productUid: storedOrder.productDetails?.uid || '',
    imageId: storedOrder.imageId || '',
    previewUrl: storedOrder.imageId
      ? `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/${storedOrder.imageId}`
      : undefined,
    quantity: storedOrder.quantity || 1,
    price: storedOrder.pricing?.productPrice || 0,
    shippingCost: storedOrder.pricing?.shippingCost || 0,
    total: storedOrder.pricing?.total || 0,
    currency: storedOrder.pricing?.currency || 'USD',
    status: (storedOrder.status || 'CREATED') as OrderStatus,
    shippingAddress: {
      firstName: shippingAddress.firstName || '',
      lastName: shippingAddress.lastName || '',
      line1: shippingAddress.addressLine1 || '',
      line2: shippingAddress.addressLine2,
      city: shippingAddress.city || '',
      postalCode: shippingAddress.postCode || '',
      state: shippingAddress.state,
      country: shippingAddress.country || '',
      email: shippingAddress.email,
      phone: shippingAddress.phone,
    },
    createdAt: storedOrder.createdAt || new Date().toISOString(),
    updatedAt: storedOrder.updatedAt,
  };
}

export function isFirestoreFailedPrecondition(error: unknown): boolean {
  const err = error as { code?: string | number; message?: string };
  const code = String(err?.code ?? '');
  const message = String(err?.message ?? '').toLowerCase();
  return code === '9' || code.toUpperCase().includes('FAILED_PRECONDITION') || message.includes('failed_precondition');
}

export async function getOrderByStripeSessionIdDetailed(stripeSessionId: string): Promise<LegacyOrderLookupResult> {
  try {
    const existing = await adminOrderOperations.getByStripeSessionId(stripeSessionId);
    return {
      order: existing?.order ? toLocalOrderFromStoredOrder(existing.order) : null,
      failedPrecondition: false,
    };
  } catch (error) {
    const err = error as { code?: string | number; message?: string };
    console.warn(
      '[FULFILLMENT] getOrderByStripeSessionId lookup failed:',
      err?.code ?? 'unknown',
      err?.message ?? 'unknown'
    );
    return {
      order: null,
      failedPrecondition: isFirestoreFailedPrecondition(error),
      lookupErrorCode: err?.code ? String(err.code) : undefined,
    };
  }
}

export async function getOrderByStripeSessionId(stripeSessionId: string): Promise<LocalOrder | null> {
  const result = await getOrderByStripeSessionIdDetailed(stripeSessionId);
  return result.order;
}

export async function getSessionFulfillmentState(rawSessionId: string): Promise<SessionFulfillmentRecord | null> {
  const stripeSessionId = sanitizeSessionId(rawSessionId);
  const snap = await adminDb.collection(SESSION_FULFILLMENT_COLLECTION).doc(stripeSessionId).get();
  if (!snap.exists) return null;
  return snap.data() as SessionFulfillmentRecord;
}

export async function getOrderFromFulfillmentState(rawSessionId: string): Promise<LocalOrder | null> {
  const state = await getSessionFulfillmentState(rawSessionId);
  if (!state?.userUid) return null;

  if (state.orderDocId) {
    const orderById = await adminOrderOperations.getById(state.userUid, state.orderDocId);
    if (orderById) {
      return toLocalOrderFromStoredOrder(orderById);
    }
  }

  if (state.gelatoOrderId) {
    const orderByGelatoId = await adminOrderOperations.getByUserAndGelatoOrderId(
      state.userUid,
      state.gelatoOrderId
    );
    if (orderByGelatoId) {
      return toLocalOrderFromStoredOrder(orderByGelatoId);
    }
  }

  return null;
}

export async function fulfillPaidCheckoutSession(
  rawSessionId: string,
  options?: { fallbackUserUid?: string | null; stripeEventId?: string | null }
): Promise<FulfillmentResult> {
  const stripeSessionId = sanitizeSessionId(rawSessionId);
  if (!stripeSessionId.startsWith('cs_')) {
    nonRetryable('INVALID_SESSION_ID', 'Invalid Stripe session ID');
  }

  const stateResolvedOrder = await getOrderFromFulfillmentState(stripeSessionId);
  if (stateResolvedOrder) {
    return {
      status: 'fulfilled',
      idempotent: true,
      localOrder: stateResolvedOrder,
      order: {
        id: stateResolvedOrder.id,
        referenceId: stateResolvedOrder.referenceId,
        status: stateResolvedOrder.status,
        created: stateResolvedOrder.createdAt,
      },
    };
  }

  const leaseState = await acquireFulfillmentLease(stripeSessionId);
  if (leaseState === 'processing') {
    return { status: 'processing' };
  }
  if (leaseState === 'fulfilled') {
    const order = await getOrderFromFulfillmentState(stripeSessionId);
    if (order) {
      return {
        status: 'fulfilled',
        idempotent: true,
        localOrder: order,
        order: {
          id: order.id,
          referenceId: order.referenceId,
          status: order.status,
          created: order.createdAt,
        },
      };
    }
    return { status: 'processing' };
  }

  const stripe = getServerStripe();
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(stripeSessionId);
  } catch (error: any) {
    retryable('UPSTREAM_TRANSIENT', `Failed to retrieve Stripe session: ${error?.message || error}`);
  }

  if (session.payment_status !== 'paid') {
    await markFulfillmentState(stripeSessionId, {
      status: 'pending_payment',
      fulfillmentState: 'pending_payment',
      stripeSessionId,
      stripePaymentStatus: session.payment_status,
      stripeEventId: options?.stripeEventId || null,
    });
    return { status: 'pending_payment', paymentStatus: session.payment_status };
  }

  const metadata = session.metadata;
  if (!metadata) {
    nonRetryable('MISSING_METADATA', 'Order data not found in session metadata');
  }

  const {
    productUid,
    imagePublicId,
    shippingMethodUid,
    size,
    sizeKey,
    quantity: quantityStr,
    currency,
    shippingAddress: shippingAddressStr,
    transforms,
  } = metadata;

  if (!productUid || !imagePublicId || !shippingMethodUid || !size || !shippingAddressStr) {
    nonRetryable('INCOMPLETE_METADATA', 'Incomplete checkout metadata');
  }

  const userUid = metadata.userUid || session.client_reference_id || options?.fallbackUserUid || null;
  if (!userUid) {
    nonRetryable('USER_MAPPING_MISSING', 'Missing user UID in checkout session');
  }

  const quantity = Number.parseInt(quantityStr || '1', 10) || 1;
  const orderCurrency = (currency || session.currency || 'usd').toUpperCase();

  let shippingAddress: GelatoAddress;
  try {
    shippingAddress = JSON.parse(shippingAddressStr);
  } catch {
    nonRetryable('INVALID_ADDRESS_PAYLOAD', 'Invalid shipping address payload');
  }

  const addressValidationError = validateGelatoAddress(shippingAddress);
  if (addressValidationError) {
    nonRetryable('ADDRESS_VALIDATION_FAILED', `Invalid shipping address: ${addressValidationError}`);
  }

  const referenceSeed = stripeSessionId.replace(/[^a-zA-Z0-9]/g, '').slice(-16) || 'session';
  const customerSeed = userUid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'customer';
  const orderReferenceId = `MM-${referenceSeed}`;
  const customerReferenceId = `CUST-${customerSeed}`;

  let printFileUrl: string;
  if (sizeKey && ['8x10', '12x16', '16x20', '18x24'].includes(sizeKey)) {
    printFileUrl = makeCloudinaryPrintUrlFromSizeKey(imagePublicId, sizeKey as SizeKey, transforms || undefined);
  } else {
    let sku: keyof typeof PRINT_SIZES;
    if (productUid.startsWith('flat_')) {
      sku = `poster-${size.toLowerCase()}` as keyof typeof PRINT_SIZES;
    } else if (productUid.startsWith('canvas_')) {
      const sizeStr = size.toLowerCase().replace('_', '-');
      sku = `canvas-${sizeStr}` as keyof typeof PRINT_SIZES;
    } else {
      nonRetryable('INVALID_PRODUCT_TYPE', 'Invalid product type');
    }
    printFileUrl = printUrl(imagePublicId, sku, transforms || undefined);
  }

  try {
    const isUrlValid = await validatePrintUrl(printFileUrl);
    if (!isUrlValid) {
      console.warn('[FULFILLMENT] Generated print URL failed validation');
    }
  } catch {
    console.warn('[FULFILLMENT] Print URL validation failed');
  }

  const files: GelatoOrderFile[] = [{ type: 'default', url: printFileUrl }];
  const gelatoShippingAddress = mapAddressToGelato(shippingAddress);
  const gelatoOrderRequest: GelatoOrderRequest = {
    orderReferenceId,
    customerReferenceId,
    currency: orderCurrency,
    items: [
      {
        itemReferenceId: `item-${stripeSessionId.slice(-8)}`,
        productUid,
        quantity,
        files,
      },
    ],
    shippingAddress: gelatoShippingAddress,
    shippingMethodUid,
  };

  const gelatoClient = getGelatoClient();
  let orderResponse;
  try {
    orderResponse = await gelatoClient.createOrder(gelatoOrderRequest);
  } catch (error) {
    const classified = classifyFulfillmentError(error);
    if (classified.retryable) {
      retryable(classified.code, classified.message);
    }
    nonRetryable(classified.code, classified.message);
  }

  const gelatoOrderId =
    orderResponse.gelatoOrderId || (orderResponse as any).id || (orderResponse as any).orderId;

  if (!gelatoOrderId) {
    nonRetryable('GELATO_ORDER_ID_MISSING', 'Gelato order response missing order ID');
  }

  let lineItems;
  try {
    lineItems = await stripe.checkout.sessions.listLineItems(stripeSessionId, { limit: 100 });
  } catch (error: any) {
    retryable('UPSTREAM_TRANSIENT', `Failed to retrieve Stripe line items: ${error?.message || error}`);
  }
  const shippingFromLineItemsMinor = lineItems.data
    .filter((item: any) => item.description?.toLowerCase().includes('shipping'))
    .reduce((sum: number, item: any) => sum + (item.amount_total || 0), 0);
  const shippingFromMetadataMinor = Number.parseInt(metadata.stripeShippingAmount || '0', 10);
  const shippingAmountMinor =
    shippingFromLineItemsMinor > 0
      ? shippingFromLineItemsMinor
      : Number.isFinite(shippingFromMetadataMinor)
      ? shippingFromMetadataMinor
      : 0;
  const totalAmountMinor = session.amount_total || 0;
  const productAmountMinor = Math.max(0, totalAmountMinor - shippingAmountMinor);
  const totalInCurrency = totalAmountMinor / 100;
  const productCost = productAmountMinor / 100;
  const shippingCost = shippingAmountMinor / 100;

  const localOrder: LocalOrder = {
    id: gelatoOrderId,
    referenceId: orderResponse.orderReferenceId || orderReferenceId,
    productName: `Custom Print - ${size}`,
    productUid,
    imageId: imagePublicId,
    previewUrl: `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/${imagePublicId}`,
    quantity,
    price: productCost,
    shippingCost: shippingCost,
    total: totalInCurrency,
    currency: orderCurrency,
    status: (orderResponse.status || 'CREATED') as OrderStatus,
    shippingAddress,
    createdAt: orderResponse.created || new Date().toISOString(),
  };

  let orderDocId: string;
  try {
    orderDocId = await adminOrderOperations.create(userUid, {
      referenceId: orderResponse.orderReferenceId || orderReferenceId,
      gelatoOrderId,
      stripeSessionId,
      stripeEventId: options?.stripeEventId || undefined,
      stripePaymentStatus: session.payment_status,
      fulfillmentState: 'fulfilled',
      imageId: imagePublicId,
      productDetails: {
        uid: productUid,
        name: `Custom Print - ${size}`,
        size: size,
        type: productUid.startsWith('flat_') ? 'poster' : 'canvas',
      },
      pricing: {
        productPrice: productCost,
        shippingCost: shippingCost,
        total: totalInCurrency,
        currency: orderCurrency,
      },
      quantity,
      status: (orderResponse.status ?? 'CREATED') as OrderStatus,
      shippingAddress: {
        firstName: gelatoShippingAddress.firstName,
        lastName: gelatoShippingAddress.lastName,
        addressLine1: gelatoShippingAddress.addressLine1,
        addressLine2: gelatoShippingAddress.addressLine2,
        city: gelatoShippingAddress.city,
        postCode: gelatoShippingAddress.postCode,
        state: gelatoShippingAddress.state,
        country: gelatoShippingAddress.country,
        email: gelatoShippingAddress.email || session.customer_email || '',
        phone: gelatoShippingAddress.phone,
      },
    });
  } catch (error: any) {
    retryable('UPSTREAM_TRANSIENT', `Failed to persist order in Firestore: ${error?.message || error}`);
  }

  await markFulfillmentState(stripeSessionId, {
    status: 'fulfilled',
    fulfillmentState: 'fulfilled',
    gelatoOrderId,
    userUid,
    orderDocId,
    stripeEventId: options?.stripeEventId || null,
    stripeSessionId,
    stripePaymentStatus: session.payment_status,
    fulfilledAtMs: Date.now(),
  });

  return {
    status: 'fulfilled',
    idempotent: false,
    localOrder,
    order: {
      id: gelatoOrderId,
      referenceId: orderResponse.orderReferenceId || orderReferenceId,
      status: orderResponse.status || 'CREATED',
      created: orderResponse.created || new Date().toISOString(),
    },
  };
}

export async function setFailedFulfillmentState(params: {
  sessionId: string;
  state: 'failed_retryable' | 'failed_non_retryable';
  eventId?: string | null;
  paymentStatus?: string | null;
  errorCode: string;
  errorMessage: string;
}): Promise<void> {
  await markFulfillmentState(params.sessionId, {
    status: params.state,
    fulfillmentState: params.state,
    stripeEventId: params.eventId || null,
    stripeSessionId: params.sessionId,
    stripePaymentStatus: params.paymentStatus || null,
    lastErrorCode: params.errorCode,
    lastErrorMessage: params.errorMessage,
    failedAtMs: Date.now(),
  });
}
