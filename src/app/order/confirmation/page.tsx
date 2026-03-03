'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { PrintConfidencePanel } from '@/components/ui/PrintConfidencePanel';
import { getOrderFromLocalStorage, saveOrderToLocalStorage, OrderStatus } from '@/models/order';
import { formatPrice } from '@/utils/priceUtils';
import { getRecommendedSizeKey } from '@/utils/printQuality';
import type { SizeKey } from '@/data/printLabCatalog';

const STATUS_COLORS = {
  CREATED: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  QUEUED: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
  PROCESSING: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  SHIPPED: 'bg-green-500/10 text-green-300 border-green-500/30',
  DELIVERED: 'bg-green-500/10 text-green-300 border-green-500/30',
  CANCELED: 'bg-red-500/10 text-red-300 border-red-500/30',
  FAILED: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
};

const STATUS_LABELS = {
  CREATED: 'Order received',
  QUEUED: 'In queue',
  PROCESSING: 'In production',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELED: 'Cancelled',
  FAILED: 'Issue with order',
};

const CONFIDENCE_OPTIONS: Array<{ key: SizeKey; label: string }> = [
  { key: '8x10', label: '8x10"' },
  { key: '12x16', label: '12x16"' },
  { key: '16x20', label: '16x20"' },
  { key: '18x24', label: '18x24"' },
];

const CONFIDENCE_ORDER: SizeKey[] = ['18x24', '16x20', '12x16', '8x10'];
const MAX_FULFILLMENT_POLL_ATTEMPTS = 20;

