# Environment Variable Matrix

Use separate values for staging and production. Never reuse Stripe live keys in staging.

| Variable | Scope | Required | Staging | Production | Notes |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Public | Yes | Staging Firebase app | Prod Firebase app | Client SDK config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Public | Yes | Staging domain | Prod domain | Client SDK config |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Public | Yes | Staging project | Prod project | Must match Admin project |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Public | Yes | Staging bucket | Prod bucket | Client SDK config |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Public | Yes | Staging sender ID | Prod sender ID | Client SDK config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Public | Yes | Staging app ID | Prod app ID | Client SDK config |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Public | No | Optional | Optional | Analytics only |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Secret | Yes | Staging service account JSON | Prod service account JSON | Firebase Admin SDK auth |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Public | Yes | Staging cloud | Prod cloud | Used for image URLs |
| `CLOUDINARY_API_KEY` | Secret | Yes | Staging key | Prod key | Server uploads/transforms |
| `CLOUDINARY_API_SECRET` | Secret | Yes | Staging secret | Prod secret | Server uploads/transforms |
| `CLOUDINARY_UPLOAD_PRESET` | Secret | Yes | Staging preset | Prod preset | Upload preset name |
| `OPENAI_API_KEY` | Secret | Yes | Staging key | Prod key | Generation/editing endpoints |
| `GELATO_API_KEY` | Secret | Yes | Staging key | Prod key | Fulfillment API |
| `GELATO_PARTNER_ID` | Secret | Recommended | Staging partner ID | Prod partner ID | Include if required by account setup |
| `STRIPE_SECRET_KEY` | Secret | Yes | `sk_test_...` | `sk_live_...` | Server Stripe client |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Public | Yes | `pk_test_...` | `pk_live_...` | Browser checkout session flow |
| `STRIPE_WEBHOOK_SECRET` | Secret | Yes | `whsec_...` for staging endpoint | `whsec_...` for prod endpoint | Must match exact endpoint |
| `STRIPE_SUCCESS_URL` | Secret | Yes | Staging confirmation URL | Prod confirmation URL | Should not include query params |
| `STRIPE_CANCEL_URL` | Secret | Yes | Staging order URL | Prod order URL | Checkout cancellation return |
| `NEXT_PUBLIC_MARKUP_PERCENT` | Public | Yes | Pricing config | Pricing config | Keep consistent with strategy |
| `DEBUG_ADMIN_EMAILS` | Secret | Recommended | Restricted admin list | Restricted admin list | Comma-separated allowlist |
| `ENABLE_DIRECT_ORDER_CREATE` | Secret | Yes | `false` | `false` | Keep direct create endpoint disabled |
| `CLOUDFLARE_ACCOUNT_ID` | Secret | Optional | If Cloudflare path enabled | If Cloudflare path enabled | Only needed for Cloudflare flows |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | Secret | Optional | If R2 enabled | If R2 enabled | Only needed for R2 storage |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Secret | Optional | If R2 enabled | If R2 enabled | Only needed for R2 storage |
| `CLOUDFLARE_R2_BUCKET_NAME` | Secret | Optional | If R2 enabled | If R2 enabled | Only needed for R2 storage |
| `CLOUDFLARE_IMAGES_ACCOUNT_ID` | Secret | Optional | If Images enabled | If Images enabled | Only needed for CF Images |
| `CLOUDFLARE_IMAGES_API_TOKEN` | Secret | Optional | If Images enabled | If Images enabled | Only needed for CF Images |
| `CLOUDFLARE_IMAGES_ACCOUNT_HASH` | Secret | Optional | If Images enabled | If Images enabled | Only needed for CF Images |
| `ENABLE_NEW_UPSCALE` | Secret | Optional | Feature-flag as needed | Feature-flag as needed | Use `true`/`false` |
| `GEMINI_API_KEY` | Secret | Optional | If Gemini path enabled | If Gemini path enabled | Only needed for Gemini integration |

## Mandatory Production Checks

1. `STRIPE_SECRET_KEY` starts with `sk_live_`.
2. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` starts with `pk_live_`.
3. `STRIPE_WEBHOOK_SECRET` matches the production endpoint in Stripe Dashboard.
4. `ENABLE_DIRECT_ORDER_CREATE` is set to `false`.
5. `FIREBASE_SERVICE_ACCOUNT_KEY` decodes to the same project as `NEXT_PUBLIC_FIREBASE_PROJECT_ID`.
