#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$HOME/Proyectos/FloresNeni}"
BASE_URL="${NENI_STOREFRONT_URL:-http://127.0.0.1:4321}"
BACKEND_URL="${NENI_BACKEND_URL:-http://127.0.0.1:9000}"
DEBUG_PORT="${NENI_BROWSER_CDP_PORT:-9888}"
PROFILE="/tmp/neni-browser-e2e-profile"
CDP="/tmp/neni-browser-e2e.mjs"

cd "$ROOT"
KEY="$(grep '^PUBLIC_MEDUSA_PUBLISHABLE_KEY=' apps/storefront/.env | cut -d= -f2- || true)"
[[ "$KEY" == pk_* ]] || exit 1
curl -fsS "$BACKEND_URL/health" >/dev/null || exit 1
curl -fsS "$BASE_URL/" >/dev/null || exit 1

REGION_ID="$(curl -fsS "$BACKEND_URL/store/regions?limit=50" -H "x-publishable-api-key: $KEY" | jq -r '.regions[]|select(.name=="Chile" and .currency_code=="clp")|.id' | head -n1)"
PRODUCTS="$(curl -fsS --get "$BACKEND_URL/store/products" -H "x-publishable-api-key: $KEY" --data-urlencode "region_id=$REGION_ID" --data-urlencode 'country_code=cl' --data-urlencode 'limit=100' --data-urlencode 'fields=id,title,*variants.calculated_price')"
[[ "$(jq '.products|length' <<<"$PRODUCTS")" -eq 11 ]] || exit 1
TITLE="$(jq -r '.products[0].title' <<<"$PRODUCTS")"
VARIANT="$(jq -r '.products[0].variants[0].id' <<<"$PRODUCTS")"
CART="$(curl -fsS -X POST "$BACKEND_URL/store/carts" -H "x-publishable-api-key: $KEY" -H 'Content-Type: application/json' --data "$(jq -nc --arg r "$REGION_ID" '{region_id:$r}')")"
CART_ID="$(jq -r '.cart.id' <<<"$CART")"
curl -fsS -X POST "$BACKEND_URL/store/carts/$CART_ID/line-items" -H "x-publishable-api-key: $KEY" -H 'Content-Type: application/json' --data "$(jq -nc --arg v "$VARIANT" '{variant_id:$v,quantity:1}')" >/dev/null
DATE="$(TZ=America/Santiago date -d tomorrow +%F)"
curl -fsS -X POST "$BACKEND_URL/store/neni/checkout" -H "x-publishable-api-key: $KEY" -H 'Content-Type: application/json' --data "$(jq -nc --arg id "$CART_ID" --arg d "$DATE" '{cart_id:$id,first_name:"Browser",last_name:"QA",email:"browser-qa@neni.local",phone:"+56911111111",fulfillment_method:"pickup",requested_date:$d}')" >/dev/null

BROWSER=""
for c in microsoft-edge microsoft-edge-stable google-chrome google-chrome-stable chromium chromium-browser; do command -v "$c" >/dev/null 2>&1 && { BROWSER="$(command -v "$c")"; break; }; done
[[ -n "$BROWSER" ]] || exit 1
rm -rf "$PROFILE"; pkill -f "remote-debugging-port=$DEBUG_PORT" 2>/dev/null || true
"$BROWSER" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --remote-debugging-address=127.0.0.1 --remote-debugging-port="$DEBUG_PORT" --user-data-dir="$PROFILE" "$BASE_URL/" >/tmp/neni-browser-e2e.log 2>&1 &
PID=$!; trap 'kill "$PID" >/dev/null 2>&1 || true' EXIT
for _ in $(seq 1 50); do curl -fsS "http://127.0.0.1:$DEBUG_PORT/json" >/dev/null 2>&1 && break; sleep .2; done

cat > "$CDP" <<'NODE'
const port=process.env.CDP_PORT,base=process.env.BASE_URL,cart=process.env.CART_ID,product=process.env.PRODUCT_TITLE
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const targets=await (await fetch(`http://127.0.0.1:${port}/json`)).json(),target=targets.find(t=>t.type==="page")
const ws=new WebSocket(target.webSocketDebuggerUrl);let seq=0;const pending=new Map()
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result)}}
await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j})
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))})
async function ev(expr){const r=await send("Runtime.evaluate",{expression:expr,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result?.value}
async function nav(u){await send("Page.navigate",{url:u});for(let i=0;i<80;i++){if(await ev("document.readyState")==="complete")break;await sleep(100)}}
async function waitText(t,ms=15000){const s=Date.now();while(Date.now()-s<ms){const b=await ev("document.body?.innerText||''");if(b.includes(t))return b;await sleep(250)}throw new Error(`timeout ${t}`)}
await send("Page.enable");await send("Runtime.enable")
await nav(`${base}/`);let b=await waitText(product);if(b.includes("No pudimos cargar el catálogo"))throw new Error("catalog error")
await ev(`localStorage.setItem("neni_cart_id",${JSON.stringify(cart)})`)
await nav(`${base}/checkout`);b=await waitText(product);if(b.includes("Tu carrito está esperando una flor"))throw new Error("empty checkout")
await nav(`${base}/pay`);b=await waitText("pp_webpay_webpay");for(const t of ["pp_system_default","Pagar con Webpay","Crear orden con pago manual"])if(!b.includes(t))throw new Error(`missing ${t}`)
const clicked=await ev(`(()=>{const b=[...document.querySelectorAll("button")].find(x=>x.textContent?.includes("Crear orden con pago manual"));if(!b)return false;b.click();return true})()`);if(!clicked)throw new Error("button missing")
const s=Date.now();let u="";while(Date.now()-s<30000){u=await ev("location.href");if(u.includes("/order-success?order_id="))break;await sleep(250)}
const order=new URL(u).searchParams.get("order_id");if(!order?.startsWith("order_"))throw new Error(`order fail ${u}`)
console.log(JSON.stringify({status:"PASS",cart_id:cart,product,order_id:order},null,2))
ws.close()
await sleep(100)
NODE
CDP_PORT="$DEBUG_PORT" BASE_URL="$BASE_URL" CART_ID="$CART_ID" PRODUCT_TITLE="$TITLE" node "$CDP"
