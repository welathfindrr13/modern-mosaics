#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-${BASE_URL:-}}"
if [[ -z "$BASE_URL" ]]; then
  echo "Usage: $0 <base-url>"
  echo "Example: $0 https://modern-mosaics-staging-bejzn.ondigitalocean.app"
  exit 1
fi

ENDPOINTS=("/" "/signin" "/order" "/api/health")
REQUIRED_HEADERS=(
  "content-security-policy"
  "x-frame-options"
  "x-content-type-options"
  "referrer-policy"
  "permissions-policy"
  "strict-transport-security"
)

failures=0

for endpoint in "${ENDPOINTS[@]}"; do
  url="${BASE_URL%/}${endpoint}"
  echo "\nChecking ${url}"
  headers="$(curl -fsSIL "$url")"

  for header in "${REQUIRED_HEADERS[@]}"; do
    if ! printf '%s\n' "$headers" | grep -iq "^${header}:"; then
      echo "  MISSING: ${header}"
      failures=$((failures + 1))
    fi
  done

  if printf '%s\n' "$headers" | grep -iq '^x-powered-by:'; then
    echo "  UNEXPECTED: x-powered-by is present"
    failures=$((failures + 1))
  fi
done

if [[ "$failures" -gt 0 ]]; then
  echo "\nSecurity header verification FAILED (${failures} issue(s))."
  exit 1
fi

echo "\nSecurity header verification PASSED."
