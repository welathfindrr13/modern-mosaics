import type { SizeKey } from '@/data/printLabCatalog';
import { getDimensionsFromSizeKey } from '@/utils/printSizes';

// Gelato guidance used for quality tiers:
// - 150 DPI minimum for acceptable print quality
// - 300 DPI ideal for high-quality results
export const GELATO_MIN_DPI = 150;
export const GELATO_IDEAL_DPI = 300;
const LOW_QUALITY_DPI = 100;

export type PrintQualityStatus = 'excellent' | 'good' | 'warning' | 'poor' | 'unknown';

export interface PrintQualityResult {
  status: PrintQualityStatus;
  effectiveDpi: number | null;
  message: string;
}

export function getRecommendedSizeKey(
  sourceWidth: number | undefined,
  sourceHeight: number | undefined,
  sizeKeys: SizeKey[]
): SizeKey | null {
  if (!sourceWidth || !sourceHeight || sizeKeys.length === 0) {
    return null;
  }

  const preferenceOrder: PrintQualityStatus[] = ['excellent', 'good', 'warning'];

  for (const preferredStatus of preferenceOrder) {
    for (const sizeKey of sizeKeys) {
      const quality = evaluatePrintQualityForSize(sourceWidth, sourceHeight, sizeKey);
      if (quality.status === preferredStatus) {
        return sizeKey;
      }
    }
  }

  return null;
}

export function getEffectiveDpiForSize(
  sourceWidth: number,
  sourceHeight: number,
  sizeKey: SizeKey
): number {
  const targetDims = getDimensionsFromSizeKey(sizeKey);
  const scaleX = sourceWidth / targetDims.w;
  const scaleY = sourceHeight / targetDims.h;
  const scale = Math.min(scaleX, scaleY);
  return Math.round(scale * GELATO_IDEAL_DPI);
}

export function evaluatePrintQualityForSize(
  sourceWidth: number | undefined,
  sourceHeight: number | undefined,
  sizeKey: SizeKey
): PrintQualityResult {
  if (!sourceWidth || !sourceHeight) {
    return { status: 'unknown', effectiveDpi: null, message: 'Checking image quality...' };
  }

  try {
    const effectiveDpi = getEffectiveDpiForSize(sourceWidth, sourceHeight, sizeKey);

    if (effectiveDpi >= GELATO_IDEAL_DPI) {
      return { status: 'excellent', effectiveDpi, message: 'Excellent quality for this size' };
    }

    if (effectiveDpi >= GELATO_MIN_DPI) {
      return { status: 'good', effectiveDpi, message: 'Good quality for this size' };
    }

    if (effectiveDpi >= LOW_QUALITY_DPI) {
      return { status: 'warning', effectiveDpi, message: 'May appear soft at this size' };
    }

    return { status: 'poor', effectiveDpi, message: 'Likely blurry at this size' };
  } catch {
    return { status: 'unknown', effectiveDpi: null, message: 'Unable to check quality' };
  }
}
