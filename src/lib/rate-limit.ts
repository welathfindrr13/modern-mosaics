type RateLimitBucket = {
  count: number;
  resetAtMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAtMs: number;
};

const buckets = new Map<string, RateLimitBucket>();

function pruneExpiredBuckets(nowMs: number) {
  buckets.forEach((bucket, key) => {
    if (bucket.resetAtMs <= nowMs) {
      buckets.delete(key);
    }
  });
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const nowMs = Date.now();

  if (buckets.size > 5_000) {
    pruneExpiredBuckets(nowMs);
  }

  const current = buckets.get(key);
  const bucket =
    !current || current.resetAtMs <= nowMs
      ? { count: 0, resetAtMs: nowMs + windowMs }
      : current;

  if (bucket.count >= maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAtMs - nowMs) / 1000));
    return {
      allowed: false,
      limit: maxRequests,
      remaining: 0,
      retryAfterSeconds,
      resetAtMs: bucket.resetAtMs,
    };
  }

  bucket.count += 1;
  buckets.set(key, bucket);

  return {
    allowed: true,
    limit: maxRequests,
    remaining: Math.max(0, maxRequests - bucket.count),
    retryAfterSeconds: 0,
    resetAtMs: bucket.resetAtMs,
  };
}

export function getRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetAtMs / 1000)),
    ...(result.retryAfterSeconds > 0 ? { 'Retry-After': String(result.retryAfterSeconds) } : {}),
  };
}
