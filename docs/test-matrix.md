# Test Matrix

## Unit Tests

| Test file | Covers | Status |
|---|---|---|
| `src/__tests__/print-quality.test.ts` | Quality tiers, DPI calc, recommendation ordering | ✅ |

## Print Quality (`src/utils/printQuality.ts`)

| Source dimensions | Size | Expected tier | Expected DPI (approx) |
|---|---|---|---|
| 4000 × 5000 | 8×10 | excellent | ~406 |
| 4000 × 5000 | 12×16 | excellent | ~306 |
| 4000 × 5000 | 16×20 | good | ~245 |
| 4000 × 5000 | 18×24 | good | ~205 |
| 2000 × 2500 | 8×10 | good | ~203 |
| 2000 × 2500 | 12×16 | good | ~153 |
| 2000 × 2500 | 16×20 | warning | ~122 |
| 2000 × 2500 | 18×24 | warning | ~102 |
| 1000 × 1200 | 12×16 | poor | ~76 |
| 1000 × 1200 | 18×24 | poor | ~49 |
| undefined | any | unknown | null |

## Recommendation Ordering

`getRecommendedSizeKey` should return the **first** size key in the preference
array that achieves the highest quality tier (excellent > good > warning). It
should never return a size with `poor` quality.

| Source | Preference order | Expected result |
|---|---|---|
| 4000 × 5000 | `['18x24','16x20','12x16','8x10']` | `18x24` (good) |
| 2000 × 2500 | `['18x24','16x20','12x16','8x10']` | `8x10` (excellent) or first good |
| 1000 × 1200 | `['18x24','16x20','12x16','8x10']` | `8x10` (warning) |
| undefined | any | `null` |

## E2E Smoke Tests (manual)

| Flow | Steps | Expected |
|---|---|---|
| Happy path photo | Upload photo → preview → order 12×16 → GB address → checkout → confirm | Order created, confirmation page shows |
| Happy path creative | Enter prompt → generate → order → checkout | Order created |
| Poor quality block | Upload 800×600 → try 18×24 | Size blocked, cannot proceed |
| Rate limit | Hit checkout session 13× in 60s | 429 on 13th request |
| Debug gate (prod) | GET `/api/debug` without admin email | 404 |
| Currency conversion | US address on order page | Prices shown in USD |

## API Contract Tests

| Endpoint | Method | Auth | Rate limit | Error codes |
|---|---|---|---|---|
| `/api/checkout/session` | POST | Required | 12/min | UNAUTHORIZED, RATE_LIMITED, INVALID_INPUT, CHECKOUT_ERROR |
| `/api/checkout/success` | GET | Optional (`session_id` + `confirmation_nonce`) | — | INVALID_INPUT, FORBIDDEN, PAYMENT_PENDING, FULFILLMENT_PENDING, CHECKOUT_ERROR |
| `/api/checkout/webhook` | POST | Stripe signature | Stripe retries | Invalid signature, webhook processing failed |
| `/api/orders/quote` | POST | Required | 25/min | UNAUTHORIZED, RATE_LIMITED, INVALID_INPUT, QUOTE_ERROR |
| `/api/orders/create` | POST | Required + feature flag (non-prod only) | 3/min | ENDPOINT_DISABLED, RATE_LIMITED, UNAUTHORIZED, INVALID_INPUT |
| `/api/images/verify` | POST | Required | 30/min | UNAUTHORIZED, RATE_LIMITED, INVALID_INPUT, NOT_FOUND, VERIFY_ERROR |

### Notes

- `/api/orders/create` is an internal debug-only route. In production it must return `410 ENDPOINT_DISABLED`.
| `/api/debug` | GET | Admin | — | 404 for non-admin |
