#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$HOME/Proyectos/FloresNeni}"
cd "$ROOT"

KEY="$(grep '^PUBLIC_MEDUSA_PUBLISHABLE_KEY=' apps/storefront/.env 2>/dev/null | cut -d= -f2- || true)"

echo "=== NENI DEV STATUS ==="
printf "Rama:  "; git branch --show-current
printf "HEAD:  "; git rev-parse --short HEAD
printf "Node:  "; node --version
printf "pnpm:  "; pnpm --version
echo
echo "Puertos:"
ss -ltnp | grep -E ':4321|:9000|:5433|:6380' || true
echo

if curl -fsS http://127.0.0.1:9000/health >/dev/null 2>&1; then
  echo "Backend :9000      ✅"
else
  echo "Backend :9000      ❌"
fi

if curl -fsS http://127.0.0.1:4321/ >/dev/null 2>&1; then
  echo "Storefront :4321   ✅"
else
  echo "Storefront :4321   ❌"
fi

if [[ "$KEY" == pk_* ]] && curl -fsS http://127.0.0.1:9000/health >/dev/null 2>&1; then
  REGION_ID="$(
    curl -fsS 'http://127.0.0.1:9000/store/regions?limit=50' \
      -H "x-publishable-api-key: $KEY" \
    | jq -r '.regions[] | select(.name=="Chile" and .currency_code=="clp") | .id' \
    | head -n1
  )"

  if [[ "$REGION_ID" == reg_* ]]; then
    COUNT="$(
      curl -fsS --get 'http://127.0.0.1:9000/store/products' \
        -H "x-publishable-api-key: $KEY" \
        --data-urlencode "region_id=$REGION_ID" \
        --data-urlencode 'country_code=cl' \
        --data-urlencode 'limit=100' \
      | jq '.products | length'
    )"
    echo "Chile/CLP          ✅ $REGION_ID"
    echo "Catálogo API       $([[ "$COUNT" -eq 11 ]] && echo "✅" || echo "❌") $COUNT/11"

    PROVIDERS="$(
      curl -fsS "http://127.0.0.1:9000/store/payment-providers?region_id=$REGION_ID" \
        -H "x-publishable-api-key: $KEY" \
      | jq -r '[.payment_providers[].id] | join(", ")'
    )"
    echo "Payment providers  $PROVIDERS"
  fi
fi

echo "======================="
