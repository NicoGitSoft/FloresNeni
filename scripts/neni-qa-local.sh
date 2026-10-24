#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$HOME/Proyectos/FloresNeni}"
shift || true
BROWSER=0
WEBPAY=0

for arg in "$@"; do
  case "$arg" in
    --browser) BROWSER=1 ;;
    --webpay) WEBPAY=1; BROWSER=1 ;;
    *) echo "Argumento desconocido: $arg" >&2; exit 2 ;;
  esac
done

cd "$ROOT"

echo "=========================================="
echo " NENI QA LOCAL"
echo " branch=$(git branch --show-current)"
echo " head=$(git rev-parse --short HEAD)"
echo " browser=$BROWSER webpay=$WEBPAY"
echo "=========================================="

pnpm neni:scripts:check
pnpm neni:dev:up
pnpm neni:test:checkout
pnpm neni:test:inventory
pnpm neni:test:webpay
pnpm --filter @dtc/backend build
pnpm --filter @neni/storefront build
pnpm neni:check
pnpm neni:verify:payments

echo
echo "→ Smoke Order API"
pnpm neni:e2e:order

if [[ "$BROWSER" -eq 1 ]]; then
  echo
  echo "→ Browser E2E"
  pnpm neni:e2e:browser
fi

if [[ "$WEBPAY" -eq 1 ]]; then
  echo
  echo "→ Webpay external sandbox E2E"
  pnpm neni:e2e:webpay
fi

echo
echo "=========================================="
echo " ✅ NENI QA LOCAL PASSED"
echo "=========================================="
