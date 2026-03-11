import { NextRequest, NextResponse } from 'next/server';
import { getServerStripe } from '@/lib/stripe';
import {
  getOrderByStripeSessionIdDetailed,
  getOrderFromFulfillmentState,
  getSessionFulfillmentState,
} from '@/lib/checkout-fulfillment';
import { matchesConfirmationNonce, isValidConfirmationNonce } from '@/lib/confirmation-nonce';
import {
  checkoutSuccessQuerySchema,
  getValidationMessage,
} from '@/schemas/api';

/**
 * Read-only checkout status endpoint.
 * Fulfillment side effects are handled by Stripe webhooks.
 */
export async function GET(request: NextRequest) {
  try {
    const parsedQuery = checkoutSuccessQuerySchema.safeParse({
      session_id: request.nextUrl.searchParams.get('session_id'),
      confirmationNonce:
        request.nextUrl.searchParams.get('confirmationNonce') ??
        request.nextUrl.searchParams.get('confirmation_nonce'),
    });
    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: getValidationMessage(parsedQuery.error), code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    const { session_id: cleanSessionId, confirmationNonce } = parsedQuery.data;
    if (!isValidConfirmationNonce(confirmationNonce)) {
      return NextResponse.json(
        { error: 'Missing or invalid confirmation nonce', code: 'INVALID_INPUT' },
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
      console.info('[CHECKOUT_SUCCESS_METRIC]', JSON.stringify({
        metric: 'fulfillment_state_hit',
        stripeSessionId: cleanSessionId,
        state: fulfillmentState.status,
      }));
      try {
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
      } catch (lookupError: any) {
        console.warn('[CHECKOUT_SUCCESS] fulfillment-state lookup failed, continuing as pending:', lookupError?.message || lookupError);
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
    const legacyLookup = await getOrderByStripeSessionIdDetailed(cleanSessionId);
    if (legacyLookup.failedPrecondition) {
      console.warn('[CHECKOUT_SUCCESS_METRIC]', JSON.stringify({
        metric: 'legacy_fallback_failed_precondition',
        stripeSessionId: cleanSessionId,
        lookupErrorCode: legacyLookup.lookupErrorCode || 'unknown',
      }));
    }

    if (legacyLookup.order) {
      console.info('[CHECKOUT_SUCCESS_METRIC]', JSON.stringify({
        metric: 'legacy_fallback_hit',
        stripeSessionId: cleanSessionId,
      }));
      return NextResponse.json({
        success: true,
        fulfilled: true,
        idempotent: true,
        order: {
          id: legacyLookup.order.id,
          referenceId: legacyLookup.order.referenceId,
          status: legacyLookup.order.status,
          created: legacyLookup.order.createdAt,
        },
        localOrder: legacyLookup.order,
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
