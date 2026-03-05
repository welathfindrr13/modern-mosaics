'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DashboardUI } from '../dashboard-ui';
import { OrderCard } from '@/components/dashboard/OrderCard';
import { Button } from '@/components/ui/button';
import { OrderStatus, LocalOrder } from '@/models/order';
import { useAuth } from '@/components/providers/firebase-auth-provider';

interface OrderData {
  orderId: string;
  gelatoOrderId: string;
  status: OrderStatus;
  createdAt: string;
  productName?: string;
}

function mapLocalOrderToOrderData(
  localOrder: Partial<LocalOrder> & { orderId?: string; gelatoOrderId?: string }
): OrderData | null {
  const orderId = localOrder.id || localOrder.orderId;
  const gelatoOrderId = localOrder.referenceId || localOrder.gelatoOrderId || orderId;

  if (!orderId) return null;

  return {
    orderId,
    gelatoOrderId: gelatoOrderId || '',
    status: localOrder.status || OrderStatus.CREATED,
    createdAt: localOrder.createdAt || new Date().toISOString(),
    productName: localOrder.productName,
  };
}

export default function OrdersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelingByOrderId, setCancelingByOrderId] = useState<Record<string, boolean>>({});
  const isAuthenticated = !!user && !user.isAnonymous;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/signin?reason=orders');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      const storedOrders = localStorage.getItem('modernMosaicsOrders');
      if (storedOrders) {
        const rawOrders = JSON.parse(storedOrders) as Array<Partial<LocalOrder> & { orderId?: string; gelatoOrderId?: string }>;
        const mappedOrders = rawOrders
          .map(mapLocalOrderToOrderData)
          .filter((order): order is OrderData => order !== null);
        setOrders(mappedOrders);
      }
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const handleCancelQueuedOrder = async (orderId: string) => {
    setActionError(null);
    setCancelingByOrderId((prev) => ({ ...prev, [orderId]: true }));

    try {
      const response = await fetch('/api/orders/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || 'Failed to cancel order.');
      }

      setOrders((prev) =>
        prev.map((order) =>
          order.orderId === orderId
            ? { ...order, status: OrderStatus.CANCELED }
            : order
        )
      );
    } catch (error: any) {
      setActionError(error.message || 'Failed to cancel queued order.');
    } finally {
      setCancelingByOrderId((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  return (
    <DashboardUI>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">Your Orders</h1>
            <p className="text-dark-400 mt-1">Track print production and delivery</p>
          </div>
          <Link href="/create">
            <Button className="btn-primary">Create New Print</Button>
          </Link>
        </div>

        {authLoading || (!isAuthenticated && loading) ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
          </div>
        ) : !isAuthenticated ? null :
        loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-dark-800 border border-white/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No orders yet</h3>
            <p className="text-dark-400 mb-6 max-w-sm mx-auto">
              Upload a photo or generate artwork, preview the exact print, then order with confidence.
            </p>
            <div className="flex gap-3 justify-center">
              <Link href="/create">
                <Button className="btn-primary">Start Creating</Button>
              </Link>
              <Link href="/gallery">
                <Button variant="outline" className="border-white/20 text-dark-200 hover:text-white">
                  Browse Gallery
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {actionError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                {actionError}
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="text-dark-400 text-sm">
                {orders.length} order{orders.length !== 1 ? 's' : ''} · Printed on archival paper with tracked delivery
              </p>
            </div>
            {orders.map(order => (
              <OrderCard
                key={`ord-${order.orderId}`}
                orderId={order.orderId}
                gelatoOrderId={order.gelatoOrderId}
                status={order.status}
                createdAt={order.createdAt}
                productName={order.productName}
                onCancel={handleCancelQueuedOrder}
                canceling={cancelingByOrderId[order.orderId] === true}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardUI>
  );
}
