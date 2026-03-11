import crypto from 'crypto';
import { createClient } from 'redis';
import { NextRequest, NextResponse } from 'next/server';

type RateLimitBucket = {
  count: number;
  resetAtMs: number;
};

type RateLimitStoreMode = 'auto' | 'memory' | 'redis';

type RateLimitCounterResult = {
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

export type RateLimitPolicy = {
  limit: number;
  windowMs: number;
  message: string;
  body?: Record<string, unknown>;
};

type AudienceRateLimitPolicy = {
  authenticated: RateLimitPolicy;
  guest: RateLimitPolicy;
};

type RateLimitPolicyName =
  | 'checkoutSession'
  | 'imagesEdit'
  | 'imagesGenerate'
  | 'imagesGenerateUpload'
  | 'imagesUpload'
  | 'imagesUpscale'
  | 'imagesVerify'
  | 'ordersCreate'
  | 'ordersQuote';

type RateLimitSubject = {
  email?: string | null;
  isAnonymous?: boolean | null;
  signInProvider?: string | null;
};

export type RedisEvalClient = {
  eval(
    script: string,
    options: { keys: string[]; arguments: string[] }
  ): Promise<unknown>;
};

export type RateLimitStore = {
  consume(key: string, windowMs: number, nowMs: number): Promise<RateLimitCounterResult>;
};

const RATE_LIMIT_KEY_PREFIX =
  process.env.RATE_LIMIT_KEY_PREFIX?.trim() || 'modern-mosaics:ratelimit';

const DEFAULT_RETRYABLE_BODY = { retryable: true };

const buckets = new Map<string, RateLimitBucket>();

const REDIS_FIXED_WINDOW_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { current, ttl }
`;

const RATE_LIMIT_POLICIES: Record<
  RateLimitPolicyName,
  RateLimitPolicy | AudienceRateLimitPolicy
> = {
  checkoutSession: {
    limit: 12,
    windowMs: 60_000,
    message: 'Too many checkout attempts. Please wait and try again.',
    body: { code: 'RATE_LIMITED', ...DEFAULT_RETRYABLE_BODY },
  },
  imagesEdit: {
    authenticated: {
      limit: 8,
      windowMs: 60_000,
      message: 'Too many image edit requests. Please wait and try again.',
      body: DEFAULT_RETRYABLE_BODY,
    },
    guest: {
      limit: 2,
      windowMs: 60 * 60 * 1000,
      message: 'Guest sessions include 2 AI scene edits per hour. Upgrade to continue.',
      body: createGuestUpgradeRateLimitBody(),
    },
  },
  imagesGenerate: {
    authenticated: {
      limit: 10,
      windowMs: 60_000,
      message: 'Too many image generation requests. Please wait and try again.',
      body: DEFAULT_RETRYABLE_BODY,
    },
    guest: {
      limit: 3,
      windowMs: 60 * 60 * 1000,
      message: 'Guest sessions include 3 AI previews per hour. Upgrade to continue creating.',
      body: createGuestUpgradeRateLimitBody(),
    },
  },
  imagesGenerateUpload: {
    authenticated: {
      limit: 6,
      windowMs: 60_000,
      message: 'Too many image generation requests. Please wait and try again.',
      body: DEFAULT_RETRYABLE_BODY,
    },
    guest: {
      limit: 3,
      windowMs: 60 * 60 * 1000,
      message: 'Guest sessions include 3 AI previews per hour. Upgrade to continue creating.',
      body: createGuestUpgradeRateLimitBody(),
    },
  },
  imagesUpload: {
    authenticated: {
      limit: 10,
      windowMs: 60_000,
      message: 'Too many upload requests. Please wait and try again.',
      body: DEFAULT_RETRYABLE_BODY,
    },
    guest: {
      limit: 12,
      windowMs: 60 * 60 * 1000,
      message: 'Guest sessions include a limited number of uploads per hour. Upgrade to continue.',
      body: createGuestUpgradeRateLimitBody(),
    },
  },
  imagesUpscale: {
    authenticated: {
      limit: 5,
      windowMs: 60_000,
      message: 'Too many upscale requests. Please wait and try again.',
      body: DEFAULT_RETRYABLE_BODY,
    },
    guest: {
      limit: 2,
      windowMs: 60 * 60 * 1000,
      message: 'Guest sessions include 2 upscale requests per hour. Upgrade to continue.',
      body: createGuestUpgradeRateLimitBody(),
    },
  },
  imagesVerify: {
    limit: 30,
    windowMs: 60_000,
    message: 'Too many verification requests. Please wait and try again.',
    body: { code: 'RATE_LIMITED', ...DEFAULT_RETRYABLE_BODY },
  },
  ordersCreate: {
    limit: 3,
    windowMs: 60_000,
    message: 'Too many direct order attempts. Please wait and try again.',
    body: { code: 'RATE_LIMITED', ...DEFAULT_RETRYABLE_BODY },
  },
  ordersQuote: {
    limit: 25,
    windowMs: 60_000,
    message: 'Too many quote requests. Please wait and try again.',
    body: { code: 'RATE_LIMITED', ...DEFAULT_RETRYABLE_BODY },
  },
};

let redisClientPromise: Promise<RedisEvalClient> | null = null;

function pruneExpiredBuckets(nowMs: number) {
  buckets.forEach((bucket, key) => {
    if (bucket.resetAtMs <= nowMs) {
      buckets.delete(key);
    }
  });
}

export function createMemoryRateLimitStore(): RateLimitStore {
  return {
    async consume(key: string, windowMs: number, nowMs: number) {
      if (buckets.size > 5_000) {
        pruneExpiredBuckets(nowMs);
      }

      const current = buckets.get(key);
      const bucket =
        !current || current.resetAtMs <= nowMs
          ? { count: 0, resetAtMs: nowMs + windowMs }
          : current;

      bucket.count += 1;
      buckets.set(key, bucket);

      return {
        count: bucket.count,
        resetAtMs: bucket.resetAtMs,
      };
    },
  };
}

export function createRedisRateLimitStore(
  client: RedisEvalClient,
  keyPrefix = RATE_LIMIT_KEY_PREFIX
): RateLimitStore {
  return {
    async consume(key: string, windowMs: number, nowMs: number) {
      const storageKey = `${keyPrefix}:${key}`;
      const reply = (await client.eval(REDIS_FIXED_WINDOW_SCRIPT, {
        keys: [storageKey],
        arguments: [String(windowMs)],
      })) as [number | string, number | string];

      const rawCount = Number(reply?.[0] ?? 0);
      const rawTtlMs = Number(reply?.[1] ?? windowMs);
      const ttlMs = rawTtlMs > 0 ? rawTtlMs : windowMs;

      return {
        count: rawCount,
        resetAtMs: nowMs + ttlMs,
      };
    },
  };
}

function getRateLimitStoreMode(): RateLimitStoreMode {
  const raw = process.env.RATE_LIMIT_STORE?.trim().toLowerCase();
  if (raw === 'memory' || raw === 'redis') {
    return raw;
  }
  return 'auto';
}

function getRedisUrl(): string | null {
  const raw = process.env.REDIS_URL?.trim();
  return raw || null;
}

function canUseInMemoryRateLimitFallback(mode: RateLimitStoreMode) {
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  return mode === 'memory' && process.env.ALLOW_IN_MEMORY_RATE_LIMIT_IN_PRODUCTION === 'true';
}

async function getRedisClient(): Promise<RedisEvalClient> {
  if (redisClientPromise) {
    return redisClientPromise;
  }

  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    throw new Error('REDIS_URL is not configured');
  }

  const client = createClient({ url: redisUrl });
  client.on('error', () => {
    console.error('Redis rate-limit client error');
  });

  redisClientPromise = client.connect().then(() => client).catch((error) => {
    redisClientPromise = null;
    throw error;
  });

  return redisClientPromise;
}

async function getRateLimitStore(): Promise<RateLimitStore> {
  const mode = getRateLimitStoreMode();
  const redisUrl = getRedisUrl();

  if (mode === 'memory') {
    if (!canUseInMemoryRateLimitFallback(mode)) {
      throw new Error('In-memory rate limiting is not allowed in production');
    }
    return createMemoryRateLimitStore();
  }

  if (mode === 'redis' || redisUrl) {
    return createRedisRateLimitStore(await getRedisClient());
  }

  if (canUseInMemoryRateLimitFallback(mode)) {
    return createMemoryRateLimitStore();
  }

  throw new Error('Redis rate limiting must be configured in production');
}

export async function checkRateLimitWithStore(
  store: RateLimitStore,
  key: string,
  maxRequests: number,
  windowMs: number,
  nowMs = Date.now()
): Promise<RateLimitResult> {
  const { count, resetAtMs } = await store.consume(key, windowMs, nowMs);

  if (count > maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAtMs - nowMs) / 1000));
    return {
      allowed: false,
      limit: maxRequests,
      remaining: 0,
      retryAfterSeconds,
      resetAtMs,
    };
  }

  return {
    allowed: true,
    limit: maxRequests,
    remaining: Math.max(0, maxRequests - count),
    retryAfterSeconds: 0,
    resetAtMs,
  };
}

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  return checkRateLimitWithStore(await getRateLimitStore(), key, maxRequests, windowMs);
}

export function resolveRateLimitPolicy(
  name: RateLimitPolicyName,
  subject?: RateLimitSubject | null
): RateLimitPolicy {
  const policy = RATE_LIMIT_POLICIES[name];
  if ('limit' in policy) {
    return policy;
  }

  return getRateLimitAudience(subject) === 'guest' ? policy.guest : policy.authenticated;
}

export function getRateLimitAudience(
  subject?: RateLimitSubject | null
): 'guest' | 'authenticated' {
  if (!subject) {
    return 'guest';
  }

  if (subject.isAnonymous) {
    return 'guest';
  }

  if (subject.signInProvider === 'anonymous') {
    return 'guest';
  }

  if (!subject.email) {
    return 'guest';
  }

  return 'authenticated';
}

export function getClientIpHash(request: Pick<NextRequest, 'headers'>): string {
  const forwardedFor = request.headers.get('x-forwarded-for') ?? '';
  const candidateIp = forwardedFor.split(',')[0]?.trim() || 'unknown';

  return crypto.createHash('sha256').update(candidateIp).digest('hex').slice(0, 16);
}

export function getRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetAtMs / 1000)),
    ...(result.retryAfterSeconds > 0 ? { 'Retry-After': String(result.retryAfterSeconds) } : {}),
  };
}

export function buildRateLimitKey(
  route: string,
  request: Pick<NextRequest, 'headers'>,
  uid?: string | null
): string {
  return `${route}:${uid ?? 'anon'}:${getClientIpHash(request)}`;
}

export function createRateLimitResponse(
  message: string,
  result: RateLimitResult,
  body?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      error: message,
      retryAfterSeconds: result.retryAfterSeconds,
      ...(body ?? {}),
    },
    {
      status: 429,
      headers: getRateLimitHeaders(result),
    }
  );
}

export function createGuestUpgradeRateLimitBody(body: Record<string, unknown> = {}) {
  return {
    code: 'GUEST_USAGE_LIMIT',
    upgradeRequired: true,
    retryable: false,
    upgradeUrl: '/signin?reason=upgrade',
    signInReason: 'upgrade',
    ...body,
  };
}

export function createPayloadTooLargeResponse(maxBytes: number) {
  return NextResponse.json(
    {
      error: 'Payload too large',
      maxBytes,
    },
    { status: 413 }
  );
}

export function enforceContentLengthLimit(
  request: Pick<NextRequest, 'headers'>,
  maxBytes: number
): NextResponse | null {
  const contentLengthHeader = request.headers.get('content-length');
  if (!contentLengthHeader) {
    return null;
  }

  const contentLength = Number.parseInt(contentLengthHeader, 10);
  if (Number.isNaN(contentLength) || contentLength <= maxBytes) {
    return null;
  }

  return createPayloadTooLargeResponse(maxBytes);
}

export function resetInMemoryRateLimitStoreForTests() {
  buckets.clear();
}
