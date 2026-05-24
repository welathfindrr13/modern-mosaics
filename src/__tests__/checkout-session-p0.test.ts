import { beforeEach, describe, expect, it, vi } from 'vitest';

const quoteOrder = vi.fn();
const stripeCreate = vi.fn();
const getByCloudinaryPublicId = vi.fn();
const getTrustedUnitPriceForCurrency = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue(null),
  getAuthenticatedUser: vi.fn().mockResolvedValue({ uid: 'user-1', email: 'buyer@example.com' }),
  getUserEmail: vi.fn().mockResolvedValue('buyer@example.com'),
}));

vi.mock('@/lib/rate-limit', () => ({
  buildRateLimitKey: vi.fn().mockReturnValue('checkout:user-1'),
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10, resetTime: Date.now() + 1000 }),
  createRateLimitResponse: vi.fn(),
  getRateLimitHeaders: vi.fn().mockReturnValue({}),
  resolveRateLimitPolicy: vi.fn().mockReturnValue({ limit: 10, windowMs: 60_000, message: 'limited', body: {} }),
}));

vi.mock('@/lib/gelato', async () => {
  const actual = await vi.importActual<typeof import('@/lib/gelato')>('@/lib/gelato');
  return {
    ...actual,
    getGelatoClient: vi.fn(() => ({ quoteOrder })),
  };
});

vi.mock('@/lib/stripe', () => ({
  getServerStripe: vi.fn(() => ({
    checkout: {
      sessions: {
        create: stripeCreate,
      },
    },
  })),
}));

vi.mock('@/utils/firestore-admin', () => ({
  adminImageOperations: {
    getByCloudinaryPublicId,
  },
}));

vi.mock('@/lib/confirmation-nonce', () => ({
  generateConfirmationNonce: vi.fn(() => 'nonce_123'),
}));

vi.mock('@/utils/priceUtils', () => ({
  getTrustedUnitPriceForCurrency,
}));

const POSTER_12X16 = 'flat_300x400-mm-12x16-inch_170-gsm-65lb-uncoated_4-0_ver';

function checkoutRequest(overrides: Record<string, unknown> = {}) {
  const body = {
    productUid: POSTER_12X16,
    imagePublicId: 'modern-mosaics/user_1/image',
    quantity: 1,
    shippingAddress: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      line1: '1 Test Street',
      city: 'London',
      postalCode: 'SW1A 1AA',
      country: 'GB',
      email: 'buyer@example.com',
    },
    shippingMethodUid: 'ship_standard',
    sizeKey: '12x16',
    productName: 'Tampered Product',
    productPrice: 0,
    shippingCost: 0,
    shippingCurrency: 'GBP',
    total: 0,
    ...overrides,
  };

  return {
    json: vi.fn().mockResolvedValue(body),
    headers: new Headers(),
  } as any;
}

function freshQuote(methodUid = 'ship_standard') {
  quoteOrder.mockResolvedValue({
    quotes: [
      {
        products: [{ productUid: POSTER_12X16, quantity: 1, price: 10, currency: 'GBP', options: [] }],
        fulfillmentCountry: 'GB',
        shipmentMethods: [
          {
            shipmentMethodUid: methodUid,
            name: 'Standard',
            price: 4.25,
            initialPrice: 4.25,
            currency: 'GBP',
            minDeliveryDays: 2,
            maxDeliveryDays: 4,
          },
        ],
      },
    ],
    errors: [],
  });
}

describe('checkout session P0 hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = 'demo-cloud';
    process.env.STRIPE_SUCCESS_URL = 'https://example.com/order/confirmation';
    process.env.STRIPE_CANCEL_URL = 'https://example.com/order';
    getByCloudinaryPublicId.mockResolvedValue(null);
    getTrustedUnitPriceForCurrency.mockReturnValue({
      baseGBP: 999,
      currency: 'GBP',
      fxRate: 1,
      converted: 999,
      stripeUnitAmount: 99900,
    });
    freshQuote();
    stripeCreate.mockResolvedValue({ id: 'cs_test_123', url: 'https://stripe.test/session' });
  });

  it('charges fresh server-quoted shipping when client reports shippingCost zero', async () => {
    const { POST } = await import('@/app/api/checkout/session/route');

    const response = await POST(checkoutRequest());

    expect(response.status).toBe(200);
    expect(stripeCreate).toHaveBeenCalledTimes(1);
    const payload = stripeCreate.mock.calls[0][0];
    expect(payload.line_items[0].price_data.unit_amount).toBe(2699);
    expect(payload.line_items[1].price_data.unit_amount).toBe(425);
    expect(payload.metadata.clientReportedShippingCost).toBe('0.00');
    expect(payload.metadata.serverQuotedShippingCost).toBe('4.25');
    expect(payload.metadata.basePriceGBP).toBe('26.99');
  });

  it('rejects a fake shippingMethodUid before Stripe session creation', async () => {
    const { POST } = await import('@/app/api/checkout/session/route');

    const response = await POST(checkoutRequest({ shippingMethodUid: 'fake_method' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('INVALID_INPUT');
    expect(stripeCreate).not.toHaveBeenCalled();
  });

  it('rejects foreign image public IDs before Stripe session creation', async () => {
    const { POST } = await import('@/app/api/checkout/session/route');

    const response = await POST(checkoutRequest({ imagePublicId: 'modern-mosaics/other_user/image' }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('FORBIDDEN_IMAGE');
    expect(stripeCreate).not.toHaveBeenCalled();
  });
});
