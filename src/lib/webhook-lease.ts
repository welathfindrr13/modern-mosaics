export type EventLeaseState = 'acquired' | 'processed' | 'processing';

export function resolveEventLeaseDecision(
  status: string | undefined,
  updatedAtMs: number | undefined,
  nowMs: number,
  staleMs: number
): EventLeaseState {
  const stale = !updatedAtMs || nowMs - updatedAtMs > staleMs;
  if (status === 'processed') {
    return 'processed';
  }
  if (status === 'processing' && !stale) {
    return 'processing';
  }
  return 'acquired';
}
