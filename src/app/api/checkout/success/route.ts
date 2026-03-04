import { NextRequest, NextResponse } from 'next/server';
import { getServerStripe } from '@/lib/stripe';
import {
  getOrderByStripeSessionId,
  getOrderFromFulfillmentState,
  getSessionFulfillmentState,
} from '@/lib/checkout-fulfillment';
import { matchesConfirmationNonce, isValidConfirmationNonce } from '@/lib/confirmation-nonce';

/**
 * Read-only checkout status endpoint.
 * Fulfillment side effects are handled by Stripe webhooks.
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id');
    const confirmationNonce =
      request.nextUrl.searchParams.get('confirmation_nonce') ||
      request.nextUrl.searchParams.get('confirmationNonce');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing session ID', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }
    if (!isValidConfirmationNonce(confirmationNonce)) {
      return NextResponse.json(
        { error: 'Missing or invalid confirmation nonce', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    const cleanSessionId = sessionId.split('?')[0].trim();
    if (!cleanSessionId.startsWith('cs_')) {
      return NextResponse.json(
        { error: 'Invalid session ID format', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    const stripe = getServerStripe();
    const session = await stripe.checkout.sessions.retrieve(cleanSessionId);
    const expectedNonce = session.metadata?.confirmationNonce;
    if (!matchesConfirmationNonce(confirmationNonce, expectedNonce)) {
      return NextResponse.json(
        { error: 'Invalid confirmation token', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const fulfillmentState = await getSessionFulfillmentState(cleanSessionId);
    if (fulfillmentState?.status === 'fulfilled') {
      const localOrder = await getOrderFromFulfillmentState(cleanSessionId);
      if (localOrder) {
        return NextResponse.json({
          success: true,
          fulfilled: true,
          idempotent: true,
          order: {
            id: localOrder.id,
            referenceId: localOrder.referenceId,
            status: localOrder.status,
            created: localOrder.createdAt,
          },
          localOrder,
        });
      }
    }

    if (fulfillmentState?.status === 'failed_non_retryable') {
      return NextResponse.json(
        {
          success: false,
          fulfilled: false,
          code: fulfillmentState.lastErrorCode || 'FULFILLMENT_FAILED',
          error: fulfillmentState.lastErrorMessage || 'Order fulfillment failed. Support has been notified.',
        },
        { status: 409 }
      );
    }

    if (
      fulfillmentState?.status === 'processing' ||
      fulfillmentState?.status === 'pending_payment' ||
      fulfillmentState?.status === 'failed_retryable'
    ) {
      return NextResponse.json(
        {
          success: false,
          fulfilled: false,
          pending: true,
          code: 'FULFILLMENT_PENDING',
          paymentStatus: session.payment_status,
          pollAfterMs: 3000,
        },
        { status: 202 }
      );
    }

    // Legacy fallback for historical orders created before fulfillment-state tracking.
    const existingOrder = await getOrderByStripeSessionId(cleanSessionId);
    if (existingOrder) {
      return NextResponse.json({
        success: true,
        fulfilled: true,
        idempotent: true,
        order: {
          id: existingOrder.id,
          referenceId: existingOrder.referenceId,
          status: existingOrder.status,
          created: existingOrder.createdAt,
        },
        localOrder: existingOrder,
      });
    }

    const paymentStatus = session.payment_status;

    if (paymentStatus !== 'paid') {
      return NextResponse.json(
        {
          success: false,
          fulfilled: false,
          pending: true,
          code: 'PAYMENT_PENDING',
          paymentStatus,
          pollAfterMs: 3000,
        },
        { status: 202 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        fulfilled: false,
        pending: true,
        code: 'FULFILLMENT_PENDING',
        paymentStatus,
        pollAfterMs: 3000,
      },
      { status: 202 }
    );
  } catch (error: any) {
    console.error('[CHECKOUT_SUCCESS] Read-only status lookup failed:', error?.message || error);
    if (error?.type === 'StripeInvalidRequestError') {
      return NextResponse.json(
        { error: 'Invalid checkout session.', code: 'INVALID_SESSION' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to process order status. Please try again.', code: 'CHECKOUT_ERROR' },
      { status: 500 }
    );
  }
}
