import { randomBytes, timingSafeEqual } from 'crypto';

const NONCE_BYTES = 16; // 128-bit
const NONCE_HEX_LENGTH = NONCE_BYTES * 2;

export function generateConfirmationNonce(): string {
  return randomBytes(NONCE_BYTES).toString('hex');
}

export function isValidConfirmationNonce(nonce: string | null | undefined): nonce is string {
  return typeof nonce === 'string' && /^[a-f0-9]{32}$/i.test(nonce);
}

export function matchesConfirmationNonce(
  providedNonce: string | null | undefined,
  expectedNonce: string | null | undefined
): boolean {
  if (!isValidConfirmationNonce(providedNonce) || !isValidConfirmationNonce(expectedNonce)) {
    return false;
  }

  // Normalize to lowercase to avoid false negatives on valid hex casing differences.
  const provided = Buffer.from(providedNonce.toLowerCase().slice(0, NONCE_HEX_LENGTH), 'utf8');
  const expected = Buffer.from(expectedNonce.toLowerCase().slice(0, NONCE_HEX_LENGTH), 'utf8');

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}
