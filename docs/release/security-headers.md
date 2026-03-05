# Security Header Verification

Use this script before release to ensure production headers are present on key paths.

## Command

```bash
./scripts/verify-security-headers.sh https://modern-mosaics-staging-bejzn.ondigitalocean.app
```

## Checks performed

Each of these routes is checked:

- `/`
- `/signin`
- `/order`
- `/api/health`

Headers required:

- `Content-Security-Policy`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- `Strict-Transport-Security`

Also verifies `X-Powered-By` is not present.
