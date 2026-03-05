# Fulfillment Ops Snapshot

Use this endpoint to inspect stuck fulfillment leases and queued webhook failures.

## Endpoint

`GET /api/debug/fulfillment-ops`

## Access

- Development: open
- Non-development: requires authenticated user whose email is in `DEBUG_ADMIN_EMAILS`

## What it returns

- `summary.processingCount`: active processing leases
- `summary.staleProcessingCount`: leases older than 10 minutes
- `summary.retryableQueueCount`: retryable failures in `fulfillmentOpsQueue`
- `summary.nonRetryableQueueCount`: non-retryable failures in `fulfillmentOpsQueue`
- `staleProcessingItems`: stale lease records with session IDs and attempts
- `retryableQueueItems`: retryable failures and reason codes
- `nonRetryableQueueItems`: terminal failures and reason codes

## Usage

```bash
curl -sS https://your-domain/api/debug/fulfillment-ops | jq .
```

## Operational expectation

Before launch:
- `staleProcessingCount` should be `0`
- `nonRetryableQueueCount` should be `0`

If either is non-zero, investigate before go-live.
