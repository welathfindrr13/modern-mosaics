import type { SizeKey } from '@/data/printLabCatalog';
import {
  evaluatePrintQualityForSize,
  GELATO_IDEAL_DPI,
  GELATO_MIN_DPI,
  type PrintQualityStatus,
} from '@/utils/printQuality';

interface SizeOption {
  key: SizeKey;
  label: string;
}

interface PrintConfidencePanelProps {
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  options: SizeOption[];
  recommendedSizeKey?: SizeKey | null;
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

const STATUS_META: Record<PrintQualityStatus, { label: string; className: string }> = {
  excellent: {
    label: 'Excellent',
    className: 'bg-green-500/15 text-green-300 border-green-500/30',
  },
  good: {
    label: 'Good',
    className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  warning: {
    label: 'Soft',
    className: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  },
  poor: {
    label: 'Low',
    className: 'bg-red-500/15 text-red-300 border-red-500/30',
  },
  unknown: {
    label: 'Checking',
    className: 'bg-dark-700/60 text-dark-300 border-white/10',
  },
};

export function PrintConfidencePanel({
  sourceWidth,
  sourceHeight,
  options,
  recommendedSizeKey = null,
  title = 'Print Confidence',
  subtitle,
  compact = false,
}: PrintConfidencePanelProps) {
  const dimensionsKnown = Boolean(sourceWidth && sourceHeight);
  const recommendedLabel = options.find(option => option.key === recommendedSizeKey)?.label || null;

  return (
    <div className="rounded-xl border border-white/10 bg-dark-800/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-dark-400">
          {dimensionsKnown ? `${sourceWidth} × ${sourceHeight} px` : 'Dimensions unavailable'}
        </p>
      </div>

      {subtitle && <p className="mt-2 text-xs text-dark-400">{subtitle}</p>}

      <p className="mt-2 text-xs text-dark-400">
        {recommendedLabel
          ? `Recommended max size: ${recommendedLabel}`
          : 'This image may look soft at larger sizes.'}
      </p>

      <div className={`mt-3 grid gap-2 ${compact ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {options.map(option => {
          const quality = evaluatePrintQualityForSize(sourceWidth || undefined, sourceHeight || undefined, option.key);
          const statusMeta = STATUS_META[quality.status];

          return (
            <div key={option.key} className="rounded-lg border border-white/10 bg-dark-900/60 px-2 py-2 text-center">
              <p className="text-xs font-medium text-white">{option.label}</p>
              <span className={`mt-1 inline-flex rounded-md border px-2 py-0.5 text-[10px] ${statusMeta.className}`}>
                {statusMeta.label}
              </span>
              {quality.effectiveDpi && (
                <p className="mt-1 text-[10px] text-dark-500">~{quality.effectiveDpi} DPI</p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] text-dark-500">
        Guidance: {GELATO_MIN_DPI} DPI minimum, {GELATO_IDEAL_DPI} DPI ideal.
      </p>
    </div>
  );
}

