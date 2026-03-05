import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getUserEmail } from '@/lib/api-auth';
import { adminDb } from '@/utils/firestore-admin';

const SESSION_FULFILLMENT_COLLECTION = 'stripeSessionFulfillmentState';
const FULFILLMENT_OPS_QUEUE_COLLECTION = 'fulfillmentOpsQueue';
const STALE_PROCESSING_MS = 10 * 60 * 1000;
const MAX_RETURNED_ITEMS = 200;

type OpsQueueState = 'failed_retryable' | 'failed_non_retryable';

function isDebugAdmin(email: string | null): boolean {
  if (!email) return false;
  const allowlist = (process.env.DEBUG_ADMIN_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}

function parseUpdatedAtMs(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

async function getOpsQueueItems(state: OpsQueueState) {
  const snap = await adminDb
    .collection(FULFILLMENT_OPS_QUEUE_COLLECTION)
    .where('state', '==', state)
    .limit(MAX_RETURNED_ITEMS)
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown>;
    return {
      id: doc.id,
      state,
      stripeSessionId: typeof data.stripeSessionId === 'string' ? data.stripeSessionId : null,
      eventId: typeof data.eventId === 'string' ? data.eventId : null,
      reasonCode: typeof data.reasonCode === 'string' ? data.reasonCode : null,
      reasonMessage: typeof data.reasonMessage === 'string' ? data.reasonMessage : null,
      retryable: data.retryable === true,
      createdAtMs: parseUpdatedAtMs(data.createdAtMs),
      updatedAtMs: parseUpdatedAtMs(data.updatedAtMs),
    };
  });
}

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    const authResponse = await requireAuth(request);
    if (authResponse) {
      console.warn('[DEBUG_ACCESS_DENIED]', JSON.stringify({
        path: '/api/debug/fulfillment-ops',
        reason: 'unauthenticated',
        env: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
      }));
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const email = await getUserEmail(request);
    if (!isDebugAdmin(email)) {
      console.warn('[DEBUG_ACCESS_DENIED]', JSON.stringify({
        path: '/api/debug/fulfillment-ops',
        reason: 'not_allowlisted',
        hasEmail: Boolean(email),
        env: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
      }));
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  try {
    const nowMs = Date.now();
    const staleBeforeMs = nowMs - STALE_PROCESSING_MS;

    const processingSnapshot = await adminDb
      .collection(SESSION_FULFILLMENT_COLLECTION)
      .where('status', '==', 'processing')
      .limit(MAX_RETURNED_ITEMS)
      .get();

    const processingItems = processingSnapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const updatedAtMs = parseUpdatedAtMs(data.updatedAtMs);
      return {
        id: doc.id,
        status: typeof data.status === 'string' ? data.status : null,
        attempts: typeof data.attempts === 'number' ? data.attempts : null,
        userUid: typeof data.userUid === 'string' ? data.userUid : null,
        stripeEventId: typeof data.stripeEventId === 'string' ? data.stripeEventId : null,
        updatedAtMs,
        stale: updatedAtMs > 0 ? updatedAtMs < staleBeforeMs : true,
      };
    });

    const staleProcessingItems = processingItems.filter((item) => item.stale);

    const [retryableQueueItems, nonRetryableQueueItems] = await Promise.all([
      getOpsQueueItems('failed_retryable'),
      getOpsQueueItems('failed_non_retryable'),
    ]);

    return NextResponse.json({
      success: true,
      generatedAt: new Date(nowMs).toISOString(),
      staleThresholdMs: STALE_PROCESSING_MS,
      summary: {
        processingCount: processingItems.length,
        staleProcessingCount: staleProcessingItems.length,
        retryableQueueCount: retryableQueueItems.length,
        nonRetryableQueueCount: nonRetryableQueueItems.length,
      },
      staleProcessingItems,
      retryableQueueItems,
      nonRetryableQueueItems,
    });
  } catch (error: any) {
    console.error('[DEBUG_FULFILLMENT_OPS] Failed to load ops snapshot:', error?.message || error);
    return NextResponse.json(
      { error: 'Failed to load fulfillment ops snapshot.' },
      { status: 500 }
    );
  }
}
