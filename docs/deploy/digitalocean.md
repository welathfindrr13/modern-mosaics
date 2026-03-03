# DigitalOcean Deployment Runbook

This runbook targets a production deploy on DigitalOcean App Platform using a single Next.js web service.

## 1. Deploy Target

- Service type: Web Service (Dockerfile or Node buildpack).
- Runtime: Node.js 20 LTS.
- Instance size: start at 1 vCPU / 2 GB RAM minimum.
- Region: choose closest to your primary market.
- Health check path: `/api/health`.

## 2. Pre-Deploy Requirements

- Stripe sandbox keys configured for staging.
- Stripe live keys configured for production.
- Stripe webhook endpoint registered per environment.
- Firebase client config env vars (`NEXT_PUBLIC_FIREBASE_*`).
- Firebase Admin service account JSON in `FIREBASE_SERVICE_ACCOUNT_KEY`.
- Cloudinary, Gelato, OpenAI keys present.
- `ENABLE_DIRECT_ORDER_CREATE=false` in all deployed environments.

## 3. App Configuration (Recommended)

- Baseline app spec: `.do/app.yaml`
- Build command: `npm ci && npm run build`
- Run command: `npm run start`
- HTTP port: `3000`
- Auto deploy from main branch only after staging validation.
- Enable zero-downtime deploys if available.

## 4. Stripe Production Hardening

1. Create staging webhook endpoint: `https://<staging-domain>/api/checkout/webhook`
2. Create production webhook endpoint: `https://<prod-domain>/api/checkout/webhook`
3. Subscribe each endpoint to `checkout.session.completed`.
4. Subscribe each endpoint to `checkout.session.async_payment_succeeded`.
5. Subscribe each endpoint to `checkout.session.expired`.
6. Set `STRIPE_WEBHOOK_SECRET` from each environment's endpoint secret.
7. Keep sandbox and live keys strictly separated between environments.

## 5. Security Controls

- Keep debug endpoints restricted in non-development via `DEBUG_ADMIN_EMAILS`.
- Do not expose server-only secrets as `NEXT_PUBLIC_*`.
- Restrict branch protections so only reviewed code reaches production.
- Rotate API keys on a scheduled basis.
- Confirm HTTPS-only domains in production.

## 6. Post-Deploy Smoke Test

1. `GET /api/health` returns 200.
2. Sign in and complete a sandbox Stripe checkout.
3. Confirm webhook receives event and returns 200.
4. Confirm order appears in dashboard and confirmation page.
5. Refresh confirmation page; verify no duplicate fulfillment is created.
6. Verify `/api/orders/create` returns `410 ENDPOINT_DISABLED`.
7. Verify no new open incidents in `fulfillmentOpsQueue`.

## 7. Rollback Plan

1. Re-deploy previous known-good release in App Platform.
2. Verify `/api/health` and login flow.
3. Re-run Stripe sandbox checkout.
4. Confirm rollback did not create new open entries in `fulfillmentOpsQueue`.
5. If webhook failures continue, disable new checkout temporarily by rotating Stripe publishable key to staging key and notify users.
