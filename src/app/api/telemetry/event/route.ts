import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  parseJsonWithSchema,
  telemetryEventRequestSchema,
} from '@/schemas/api';

const MAX_PROPERTIES = 30;
const MAX_ARRAY_VALUES = 20;
const MAX_STRING_LENGTH = 256;

type Primitive = string | number | boolean | null;

function sanitizePrimitive(value: unknown): Primitive | null {
  if (value === null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return value.slice(0, MAX_STRING_LENGTH);
  return null;
}

function sanitizeProperties(raw: unknown): Record<string, Primitive | Primitive[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const entries = Object.entries(raw as Record<string, unknown>).slice(0, MAX_PROPERTIES);
  const sanitized: Record<string, Primitive | Primitive[]> = {};

  for (const [rawKey, rawValue] of entries) {
    const key = rawKey.replace(/[^a-zA-Z0-9_:-]/g, '').slice(0, 64);
    if (!key) continue;

    if (Array.isArray(rawValue)) {
      const normalizedArray = rawValue
        .slice(0, MAX_ARRAY_VALUES)
        .map((item) => sanitizePrimitive(item))
        .filter((item): item is Primitive => item !== undefined);

      sanitized[key] = normalizedArray;
      continue;
    }

    const normalized = sanitizePrimitive(rawValue);
    if (normalized !== undefined) {
      sanitized[key] = normalized;
    }
  }

  return sanitized;
}

function hashIpAddress(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  const candidate = forwarded?.split(',')[0]?.trim();
  if (!candidate) return null;
  return crypto.createHash('sha256').update(candidate).digest('hex').slice(0, 16);
}

export async function POST(request: NextRequest) {
  const parsedBody = await parseJsonWithSchema(request, telemetryEventRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  const { event, pathname, properties: rawProperties } = parsedBody.data;

  const properties = sanitizeProperties(rawProperties);
  const ipHash = hashIpAddress(request);
  const userAgent = (request.headers.get('user-agent') || 'unknown').slice(0, 160);

  console.info(
    '[CLIENT_TELEMETRY]',
    JSON.stringify({
      event,
      properties,
      pathname: pathname ?? null,
      ipHash,
      userAgent,
      timestamp: new Date().toISOString(),
    })
  );

  return NextResponse.json({ ok: true });
}
