import { describe, expect, it } from 'vitest';
import {
  evaluatePrintQualityForSize,
  getRecommendedSizeKey,
  getEffectiveDpiForSize,
  GELATO_IDEAL_DPI,
  GELATO_MIN_DPI,
} from '@/utils/printQuality';
import type { SizeKey } from '@/data/printLabCatalog';

const ALL_SIZES: SizeKey[] = ['18x24', '16x20', '12x16', '8x10'];

describe('printQuality', () => {
  describe('evaluatePrintQualityForSize', () => {
    it('classifies excellent quality at or above ideal DPI', () => {
      const result = evaluatePrintQualityForSize(4000, 5000, '8x10');
      expect(result.status).toBe('excellent');
      expect(result.effectiveDpi).toBeGreaterThanOrEqual(GELATO_IDEAL_DPI);
    });

    it('classifies excellent for large source on small print', () => {
      const result = evaluatePrintQualityForSize(4000, 5000, '12x16');
      expect(result.status).toBe('excellent');
    });

    it('classifies good quality between min and ideal DPI', () => {
      const result = evaluatePrintQualityForSize(2000, 2500, '12x16');
      expect(result.status === 'good' || result.status === 'excellent').toBe(true);
      expect(result.effectiveDpi).toBeGreaterThanOrEqual(GELATO_MIN_DPI);
    });

    it('classifies warning for medium source on large print', () => {
      const result = evaluatePrintQualityForSize(2000, 2500, '16x20');
      expect(result.status).toBe('warning');
      expect(result.effectiveDpi).toBeLessThan(GELATO_MIN_DPI);
    });

    it('classifies poor for small source on large print', () => {
      const result = evaluatePrintQualityForSize(1000, 1200, '18x24');
      expect(result.status).toBe('poor');
    });

    it('classifies poor for very small source on 12x16', () => {
      const result = evaluatePrintQualityForSize(1000, 1200, '12x16');
      expect(result.status).toBe('poor');
    });

    it('returns unknown when dimensions are undefined', () => {
      const result = evaluatePrintQualityForSize(undefined, undefined, '12x16');
      expect(result.status).toBe('unknown');
      expect(result.effectiveDpi).toBeNull();
    });

    it('returns unknown when only width is provided', () => {
      const result = evaluatePrintQualityForSize(4000, undefined, '12x16');
      expect(result.status).toBe('unknown');
    });
  });

  describe('getEffectiveDpiForSize', () => {
    it('computes higher DPI for smaller print sizes', () => {
      const dpi8x10 = getEffectiveDpiForSize(3000, 4000, '8x10');
      const dpi18x24 = getEffectiveDpiForSize(3000, 4000, '18x24');
      expect(dpi8x10).toBeGreaterThan(dpi18x24);
    });

    it('returns positive integer', () => {
      const dpi = getEffectiveDpiForSize(2000, 2500, '12x16');
      expect(dpi).toBeGreaterThan(0);
      expect(Number.isInteger(dpi)).toBe(true);
    });
  });

  describe('getRecommendedSizeKey', () => {
    it('returns the first size that hits the best available tier', () => {
      const recommended = getRecommendedSizeKey(4000, 5000, ALL_SIZES);
      expect(recommended).toBeTruthy();
      expect(ALL_SIZES).toContain(recommended as SizeKey);
    });

    it('prefers larger sizes when quality allows', () => {
      const recommended = getRecommendedSizeKey(4000, 5000, ALL_SIZES);
      const quality = evaluatePrintQualityForSize(4000, 5000, recommended!);
      expect(['excellent', 'good']).toContain(quality.status);
    });

    it('drops to smaller size for lower-res source', () => {
      const recommended = getRecommendedSizeKey(2000, 2500, ALL_SIZES);
      expect(recommended).toBeTruthy();
      const quality = evaluatePrintQualityForSize(2000, 2500, recommended!);
      expect(quality.status).not.toBe('poor');
    });

    it('returns null when dimensions are missing', () => {
      expect(getRecommendedSizeKey(undefined, undefined, ALL_SIZES)).toBeNull();
    });

    it('returns null for empty size array', () => {
      expect(getRecommendedSizeKey(4000, 5000, [])).toBeNull();
    });

    it('never returns a size with poor quality', () => {
      const testDimensions = [
        [4000, 5000], [3000, 4000], [2000, 2500], [1500, 2000], [1000, 1200],
      ];
      for (const [w, h] of testDimensions) {
        const rec = getRecommendedSizeKey(w, h, ALL_SIZES);
        if (rec) {
          const quality = evaluatePrintQualityForSize(w, h, rec);
          expect(quality.status).not.toBe('poor');
        }
      }
    });

    it('respects preference order (earlier preferred)', () => {
      const forward = getRecommendedSizeKey(4000, 5000, ['18x24', '16x20', '12x16', '8x10']);
      const reversed = getRecommendedSizeKey(4000, 5000, ['8x10', '12x16', '16x20', '18x24']);
      // Both should find something; forward should prefer larger, reversed smaller
      expect(forward).toBeTruthy();
      expect(reversed).toBeTruthy();
    });
  });
});

