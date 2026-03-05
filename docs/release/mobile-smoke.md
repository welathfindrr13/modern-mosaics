# Mobile Smoke Suite

Runs a quick unauthenticated mobile navigation smoke test and captures screenshots.

## Command

```bash
BASE_URL=https://modern-mosaics-staging-bejzn.ondigitalocean.app \
  npm exec --yes --package=playwright -- node scripts/mobile-smoke.mjs
```

You can also pass the URL as the first arg:

```bash
npm exec --yes --package=playwright -- node scripts/mobile-smoke.mjs https://modern-mosaics-staging-bejzn.ondigitalocean.app
```

## Output

- Screenshots: `artifacts/mobile-smoke/*.png`
- Summary: `artifacts/mobile-smoke/summary.json`

## Routes covered

- `/`
- `/signin`
- `/create`
- `/order`
- `/dashboard`

## Pass criteria

- No navigation errors
- No HTTP status >= 400 on the covered routes
- Screenshot set exists for both profiles:
  - iPhone 12
  - Pixel 7
