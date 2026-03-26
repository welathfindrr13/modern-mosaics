import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildRateLimitKey,
  checkRateLimitWithStore,
  createGuestUpgradeRateLimitBody,
  createMemoryRateLimitStore,
  createRedisRateLimitStore,
  getRateLimitAudience,
  resetInMemoryRateLimitStoreForTests,
  resolveRateLimitPolicy,
  type RedisEvalClient,
} from '@/lib/rate-limit';

function createRequestWithIp(ip: string) {
  return {
    headers: new Headers({
      'x-forwarded-for': ip,
    }),
  };
}

function createFakeRedisClient(): RedisEvalClient {
  const buckets = new Map<string, { count: number; resetAtMs: number }>();

  return {
    async eval(_script, options) {
      const key = options.keys[0];
      const windowMs = Number(options.arguments[0]);
      const nowMs = Date.now();
      const current = buckets.get(key);

      if (!current || current.resetAtMs <= nowMs) {
        const next = {
          count: 1,
          resetAtMs: nowMs + windowMs,
        };
        buckets.set(key, next);
        return [next.count, windowMs];
      }

      current.count += 1;
      buckets.set(key, current);
      return [current.count, Math.max(1, current.resetAtMs - nowMs)];
    },
  };
}

describe('rate limit helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-08T08:00:00.000Z'));
    resetInMemoryRateLimitStoreForTests();
  });

  afterEach(() => {
    resetInMemoryRateLimitStoreForTests();
    vi.useRealTimers();
  });

  it('keys signed-in users by stable uid regardless of client IP', () => {
    const requestA = createRequestWithIp('203.0.113.8');
    const requestB = createRequestWithIp('198.51.100.10');

    const firstKey = buildRateLimitKey('images:generate', requestA as never, 'user-uid');
    const secondKey = buildRateLimitKey('images:generate', requestB as never, 'user-uid');

    expect(firstKey).toBe('images:generate:uid:user-uid');
    expect(secondKey).toBe(firstKey);
  });

  it('falls back to IP hashing only when no uid is available', () => {
    const requestA = createRequestWithIp('203.0.113.8');
    const requestB = createRequestWithIp('198.51.100.10');

    const firstKey = buildRateLimitKey('images:generate', requestA as never);
    const secondKey = buildRateLimitKey('images:generate', requestB as never);

    expect(firstKey).toContain('images:generate:ip:');
    expect(secondKey).toContain('images:generate:ip:');
    expect(firstKey).not.toBe(secondKey);
  });

  it('returns the guest upgrade response contract', () => {
    expect(createGuestUpgradeRateLimitBody()).toEqual({
      code: 'GUEST_USAGE_LIMIT',
      upgradeRequired: true,
      retryable: false,
      upgradeUrl: '/signin?reason=upgrade',
      signInReason: 'upgrade',
    });
  });

  it('resolves guest and authenticated policies differently', () => {
    const guestPolicy = resolveRateLimitPolicy('imagesGenerateUpload', { isAnonymous: true });
    const signedInPolicy = resolveRateLimitPolicy('imagesGenerateUpload', {
      email: 'user@example.com',
      isAnonymous: false,
      signInProvider: 'google.com',
    });
    const guestFallbackPolicy = resolveRateLimitPolicy('imagesGenerateUpload', {
      email: null,
      isAnonymous: false,
      signInProvider: null,
    });

    expect(guestPolicy.limit).toBe(3);
    expect(guestPolicy.body?.upgradeRequired).toBe(true);
    expect(guestFallbackPolicy.limit).toBe(3);
    expect(signedInPolicy.limit).toBe(6);
    expect(signedInPolicy.body?.retryable).toBe(true);
  });

  it('classifies missing-email Firebase sessions as guest audience', () => {
    expect(getRateLimitAudience({ isAnonymous: true, email: null })).toBe('guest');
    expect(
      getRateLimitAudience({
        email: null,
        isAnonymous: false,
        signInProvider: null,
      })
    ).toBe('guest');
    expect(
      getRateLimitAudience({
        email: 'user@example.com',
        isAnonymous: false,
        signInProvider: 'google.com',
      })
    ).toBe('authenticated');
  });

  it('computes retry-after values with the memory store', async () => {
    const store = createMemoryRateLimitStore();

    const first = await checkRateLimitWithStore(store, 'images:generate:test', 2, 60_000);
    const second = await checkRateLimitWithStore(store, 'images:generate:test', 2, 60_000);
    const third = await checkRateLimitWithStore(store, 'images:generate:test', 2, 60_000);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.retryAfterSeconds).toBe(60);
  });

  it('increments and resets counters through the redis store abstraction', async () => {
    const store = createRedisRateLimitStore(createFakeRedisClient(), 'test:ratelimit');

    const first = await checkRateLimitWithStore(store, 'images:edit:test-user', 2, 1_000);
    const second = await checkRateLimitWithStore(store, 'images:edit:test-user', 2, 1_000);
    const third = await checkRateLimitWithStore(store, 'images:edit:test-user', 2, 1_000);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);

    vi.advanceTimersByTime(1_001);

    const afterReset = await checkRateLimitWithStore(store, 'images:edit:test-user', 2, 1_000);
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(1);
  });
});
