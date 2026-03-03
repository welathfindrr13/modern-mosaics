# Non-Regression Checklist

Use this checklist before every deploy to verify core flows still work.

## Authentication
- [ ] Google Sign-In works from `/signin`
- [ ] Auth state persists on refresh (cookie + Firebase)
- [ ] Token refresh works (wait 45 min or force-refresh)
- [ ] Sign-out clears cookies and redirects
- [ ] Unauthenticated users are redirected from protected routes

## Create Flow (`/create`)
- [ ] Photo Prints tab: upload → preview → "Choose size & order" link works
- [ ] Creative Art tab: prompt → generate → preview renders
- [ ] PrintConfidencePanel displays correct DPI tiers after upload
- [ ] Enhancements toggle on/off, preview updates
- [ ] Cancel button stops in-flight generation

## Order Flow (`/order`)
- [ ] Image loads from `publicId` query param
- [ ] Product type and size selection updates price
- [ ] Poor-quality sizes are blocked (cannot click or checkout)
- [ ] Shipping address form validates required fields
- [ ] Country change triggers Gelato quote + currency conversion
- [ ] "Proceed to Payment" button creates Stripe checkout session
- [ ] Stripe checkout page loads with correct line items and currency

## Checkout Success (`/order/confirmation`)
- [ ] Stripe `session_id` + `confirmation_nonce` params trigger payment verification
- [ ] Webhook creates Gelato order after payment (idempotency on refresh)
- [ ] Order details render (product, address, pricing, status)
- [ ] PrintConfidencePanel renders on confirmation page
- [ ] "View Dashboard" and "Create Another" links work

## Dashboard
- [ ] `/dashboard` loads for authenticated users
- [ ] `/dashboard/orders` lists orders from localStorage
- [ ] Order cards show correct status and link to confirmation

## Edit Flow (`/edit`)
- [ ] Upload → mask → generate → pick works end-to-end
- [ ] Scene Reimagine presets fill prompt field
- [ ] Selected image redirects to `/order`

## API Security
- [ ] Unauthenticated requests to protected endpoints return 401
- [ ] Rate-limited endpoints return 429 with `Retry-After` header
- [ ] Debug routes return 404 in production for non-admin users
- [ ] Checkout session ignores client-supplied prices (server-side pricing)
- [ ] `/api/orders/create` returns `410 ENDPOINT_DISABLED` in production
- [ ] `/api/checkout/success` rejects requests without valid `confirmation_nonce`
- [ ] `/api/checkout/success` rejects requests with invalid `confirmation_nonce`
- [ ] Non-retryable webhook failures create/open an item in `fulfillmentOpsQueue`

## Visual
- [ ] Homepage renders without hydration errors
- [ ] Dark theme consistent across all pages
- [ ] Footer links to `/privacy` and `/terms` resolve

## Gallery
- [ ] `/gallery` loads user images
- [ ] Clicking an image navigates to `/order`
