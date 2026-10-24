#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$HOME/Proyectos/FloresNeni}"
cd "$ROOT"
KEY="$(grep '^PUBLIC_MEDUSA_PUBLISHABLE_KEY=' apps/storefront/.env | cut -d= -f2-)"
[[ "$KEY" == pk_* ]] || { echo "Publishable key inválida" >&2; exit 1; }

curl -fsS http://127.0.0.1:9000/health >/dev/null || {
  echo "Backend no está arriba. Ejecuta pnpm neni:dev:up" >&2; exit 1;
}

REGION_ID="$(
  curl -fsS 'http://127.0.0.1:9000/store/regions?limit=50' \
    -H "x-publishable-api-key: $KEY" \
  | jq -r '.regions[] | select(.name=="Chile" and .currency_code=="clp") | .id' \
  | head -n1
)"
[[ "$REGION_ID" == reg_* ]] || exit 1

PRODUCTS="$(
  curl -fsS --get 'http://127.0.0.1:9000/store/products' \
    -H "x-publishable-api-key: $KEY" \
    --data-urlencode "region_id=$REGION_ID" \
    --data-urlencode 'country_code=cl' \
    --data-urlencode 'limit=100' \
    --data-urlencode 'fields=id,title,*variants.calculated_price'
)"
[[ "$(jq '.products|length' <<<"$PRODUCTS")" -eq 11 ]] || {
  echo "Catálogo no tiene 11 productos" >&2; exit 1;
}
TITLE="$(jq -r '.products[0].title' <<<"$PRODUCTS")"
VARIANT="$(jq -r '.products[0].variants[0].id' <<<"$PRODUCTS")"

CART="$(
  curl -fsS -X POST 'http://127.0.0.1:9000/store/carts' \
    -H "x-publishable-api-key: $KEY" \
    -H 'Content-Type: application/json' \
    --data "$(jq -nc --arg region_id "$REGION_ID" '{region_id:$region_id}')"
)"
CART_ID="$(jq -r '.cart.id' <<<"$CART")"
[[ "$CART_ID" == cart_* ]] || exit 1

curl -fsS -X POST "http://127.0.0.1:9000/store/carts/$CART_ID/line-items" \
  -H "x-publishable-api-key: $KEY" \
  -H 'Content-Type: application/json' \
  --data "$(jq -nc --arg variant_id "$VARIANT" '{variant_id:$variant_id,quantity:1}')" >/dev/null

DATE="$(TZ=America/Santiago date -d tomorrow +%F)"
curl -fsS -X POST 'http://127.0.0.1:9000/store/neni/checkout' \
  -H "x-publishable-api-key: $KEY" \
  -H 'Content-Type: application/json' \
  --data "$(jq -nc --arg cart_id "$CART_ID" --arg date "$DATE" '{
    cart_id:$cart_id,
    first_name:"QA",
    last_name:"Neni",
    email:"qa-order@neni.local",
    phone:"+56911111111",
    fulfillment_method:"pickup",
    requested_date:$date
  }')" >/dev/null

OPTIONS="$(
  curl -fsS "http://127.0.0.1:9000/store/shipping-options?cart_id=$CART_ID" \
    -H "x-publishable-api-key: $KEY"
)"
PICKUP="$(
  jq -r '.shipping_options[] | select(.name=="Retiro Taller Neni (desarrollo)") | .id' <<<"$OPTIONS" | head -n1
)"
[[ "$PICKUP" == so_* ]] || exit 1
curl -fsS -X POST "http://127.0.0.1:9000/store/carts/$CART_ID/shipping-methods" \
  -H "x-publishable-api-key: $KEY" \
  -H 'Content-Type: application/json' \
  --data "$(jq -nc --arg option_id "$PICKUP" '{option_id:$option_id}')" >/dev/null

COLLECTION="$(
  curl -fsS -X POST 'http://127.0.0.1:9000/store/payment-collections' \
    -H "x-publishable-api-key: $KEY" \
    -H 'Content-Type: application/json' \
    --data "$(jq -nc --arg cart_id "$CART_ID" '{cart_id:$cart_id}')"
)"
COLLECTION_ID="$(jq -r '.payment_collection.id' <<<"$COLLECTION")"
[[ "$COLLECTION_ID" == pay_col_* ]] || exit 1

curl -fsS -X POST \
  "http://127.0.0.1:9000/store/payment-collections/$COLLECTION_ID/payment-sessions" \
  -H "x-publishable-api-key: $KEY" \
  -H 'Content-Type: application/json' \
  --data '{"provider_id":"pp_system_default","data":{"source":"neni-qa"}}' >/dev/null

RESULT="$(
  curl -fsS -X POST "http://127.0.0.1:9000/store/carts/$CART_ID/complete" \
    -H "x-publishable-api-key: $KEY" \
    -H 'Content-Type: application/json'
)"
ORDER_ID="$(jq -r '.order.id // empty' <<<"$RESULT")"
[[ "$ORDER_ID" == order_* ]] || {
  jq . <<<"$RESULT"; echo "No se creó Order" >&2; exit 1;
}

jq -n --arg product "$TITLE" --arg cart "$CART_ID" --arg order "$ORDER_ID" '{
  status:"PASS",
  flow:"Cart → Checkout → Shipping → Payment Collection → pp_system_default → Order",
  product:$product,
  cart_id:$cart,
  order_id:$order
}'
