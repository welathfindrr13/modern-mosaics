import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAuthenticatedUser = vi.fn();
const getByUserId = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue(null),
  getAuthenticatedUser,
}));

vi.mock('@/utils/firestore-admin', () => ({
  adminOrderOperations: {
    getByUserId,
  },
}));

describe('/api/orders/list Firestore failure handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedUser.mockResolvedValue({ uid: 'user-1', email: 'buyer@example.com' });
  });

  it('returns a true empty order list when the user has no orders', async () => {
    const { GET } = await import('@/app/api/orders/list/route');
    getByUserId.mockResolvedValueOnce([]);

    const response = await GET({} as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ orders: [] });
  });

  it('does not return a fake empty list when Firestore read fails', async () => {
    const { GET } = await import('@/app/api/orders/list/route');
    getByUserId.mockRejectedValueOnce(new Error('Firestore unavailable'));

    const response = await GET({} as any);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.orders).toBeUndefined();
    expect(body).toMatchObject({
      error: 'Orders are temporarily unavailable.',
      code: 'ORDERS_UNAVAILABLE',
    });
  });
});
