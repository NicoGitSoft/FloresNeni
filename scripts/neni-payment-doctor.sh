#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

printf '\n=== NENI PAYMENT DOCTOR ===\n'
printf 'Node:  '; node --version
printf 'pnpm:  '; pnpm --version
printf 'branch: '; git branch --show-current
printf 'HEAD:   '; git rev-parse --short HEAD

node - <<'NODE'
const [maj,min] = process.versions.node.split(".").map(Number)
if (maj < 22 || (maj === 22 && min < 22)) {
  throw new Error("Medusa 2.22.x requiere Node >=22.22.0")
}
console.log("Node compatibility: OK")
NODE

node - <<'NODE'
const backend = require("./apps/backend/package.json")
const checks = {
  medusa: backend.dependencies["@medusajs/medusa"],
  framework: backend.dependencies["@medusajs/framework"],
  transbank: backend.dependencies["transbank-sdk"],
}
console.log(checks)
if (checks.medusa !== "2.22.1" || checks.framework !== "2.22.1") {
  throw new Error("Medusa no está alineado en 2.22.1")
}
if (checks.transbank !== "6.1.1") {
  throw new Error("transbank-sdk no está en 6.1.1")
}
NODE

if [[ -f apps/backend/.env ]]; then
  ENVIRONMENT="$(grep '^WEBPAY_ENVIRONMENT=' apps/backend/.env | cut -d= -f2- || true)"
  echo "WEBPAY_ENVIRONMENT=${ENVIRONMENT:-integration(default)}"
  if [[ "$ENVIRONMENT" == "production" ]]; then
    grep -q '^WEBPAY_COMMERCE_CODE=.' apps/backend/.env || {
      echo "Falta WEBPAY_COMMERCE_CODE"; exit 1;
    }
    grep -q '^WEBPAY_API_KEY=.' apps/backend/.env || {
      echo "Falta WEBPAY_API_KEY"; exit 1;
    }
  fi
fi

if curl -fsS http://127.0.0.1:9000/health >/dev/null 2>&1; then
  echo "Backend :9000: OK"

  KEY="$(grep '^PUBLIC_MEDUSA_PUBLISHABLE_KEY=' apps/storefront/.env | cut -d= -f2-)"
  REGION_ID="$(
    curl -fsS \
      'http://127.0.0.1:9000/store/regions?limit=50' \
      -H "x-publishable-api-key: $KEY" \
    | jq -r '.regions[] | select(.name=="Chile" and .currency_code=="clp") | .id' \
    | head -n1
  )"

  echo "Chile region: ${REGION_ID:-MISSING}"

  curl -fsS \
    "http://127.0.0.1:9000/store/payment-providers?region_id=$REGION_ID" \
    -H "x-publishable-api-key: $KEY" \
  | jq '{payment_providers: [.payment_providers[].id]}'
else
  echo "Backend :9000 no está levantado; se omite prueba HTTP."
fi

printf '=== FIN PAYMENT DOCTOR ===\n'
