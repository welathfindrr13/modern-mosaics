import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getServerStripe } from '@/lib/stripe';
import {
  fulfillPaidCheckoutSession,
  classifyFulfillmentError,
  setFailedFulfillmentState,
} from '@/lib/checkout-fulfillment';
import { adminDb } from '@/utils/firestore-admin';
import { resolveEventLeaseDecision, EventLeaseState } from '@/lib/webhook-lease';

export const runtime = 'nodejs';

const WEBHOOK_EVENTS_COLLECTION = 'stripeWebhookEvents';
const FULFILLMENT_OPS_QUEUE_COLLECTION = 'fulfillmentOpsQueue';
const PROCESSING_STALE_MS = 5 * 60 * 1000;

async function acquireEventLease(event: Stripe.Event): Promise<EventLeaseState> {
  const ref = adminDb.collection(WEBHOOK_EVENTS_COLLECTION).doc(event.id);
  const nowMs = Date.now();

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      tx.set(ref, {
        eventId: event.id,
        eventType: event.type,
        status: 'processing',
        attempts: 1,
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
      });
      return 'acquired' as const;
    }

    const data = snap.data() as { status?: string; attempts?: number; updatedAtMs?: number } | undefined;
    const decision = resolveEventLeaseDecision(data?.status, data?.updatedAtMs, nowMs, PROCESSING_STALE_MS);
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

async function markEventStatus(eventId: string, updates: Record<string, unknown>): Promise<void> {
  await adminDb
    .collection(WEBHOOK_EVENTS_COLLECTION)
    .doc(eventId)
    .set(
      {
        ...updates,
        updatedAtMs: Date.now(),
      },
      { merge: true }
    );
}

async function enqueueFulfillmentOpsIssue(params: {
  sessionId: string;
  eventId: string;
  errorCode: string;
  errorMessage: string;
  retryable: boolean;
}) {
  const nowMs = Date.now();
  const ref = adminDb.collection(FULFILLMENT_OPS_QUEUE_COLLECTION).doc(params.sessionId);
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const attempts = ((snap.data()?.attempts as number | undefined) ?? 0) + 1;
    tx.set(
      ref,
      {
        sessionId: params.sessionId,
        eventId: params.eventId,
        errorCode: params.errorCode,
        errorMessage: params.errorMessage,
        retryable: params.retryable,
        attempts,
        status: 'open',
        createdAtMs: snap.exists ? snap.data()?.createdAtMs || nowMs : nowMs,
        updatedAtMs: nowMs,
      },
      { merge: true }
    );
  });
}

function getSessionIdFromEvent(event: Stripe.Event): string | null {
  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded' ||
    event.type === 'checkout.session.expired'
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    return session.id || null;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Missing STRIPE_WEBHOOK_SECRET' }, { status: 500 });
  }

  const rawBody = await request.text();
  const stripe = getServerStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error('[STRIPE_WEBHOOK] Signature verification failed:', err?.message || err);
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  const lease = await acquireEventLease(event);
  if (lease === 'processed') {
    return NextResponse.json({ received: true, duplicate: true });
  }
  if (lease === 'processing') {
    return NextResponse.json({ received: true, processing: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session;
        const sessionId = session.id;
        if (!sessionId) {
          throw new Error('Stripe checkout session ID missing in webhook payload');
        }

        const result = await fulfillPaidCheckoutSession(sessionId, {
          fallbackUserUid: session.client_reference_id || session.metadata?.userUid || null,
          stripeEventId: event.id,
        });

        await markEventStatus(event.id, {
          status: 'processed',
          outcome: result.status,
          stripeSessionId: sessionId,
          processedAtMs: Date.now(),
        });
        return NextResponse.json({ received: true, outcome: result.status });
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.id) {
          await setFailedFulfillmentState({
            sessionId: session.id,
            state: 'failed_non_retryable',
            eventId: event.id,
            paymentStatus: session.payment_status || 'unpaid',
            errorCode: 'SESSION_EXPIRED',
            errorMessage: 'Checkout session expired before payment completed.',
          });
        }

        await markEventStatus(event.id, {
          status: 'processed',
          outcome: 'expired',
          stripeSessionId: session.id,
          processedAtMs: Date.now(),
        });
        return NextResponse.json({ received: true, outcome: 'expired' });
      }

      default: {
        await markEventStatus(event.id, {
          status: 'processed',
          outcome: 'ignored',
          processedAtMs: Date.now(),
        });
        return NextResponse.json({ received: true, ignored: true });
      }
    }
  } catch (error: any) {
    const errorInfo = classifyFulfillmentError(error);
    const sessionId = getSessionIdFromEvent(event);
    const paymentStatus =
      event.type.startsWith('checkout.session.')
        ? ((event.data.object as Stripe.Checkout.Session).payment_status || null)
        : null;

    if (sessionId) {
      await setFailedFulfillmentState({
        sessionId,
        state: errorInfo.retryable ? 'failed_retryable' : 'failed_non_retryable',
        eventId: event.id,
        paymentStatus,
        errorCode: errorInfo.code,
        errorMessage: errorInfo.message,
      });
    }

    await markEventStatus(event.id, {
      status: errorInfo.retryable ? 'failed_retryable' : 'processed',
      outcome: errorInfo.retryable ? 'retryable_failure' : 'non_retryable_failure',
      stripeSessionId: sessionId,
      errorCode: errorInfo.code,
      errorMessage: errorInfo.message,
      failedAtMs: Date.now(),
    });

    if (!errorInfo.retryable && sessionId) {
      await enqueueFulfillmentOpsIssue({
        sessionId,
        eventId: event.id,
        errorCode: errorInfo.code,
        errorMessage: errorInfo.message,
        retryable: false,
      });
    }

    console.error('[STRIPE_WEBHOOK] Handler failed:', errorInfo.code, errorInfo.message);
    if (errorInfo.retryable) {
      return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
    return NextResponse.json({ received: true, queued: Boolean(sessionId), nonRetryable: true });
  }
}
