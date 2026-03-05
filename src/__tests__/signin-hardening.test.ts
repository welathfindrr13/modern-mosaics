import { describe, expect, it } from 'vitest';
import {
  getSigninReasonMessage,
  isMethodDisabled,
  withAuthTimeout,
} from '@/lib/auth-flow';
import { isFirestoreFailedPrecondition } from '@/lib/checkout-fulfillment';

describe('signin hardening utilities', () => {
  it('does not lock unrelated auth methods', () => {
    expect(isMethodDisabled('google', 'google')).toBe(true);
    expect(isMethodDisabled('google', 'guest')).toBe(false);
    expect(isMethodDisabled('google', 'email')).toBe(false);
    expect(isMethodDisabled(null, 'google')).toBe(false);
  });

  it('returns a contextual signin reason banner message', () => {
    expect(getSigninReasonMessage('orders')).toContain('order history');
    expect(getSigninReasonMessage('upgrade')).toContain('guest session');
    expect(getSigninReasonMessage('unknown')).toBeNull();
  });

  it('times out non-resolving auth operations', async () => {
    const never = new Promise<string>(() => {});
    await expect(withAuthTimeout(never, 5)).rejects.toMatchObject({
      code: 'auth/popup-timeout',
      timedOut: true,
    });
  });
});

describe('checkout fallback precondition detector', () => {
  it('detects firestore failed precondition errors', () => {
    expect(isFirestoreFailedPrecondition({ code: 9, message: 'FAILED_PRECONDITION: index needed' })).toBe(true);
    expect(isFirestoreFailedPrecondition({ code: 'FAILED_PRECONDITION', message: 'index needed' })).toBe(true);
    expect(isFirestoreFailedPrecondition({ code: 7, message: 'PERMISSION_DENIED' })).toBe(false);
  });
});
