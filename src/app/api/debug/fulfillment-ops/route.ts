import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireDebugAdmin } from '@/lib/api-auth';
import { adminDb } from '@/utils/firestore-admin';

const SESSION_FULFILLMENT_COLLECTION = 'stripeSessionFulfillmentState';
const FULFILLMENT_OPS_QUEUE_COLLECTION = 'fulfillmentOpsQueue';
const STALE_PROCESSING_MS = 10 * 60 * 1000;
const MAX_RETURNED_ITEMS = 200;

type OpsQueueState = 'failed_retryable' | 'failed_non_retryable';

function parseUpdatedAtMs(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function redactIdentifier(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
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
      recordRef: redactIdentifier(doc.id),
      state,
      stripeSessionRef: redactIdentifier(data.stripeSessionId),
      eventRef: redactIdentifier(data.eventId),
      reasonCode: typeof data.reasonCode === 'string' ? data.reasonCode : null,
      hasReasonMessage: typeof data.reasonMessage === 'string' && data.reasonMessage.length > 0,
      retryable: data.retryable === true,
      createdAtMs: parseUpdatedAtMs(data.createdAtMs),
      updatedAtMs: parseUpdatedAtMs(data.updatedAtMs),
    };
  });
}

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    const accessResponse = await requireDebugAdmin(request, '/api/debug/fulfillment-ops');
    if (accessResponse) {
      return accessResponse;
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
        recordRef: redactIdentifier(doc.id),
        status: typeof data.status === 'string' ? data.status : null,
        attempts: typeof data.attempts === 'number' ? data.attempts : null,
        userRef: redactIdentifier(data.userUid),
        eventRef: redactIdentifier(data.stripeEventId),
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