export default function OrderConfirmationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams?.get('orderId') || null;
  const pollTimeoutRef = useRef<number | null>(null);
  const unmountedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isFulfillmentPending, setIsFulfillmentPending] = useState(false);

  const recommendedSizeKey = useMemo(() => {
    return getRecommendedSizeKey(imageDimensions?.width, imageDimensions?.height, CONFIDENCE_ORDER);
  }, [imageDimensions?.width, imageDimensions?.height]);

  const clearPollTimer = useCallback(() => {
    if (pollTimeoutRef.current) {
      window.clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      clearPollTimer();
    };
  }, [clearPollTimer]);

  const verifyStripePayment = useCallback(async (sessionId: string, confirmationNonce: string, attempt = 0) => {
    let keepLoading = false;
    try {
      if (attempt === 0) {
        setLoading(true);
      }
      setError(null);

      const cleanSessionId = sessionId.split('?')[0];
      const url = new URL('/api/checkout/success', window.location.origin);
      url.searchParams.set('session_id', cleanSessionId);
      url.searchParams.set('confirmation_nonce', confirmationNonce);

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Payment verification failed: ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.localOrder) {
        clearPollTimer();
        setIsFulfillmentPending(false);
        saveOrderToLocalStorage(data.localOrder);
        setOrderDetails(data.localOrder);
        router.replace(`/order/confirmation?orderId=${data.localOrder.id}`, { scroll: false });
        setLoading(false);
        return;
      }

      if (data.pending) {
        keepLoading = true;
        setIsFulfillmentPending(true);
        if (attempt >= MAX_FULFILLMENT_POLL_ATTEMPTS - 1) {
          throw new Error('Payment received, but fulfillment is still processing. Please refresh in a moment.');
        }

        const serverDelay = Number.isFinite(data.pollAfterMs) ? Number(data.pollAfterMs) : 3000;
        const delay = Math.min(12000, serverDelay + attempt * 500);
        clearPollTimer();
        pollTimeoutRef.current = window.setTimeout(() => {
          if (!unmountedRef.current) {
            void verifyStripePayment(cleanSessionId, confirmationNonce, attempt + 1);
          }
        }, delay);
        return;
      }

      throw new Error('Invalid payment verification response');
    } catch (verificationError: any) {
      clearPollTimer();
      setIsFulfillmentPending(false);
      setError(`Payment verification failed: ${verificationError.message}`);
      setLoading(false);
    } finally {
      if (attempt === 0 && !keepLoading) {
        setLoading(false);
      }
    }
  }, [clearPollTimer, router]);

  const fetchOrderDetails = useCallback(async () => {
    if (!orderId) return;

    try {
      setRefreshing(true);
      setError(null);

      const response = await fetch(`/api/orders/status?orderId=${orderId}`);
      if (!response.ok) {
        throw new Error(`Error ${response.status}: Failed to fetch order details`);
      }

      const data = await response.json();
      if (data.success && data.order) {
        const localOrder = getOrderFromLocalStorage(orderId);
        if (localOrder) {
          setOrderDetails({
            ...localOrder,
            status: data.order.status,
            trackingUrl: data.order.trackingUrl,
            trackingNumber: data.order.trackingNumber,
            carrier: data.order.carrier,
            updatedAt: data.order.updated,
          });
        } else {
          setOrderDetails(data.order);
        }
      } else {
        throw new Error('Invalid order data received');
      }
    } catch (fetchError: any) {
      setError(`Failed to load order: ${fetchError.message}`);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    const sessionId = searchParams?.get('session_id');
    const confirmationNonce =
      searchParams?.get('confirmation_nonce') || searchParams?.get('confirmationNonce');

    if (!orderId && !sessionId) {
      router.push('/dashboard');
      return;
    }

    if (sessionId) {
      if (!confirmationNonce) {
        setError('Missing confirmation token. Please return to your checkout receipt link.');
        setLoading(false);
        return;
      }
      void verifyStripePayment(sessionId, confirmationNonce);
      return;
    }

    if (orderId) {
      const localOrder = getOrderFromLocalStorage(orderId);
      if (localOrder) {
        setOrderDetails(localOrder);
        setLoading(false);
      } else {
        fetchOrderDetails();
      }
    }
  }, [fetchOrderDetails, orderId, router, searchParams, verifyStripePayment]);

  useEffect(() => {
    async function loadDimensions() {
      if (!orderDetails?.imageId) return;
      try {
        const response = await fetch('/api/images/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ imageIdentifier: orderDetails.imageId }),
        });
        if (!response.ok) return;
        const data = await response.json();
        if (data?.exists && data?.imageDetails?.width && data?.imageDetails?.height) {
          setImageDimensions({
            width: data.imageDetails.width,
            height: data.imageDetails.height,
          });
        }
      } catch {
        // Non-blocking for confirmation page.
      }
    }
    loadDimensions();
  }, [orderDetails?.imageId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 pt-24 pb-12">
        <div className="fixed inset-0 bg-glow-gradient opacity-20 pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 text-center py-24">
          <Spinner size="large" />
          <p className="mt-4 text-dark-300">
            {isFulfillmentPending
              ? 'Payment received. Finalizing fulfillment...'
              : 'Loading order details...'}
          </p>
        </div>
      </div>
    );
  }

  if (error || !orderDetails) {
    return (
      <div className="min-h-screen bg-dark-900 pt-24 pb-12">
        <div className="fixed inset-0 bg-glow-gradient opacity-20 pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 py-16">
          <div className="glass-card p-8 text-center border-red-500/30">
            <h2 className="text-xl font-semibold text-white mb-2">Order Error</h2>
            <p className="text-red-300 mb-6">{error || 'Order not found'}</p>
            <Button onClick={() => router.push('/dashboard')} className="btn-primary">
              Return to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const statusColor = STATUS_COLORS[orderDetails.status as OrderStatus] || 'bg-dark-800 text-dark-300 border-white/10';
  const statusLabel = STATUS_LABELS[orderDetails.status as OrderStatus] || orderDetails.status;

  return (
    <div className="min-h-screen bg-dark-900 pt-24 pb-12">
      <div className="fixed inset-0 bg-glow-gradient opacity-20 pointer-events-none" />
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-card p-6 sm:p-8 mb-6 border-green-500/25">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white mb-2">Order Confirmed</h1>
          <p className="text-dark-300">Payment completed and your print order has been submitted for fulfillment.</p>
        </div>

        <div className="glass-card overflow-hidden mb-6">
          <div className="border-b border-white/10 p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Order #{orderDetails.referenceId}</h2>
              <p className="text-dark-400 text-sm">
                Placed on {new Date(orderDetails.createdAt).toLocaleDateString('en-GB')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColor}`}>{statusLabel}</span>
              <button
                onClick={fetchOrderDetails}
                disabled={refreshing}
                className="px-3 py-2 rounded-lg text-xs border border-white/10 text-dark-300 hover:text-white hover:border-white/20 transition-colors disabled:opacity-60"
              >
                {refreshing ? 'Refreshing...' : 'Refresh Status'}
              </button>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {orderDetails.previewUrl && (
              <div className="lg:col-span-1">
                <div className="aspect-[3/4] relative rounded-xl overflow-hidden border border-white/10">
                  <Image
                    src={orderDetails.previewUrl}
                    alt="Order image"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 33vw"
                  />
                </div>
              </div>
            )}

            <div className="lg:col-span-2 space-y-6">
              <div>
                <h3 className="text-sm font-medium text-dark-400 mb-1">Product</h3>
                <p className="text-white">{orderDetails.productName || 'Custom Print'}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-dark-400 mb-2">Shipping Address</h3>
                  {orderDetails.shippingAddress && (
                    <div className="text-dark-200 text-sm">
                      <p>{orderDetails.shippingAddress.firstName} {orderDetails.shippingAddress.lastName}</p>
                      <p>{orderDetails.shippingAddress.line1}</p>
                      {orderDetails.shippingAddress.line2 && <p>{orderDetails.shippingAddress.line2}</p>}
                      <p>
                        {orderDetails.shippingAddress.city}
                        {orderDetails.shippingAddress.state ? `, ${orderDetails.shippingAddress.state}` : ''} {orderDetails.shippingAddress.postalCode}
                      </p>
                      <p>{orderDetails.shippingAddress.country}</p>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-medium text-dark-400 mb-2">Order Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-dark-300">
                      <span>Product</span>
                      <span className="text-white">{formatPrice(orderDetails.price, orderDetails.currency)}</span>
                    </div>
                    <div className="flex justify-between text-dark-300">
                      <span>Shipping</span>
                      <span className="text-white">{formatPrice(orderDetails.shippingCost, orderDetails.currency)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-white/10 font-semibold">
                      <span className="text-white">Total</span>
                      <span className="text-gradient-gold">{formatPrice(orderDetails.total, orderDetails.currency)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <PrintConfidencePanel
                title="Print confidence snapshot"
                subtitle="The same quality engine used in create and order flow."
                sourceWidth={imageDimensions?.width}
                sourceHeight={imageDimensions?.height}
                options={CONFIDENCE_OPTIONS}
                recommendedSizeKey={recommendedSizeKey}
                compact
              />

              {orderDetails.status === 'SHIPPED' && orderDetails.trackingUrl && (
                <div className="rounded-lg border border-white/10 bg-dark-800/50 p-4">
                  <h3 className="text-sm font-semibold text-white mb-2">Tracking</h3>
                  {orderDetails.trackingNumber && (
                    <p className="text-sm text-dark-300">Tracking number: <span className="text-white">{orderDetails.trackingNumber}</span></p>
                  )}
                  {orderDetails.carrier && (
                    <p className="text-sm text-dark-300">Carrier: <span className="text-white">{orderDetails.carrier}</span></p>
                  )}
                  <a
                    href={orderDetails.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex mt-3 px-3 py-2 rounded-lg bg-brand-500/20 text-brand-300 border border-brand-500/40 hover:bg-brand-500/30 transition-colors text-sm"
                  >
                    Track Shipment
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => router.push('/dashboard')} className="btn-primary px-6">
            View Dashboard
          </Button>
          <Link href="/create" passHref>
            <Button variant="outline" className="px-6 border-white/20 text-dark-200 hover:text-white">
              Create Another
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
