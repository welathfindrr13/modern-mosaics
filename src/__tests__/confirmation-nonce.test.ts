import { describe, expect, it } from 'vitest';
import {
  generateConfirmationNonce,
  isValidConfirmationNonce,
  matchesConfirmationNonce,
} from '@/lib/confirmation-nonce';

describe('confirmation nonce', () => {
  it('generates valid 128-bit hex nonces', () => {
    const nonce = generateConfirmationNonce();
    expect(nonce).toHaveLength(32);
    expect(isValidConfirmationNonce(nonce)).toBe(true);
  });

  it('generates nonces with low collision likelihood', () => {
    const nonceA = generateConfirmationNonce();
    const nonceB = generateConfirmationNonce();
    expect(nonceA).not.toBe(nonceB);
  });

  it('matches valid nonces using constant-time comparison', () => {
    const nonce = generateConfirmationNonce();
    expect(matchesConfirmationNonce(nonce, nonce)).toBe(true);
  });

  it('rejects missing, malformed, or mismatched nonces', () => {
    const expected = generateConfirmationNonce();
    expect(matchesConfirmationNonce(undefined, expected)).toBe(false);
    expect(matchesConfirmationNonce('abc', expected)).toBe(false);
    expect(matchesConfirmationNonce(generateConfirmationNonce(), expected)).toBe(false);
  });
});
