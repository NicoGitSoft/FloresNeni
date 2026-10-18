#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "→ git diff --check"
git diff --check

echo "→ storefront typecheck"
pnpm --filter @dtc/backend exec tsc --noEmit --project ../storefront/tsconfig.json

echo "→ storefront build"
pnpm --filter @neni/storefront build

echo "→ backend build"
pnpm --filter @dtc/backend build

echo "✅ Neni checks OK"
