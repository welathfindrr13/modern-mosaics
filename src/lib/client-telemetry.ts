type Primitive = string | number | boolean | null;

export type TelemetryProperties = Record<string, Primitive | Primitive[]>;

export async function trackClientEvent(event: string, properties: TelemetryProperties = {}): Promise<void> {
  if (!event) return;

  const payload = {
    event,
    properties,
    pathname: typeof window !== 'undefined' ? window.location.pathname : null,
    timestamp: Date.now(),
  };

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon('/api/telemetry/event', blob);
      return;
    }

    await fetch('/api/telemetry/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      keepalive: true,
      body: JSON.stringify(payload),
    });
  } catch {
    // Telemetry must never impact user-facing flows.
  }
}
