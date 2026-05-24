import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderStatus } from '@/models/order';

const getAuthenticatedUser = vi.fn();
const getOrderByGelatoId = vi.fn();
const getOrderByReferenceId = vi.fn();
const updateOrder = vi.fn();
const getOrderStatus = vi.fn();
const cancelOrder = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue(null),
  getAuthenticatedUser,
}));

vi.mock('@/lib/gelato', () => ({
  getGelatoClient: vi.fn(() => ({
    getOrderStatus,
    cancelOrder,
  })),
}));

vi.mock('@/utils/firestore-admin', () => ({
  adminOrderOperations: {
    getByUserAndGelatoOrderId: getOrderByGelatoId,
    getByUserAndReferenceId: getOrderByReferenceId,
    update: updateOrder,
  },
}));

function cancelRequest(orderId = 'gelato_123') {
  return {
    json: vi.fn().mockResolvedValue({ orderId }),
  } as any;
}

describe('order cancellation P1 persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedUser.mockResolvedValue({ uid: 'user-1', email: 'buyer@example.com' });
    getOrderByGelatoId.mockResolvedValue({
      id: 'order_doc_1',
      gelatoOrderId: 'gelato_123',
      referenceId: 'MM-123',
      status: OrderStatus.QUEUED,
    });
    getOrderByReferenceId.mockResolvedValue(null);
    getOrderStatus.mockResolvedValue({ status: 'QUEUED' });
    cancelOrder.mockResolvedValue({ success: true });
    updateOrder.mockResolvedValue(undefined);
  });

  it('updates the Firestore order status after Gelato cancellation succeeds', async () => {
    const { POST } = await import('@/app/api/orders/status/route');

    const response = await POST(cancelRequest());

    expect(response.status).toBe(200);
    expect(cancelOrder).toHaveBeenCalledWith('gelato_123');
    expect(updateOrder).toHaveBeenCalledWith('user-1', 'order_doc_1', {
      status: OrderStatus.CANCELED,
    });
  });

  it('does not mark Firestore cancelled when Gelato cancellation fails', async () => {
    const { POST } = await import('@/app/api/orders/status/route');
    cancelOrder.mockRejectedValueOnce(new Error('Gelato unavailable'));

    const response = await POST(cancelRequest());

    expect(response.status).toBe(500);
    expect(updateOrder).not.toHaveBeenCalled();
  });
});
