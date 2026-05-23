import { beforeEach, describe, expect, it, vi } from 'vitest';

const fulfillmentState = new Map<string, any>();
const createOrder = vi.fn();
const retrieveSession = vi.fn();
const listLineItems = vi.fn();
const createFirestoreOrder = vi.fn();

vi.mock('@/lib/gelato', async () => {
  const actual = await vi.importActual<typeof import('@/lib/gelato')>('@/lib/gelato');
  return {
    ...actual,
    getGelatoClient: vi.fn(() => ({ createOrder })),
  };
});

vi.mock('@/lib/stripe', () => ({
  getServerStripe: vi.fn(() => ({
    checkout: {
      sessions: {
        retrieve: retrieveSession,
        listLineItems,
      },
    },
  })),
}));

vi.mock('@/utils/cloudinaryPrint', async () => {
  const actual = await vi.importActual<typeof import('@/utils/cloudinaryPrint')>('@/utils/cloudinaryPrint');
  return {
    ...actual,
    validatePrintUrl: vi.fn().mockResolvedValue(true),
  };
});

vi.mock('@/utils/firestore-admin', () => ({
  adminDb: {
    collection: vi.fn((collectionName: string) => ({
      doc: vi.fn((docId: string) => ({
        get: vi.fn().mockResolvedValue({
          exists: fulfillmentState.has(docId),
          data: () => fulfillmentState.get(docId),
        }),
        set: vi.fn((updates: any, options?: any) => {
          fulfillmentState.set(docId, options?.merge ? { ...(fulfillmentState.get(docId) || {}), ...updates } : updates);
          return Promise.resolve();
        }),
      })),
    })),
    runTransaction: vi.fn(async (handler: any) => {
      const tx = {
        get: vi.fn(async (ref: any) => ref.get()),
        set: vi.fn((ref: any, updates: any, options?: any) => ref.set(updates, options)),
      };
      return handler(tx);
    }),
  },
  adminOrderOperations: {
    getByStripeSessionId: vi.fn().mockResolvedValue(null),
    getById: vi.fn().mockResolvedValue(null),
    getByUserAndGelatoOrderId: vi.fn().mockResolvedValue(null),
    create: createFirestoreOrder,
  },
}));

const POSTER_12X16 = 'flat_300x400-mm-12x16-inch_170-gsm-65lb-uncoated_4-0_ver';

describe('fulfillment idempotency P0', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fulfillmentState.clear();
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = 'demo-cloud';
    retrieveSession.mockResolvedValue({
      id: 'cs_retry_123',
      payment_status: 'paid',
      currency: 'gbp',
      amount_total: 3124,
      customer_email: 'buyer@example.com',
      client_reference_id: 'user-1',
      metadata: {
        productUid: POSTER_12X16,
        imagePublicId: 'modern-mosaics/user_1/image',
        shippingMethodUid: 'ship_standard',
        quantity: '1',
        currency: 'GBP',
        shippingAddress: JSON.stringify({
          firstName: 'Ada',
          lastName: 'Lovelace',
          line1: '1 Test Street',
          city: 'London',
          postalCode: 'SW1A 1AA',
          country: 'GB',
          email: 'buyer@example.com',
        }),
        stripeShippingAmount: '425',
      },
    });
    createOrder.mockResolvedValue({
      gelatoOrderId: 'gelato_1',
      orderReferenceId: 'MM-retry',
      status: 'CREATED',
      created: '2026-05-23T00:00:00.000Z',
    });
    createFirestoreOrder.mockResolvedValue('order_doc_1');
  });

  it('does not create a second Gelato order when retrying after Gelato create persisted state', async () => {
    const { fulfillPaidCheckoutSession } = await import('@/lib/checkout-fulfillment');

    listLineItems.mockRejectedValueOnce(new Error('Stripe temporary outage'));
    await expect(fulfillPaidCheckoutSession('cs_retry_123', { stripeEventId: 'evt_1' })).rejects.toMatchObject({
      code: 'UPSTREAM_TRANSIENT',
    });

    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(fulfillmentState.get('cs_retry_123')?.gelatoOrderId).toBe('gelato_1');

    listLineItems.mockResolvedValueOnce({
      data: [{ description: 'Shipping', amount_total: 425 }],
    });

    const result = await fulfillPaidCheckoutSession('cs_retry_123', { stripeEventId: 'evt_2' });

    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(createFirestoreOrder).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('fulfilled');
  });
});
