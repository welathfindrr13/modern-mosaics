import { describe, expect, it } from 'vitest';
import {
  FulfillmentError,
  classifyFulfillmentError,
  resolveSessionLeaseDecision,
} from '@/lib/checkout-fulfillment';
import { resolveEventLeaseDecision } from '@/lib/webhook-lease';

describe('fulfillment hardening utilities', () => {
  describe('classifyFulfillmentError', () => {
    it('preserves explicit non-retryable error classification', () => {
      const error = new FulfillmentError('MISSING_METADATA', 'Missing metadata', false);
      const classified = classifyFulfillmentError(error);

      expect(classified.retryable).toBe(false);
      expect(classified.code).toBe('MISSING_METADATA');
      expect(classified.message).toBe('Missing metadata');
    });

    it('classifies transient upstream failures as retryable', () => {
      const classified = classifyFulfillmentError(new Error('Gelato API error (503): service unavailable'));
      expect(classified.retryable).toBe(true);
      expect(classified.code).toBe('UPSTREAM_TRANSIENT');
    });
  });

  describe('resolveSessionLeaseDecision', () => {
    const now = 10_000;
    const staleMs = 5_000;

    it('returns fulfilled when already fulfilled', () => {
      expect(resolveSessionLeaseDecision('fulfilled', now - 100, now, staleMs)).toBe('fulfilled');
    });

    it('returns processing when currently processing and not stale', () => {
      expect(resolveSessionLeaseDecision('processing', now - 100, now, staleMs)).toBe('processing');
    });

    it('returns acquired when stale or missing state', () => {
      expect(resolveSessionLeaseDecision('processing', now - 10_000, now, staleMs)).toBe('acquired');
      expect(resolveSessionLeaseDecision(undefined, undefined, now, staleMs)).toBe('acquired');
    });
  });

  describe('resolveEventLeaseDecision', () => {
    const now = 20_000;
    const staleMs = 5_000;

    it('returns processed for already processed events', () => {
      expect(resolveEventLeaseDecision('processed', now - 10, now, staleMs)).toBe('processed');
    });

    it('returns processing for fresh processing events', () => {
      expect(resolveEventLeaseDecision('processing', now - 100, now, staleMs)).toBe('processing');
    });

    it('returns acquired for stale processing events', () => {
      expect(resolveEventLeaseDecision('processing', now - 10_000, now, staleMs)).toBe('acquired');
    });
  });
});
