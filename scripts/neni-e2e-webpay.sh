#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$HOME/Proyectos/FloresNeni}"
SCENARIO="${NENI_WEBPAY_SCENARIO:-approved}"   # approved|rejected|cancel
MODE="${NENI_WEBPAY_MODE:-run}"                # run|inspect
BASE_URL="${NENI_STOREFRONT_URL:-http://127.0.0.1:4321}"
BACKEND_URL="${NENI_BACKEND_URL:-http://127.0.0.1:9000}"
DEBUG_PORT="${NENI_WEBPAY_CDP_PORT:-9777}"
PROFILE="/tmp/neni-webpay-e2e-profile"
BROWSER_LOG="/tmp/neni-webpay-e2e-browser.log"
CDP_SCRIPT="/tmp/neni-webpay-e2e-state-machine.mjs"
OUTPUT="/tmp/neni-webpay-e2e-output.txt"

cd "$ROOT"

case "$SCENARIO" in
  approved) CARD="4051885600446623"; CVV="123" ;;
  rejected) CARD="5186059559590568"; CVV="123" ;;
  cancel) CARD=""; CVV="" ;;
  *) echo "Escenario inválido: $SCENARIO" >&2; exit 2 ;;
esac

KEY="$(grep '^PUBLIC_MEDUSA_PUBLISHABLE_KEY=' apps/storefront/.env | cut -d= -f2- || true)"
[[ "$KEY" == pk_* ]] || { echo "Publishable key inválida" >&2; exit 1; }
curl -fsS "$BACKEND_URL/health" >/dev/null || { echo "Backend no disponible" >&2; exit 1; }
curl -fsS "$BASE_URL/" >/dev/null || { echo "Storefront no disponible" >&2; exit 1; }

echo "=== NENI WEBPAY E2E ==="
echo "Scenario: $SCENARIO"
echo "Mode:     $MODE"

REGION_ID="$(
  curl -fsS "$BACKEND_URL/store/regions?limit=50" \
    -H "x-publishable-api-key: $KEY" \
  | jq -r '.regions[] | select(.name=="Chile" and .currency_code=="clp") | .id' | head -n1
)"
[[ "$REGION_ID" == reg_* ]] || { echo "No encontré Chile/CLP" >&2; exit 1; }

PRODUCTS="$(
  curl -fsS --get "$BACKEND_URL/store/products" \
    -H "x-publishable-api-key: $KEY" \
    --data-urlencode "region_id=$REGION_ID" \
    --data-urlencode 'country_code=cl' \
    --data-urlencode 'limit=100' \
    --data-urlencode 'fields=id,title,*variants.calculated_price'
)"
[[ "$(jq '.products|length' <<<"$PRODUCTS")" -eq 11 ]] || { echo "Catálogo != 11" >&2; exit 1; }

TITLE="$(jq -r '.products[0].title' <<<"$PRODUCTS")"
VARIANT="$(jq -r '.products[0].variants[0].id' <<<"$PRODUCTS")"
EXPECTED_AMOUNT="$(jq -r '.products[0].variants[0].calculated_price.calculated_amount' <<<"$PRODUCTS")"

CART="$(
  curl -fsS -X POST "$BACKEND_URL/store/carts" \
    -H "x-publishable-api-key: $KEY" -H 'Content-Type: application/json' \
    --data "$(jq -nc --arg region_id "$REGION_ID" '{region_id:$region_id}')"
)"
CART_ID="$(jq -r '.cart.id' <<<"$CART")"
[[ "$CART_ID" == cart_* ]] || { echo "No se creó Cart" >&2; exit 1; }

curl -fsS -X POST "$BACKEND_URL/store/carts/$CART_ID/line-items" \
  -H "x-publishable-api-key: $KEY" -H 'Content-Type: application/json' \
  --data "$(jq -nc --arg v "$VARIANT" '{variant_id:$v,quantity:1}')" >/dev/null

DATE="$(TZ=America/Santiago date -d tomorrow +%F)"
curl -fsS -X POST "$BACKEND_URL/store/neni/checkout" \
  -H "x-publishable-api-key: $KEY" -H 'Content-Type: application/json' \
  --data "$(jq -nc --arg id "$CART_ID" --arg date "$DATE" '{
    cart_id:$id,first_name:"Webpay",last_name:"QA",
    email:"webpay-qa@neni.local",phone:"+56911111111",
    fulfillment_method:"pickup",requested_date:$date
  }')" >/dev/null

OPTIONS="$(curl -fsS "$BACKEND_URL/store/shipping-options?cart_id=$CART_ID" -H "x-publishable-api-key: $KEY")"
PICKUP="$(jq -r '.shipping_options[]|select(.name=="Retiro Taller Neni (desarrollo)")|.id' <<<"$OPTIONS"|head -n1)"
[[ "$PICKUP" == so_* ]] || { echo "No encontré retiro" >&2; exit 1; }
curl -fsS -X POST "$BACKEND_URL/store/carts/$CART_ID/shipping-methods" \
  -H "x-publishable-api-key: $KEY" -H 'Content-Type: application/json' \
  --data "$(jq -nc --arg id "$PICKUP" '{option_id:$id}')" >/dev/null

COL="$(curl -fsS -X POST "$BACKEND_URL/store/payment-collections" \
  -H "x-publishable-api-key: $KEY" -H 'Content-Type: application/json' \
  --data "$(jq -nc --arg id "$CART_ID" '{cart_id:$id}')")"
COL_ID="$(jq -r '.payment_collection.id' <<<"$COL")"
[[ "$COL_ID" == pay_col_* ]] || { echo "No se creó Payment Collection" >&2; exit 1; }

SESSION="$(curl -fsS -X POST "$BACKEND_URL/store/payment-collections/$COL_ID/payment-sessions" \
  -H "x-publishable-api-key: $KEY" -H 'Content-Type: application/json' \
  --data "$(jq -nc --arg id "$CART_ID" '{provider_id:"pp_webpay_webpay",data:{cart_id:$id}}')")"
TOKEN="$(jq -r '.payment_collection.payment_sessions[]|select(.provider_id=="pp_webpay_webpay")|.data.token_ws // empty' <<<"$SESSION")"
WPURL="$(jq -r '.payment_collection.payment_sessions[]|select(.provider_id=="pp_webpay_webpay")|.data.webpay_url // empty' <<<"$SESSION")"
AMOUNT="$(jq -r '.payment_collection.payment_sessions[]|select(.provider_id=="pp_webpay_webpay")|.amount // empty' <<<"$SESSION")"

[[ -n "$TOKEN" && "$WPURL" == https://* ]] || { jq . <<<"$SESSION"; exit 1; }
[[ "$AMOUNT" == "$EXPECTED_AMOUNT" ]] || { echo "Monto inconsistente: $AMOUNT != $EXPECTED_AMOUNT" >&2; exit 1; }

echo "Cart:     $CART_ID"
echo "Producto: $TITLE"
echo "Monto:    CLP $AMOUNT"
echo "URL:      $WPURL"
echo "Token:    ${TOKEN:0:12}..."

BROWSER=""
for c in microsoft-edge microsoft-edge-stable google-chrome google-chrome-stable chromium chromium-browser; do
  if command -v "$c" >/dev/null 2>&1; then BROWSER="$(command -v "$c")"; break; fi
done
[[ -n "$BROWSER" ]] || { echo "No encontré Edge/Chrome/Chromium" >&2; exit 1; }

rm -rf "$PROFILE"
pkill -f "remote-debugging-port=$DEBUG_PORT" 2>/dev/null || true
"$BROWSER" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --remote-debugging-address=127.0.0.1 --remote-debugging-port="$DEBUG_PORT" \
  --user-data-dir="$PROFILE" "$BASE_URL/" >"$BROWSER_LOG" 2>&1 &
PID=$!
trap 'kill "$PID" >/dev/null 2>&1 || true' EXIT

for _ in $(seq 1 50); do
  curl -fsS "http://127.0.0.1:$DEBUG_PORT/json" >/dev/null 2>&1 && break
  sleep .2
done
curl -fsS "http://127.0.0.1:$DEBUG_PORT/json" >/dev/null || { tail -n 80 "$BROWSER_LOG"; exit 1; }

cat > "$CDP_SCRIPT" <<'NODE'
import fs from "node:fs"

const port=process.env.CDP_PORT
const webpayUrl=process.env.WEBPAY_URL
const token=process.env.WEBPAY_TOKEN
const scenario=process.env.SCENARIO
const mode=process.env.MODE
const cardValue=process.env.CARD
const cvvValue=process.env.CVV
const expectedCart=process.env.CART_ID
const amount=Number(process.env.EXPECTED_AMOUNT)

const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const started=Date.now()
const sec=()=>((Date.now()-started)/1000).toFixed(1)
const log=s=>console.log(`[${sec()}s] ${s}`)

const targets=await (await fetch(`http://127.0.0.1:${port}/json`)).json()
const target=targets.find(t=>t.type==="page")
if(!target)throw new Error("No page target")

const ws=new WebSocket(target.webSocketDebuggerUrl)
let seq=0
const pending=new Map()
ws.onmessage=e=>{
  const m=JSON.parse(e.data)
  if(m.id&&pending.has(m.id)){
    const p=pending.get(m.id);pending.delete(m.id)
    m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result)
    return
  }
  if(m.method==="Network.responseReceived"&&m.params?.type==="Document"){
    log(`HTTP ${m.params.response.status} ${m.params.response.url}`)
  }
  if(m.method==="Network.loadingFailed"&&m.params?.type==="Document"){
    log(`NETWORK FAIL ${m.params.errorText}`)
  }
}
await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j})

const send=(method,params={})=>new Promise((resolve,reject)=>{
  const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))
})
async function ev(expr){
  const r=await send("Runtime.evaluate",{expression:expr,awaitPromise:true,returnByValue:true})
  if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text)
  return r.result?.value
}
async function url(){return ev("location.href")}
async function body(){return ev("document.body?.innerText||''")}
async function shot(name){
  const s=await send("Page.captureScreenshot",{format:"png",fromSurface:true})
  fs.writeFileSync(`/tmp/${name}.png`,Buffer.from(s.data,"base64"))
}
async function dump(name){
  fs.writeFileSync(`/tmp/${name}.html`,await ev("document.documentElement?.outerHTML||''"))
}

const CONTROLS=`(() => [...document.querySelectorAll("input,button,select,textarea,[contenteditable=true]")].map((e,i)=>({
  i,tag:e.tagName,type:e.type||"",name:e.name||"",id:e.id||"",
  placeholder:e.placeholder||"",aria:e.getAttribute("aria-label")||"",
  role:e.getAttribute("role")||"",autocomplete:e.getAttribute("autocomplete")||"",
  text:(e.innerText||e.textContent||"").trim().replace(/\\s+/g," ").slice(0,120),
  value:e.value||"",maxLength:typeof e.maxLength==="number"?e.maxLength:null,
  visible:!!(e.offsetWidth||e.offsetHeight||e.getClientRects().length)
})))()`
async function controls(){return ev(CONTROLS)}
const key=x=>`${x.tag} ${x.type} ${x.name} ${x.id} ${x.placeholder} ${x.aria} ${x.role} ${x.autocomplete} ${x.text}`.toLowerCase()
const visible=a=>a.filter(x=>x.visible)
const find=(a,res)=>a.find(x=>x.visible&&res.some(r=>r.test(key(x))))
const findEditable=(a,res)=>a.find(x=>x.visible&&["INPUT","TEXTAREA"].includes(x.tag)&&!["hidden","button","submit","radio","checkbox"].includes((x.type||"").toLowerCase())&&res.some(r=>r.test(key(x))))
const findButton=(a,res)=>a.find(x=>{
  if(
    !x.visible ||
    !(
      x.tag==="BUTTON" ||
      (x.tag==="INPUT"&&["button","submit"].includes((x.type||"").toLowerCase()))
    )
  )return false

  const composite=key(x)
  const visibleText=(x.text||"").trim().toLowerCase()

  return res.some(r=>{
    r.lastIndex=0
    if(r.test(composite))return true
    r.lastIndex=0
    return r.test(visibleText)
  })
})

async function click(i){
  return ev(`(() => {const e=[...document.querySelectorAll("input,button,select,textarea,[contenteditable=true]")][${i}];if(!e)return false;e.click();return true})()`)
}
async function setValue(i,value){
  return ev(`(() => {
    const e=[...document.querySelectorAll("input,button,select,textarea,[contenteditable=true]")][${i}]
    if(!e)return false
    if(e instanceof HTMLInputElement||e instanceof HTMLTextAreaElement){
      const p=e instanceof HTMLInputElement?HTMLInputElement.prototype:HTMLTextAreaElement.prototype
      const s=Object.getOwnPropertyDescriptor(p,"value")?.set
      if(s)s.call(e,${JSON.stringify(value)});else e.value=${JSON.stringify(value)}
    }else if(e.isContentEditable){e.textContent=${JSON.stringify(value)}}
    else return false
    for(const n of ["focus","input","change","blur"])e.dispatchEvent(new Event(n,{bubbles:true,composed:true}))
    return true
  })()`)
}
async function focusAndType(i,value){
  await ev(`(() => {const e=[...document.querySelectorAll("input,button,select,textarea,[contenteditable=true]")][${i}];if(!e)return false;e.focus();e.click();return true})()`)
  await send("Input.insertText",{text:value})
}
async function summary(label){
  const a=visible(await controls())
  log(`${label}: ${await url()} => ${a.map(x=>`${x.tag}/${x.type||"-"} id=${x.id||"-"} name=${x.name||"-"} text=${x.text||"-"} value=${x.value?"<set>":"-"}`).join(" | ")}`)
  return a
}
async function wait(label,fn,ms=15000){
  const t=Date.now();let next=0
  while(Date.now()-t<ms){
    const v=await fn().catch(()=>null)
    if(v){log(`${label}: OK`);return v}
    if(Date.now()>=next){next=Date.now()+1000;await summary(`${label} esperando`)}
    await sleep(250)
  }
  await summary(`${label} TIMEOUT`)
  await shot(`neni-webpay-${label}-timeout`)
  await dump(`neni-webpay-${label}-timeout`)
  throw new Error(`${label}: timeout ${ms/1000}s`)
}

await send("Page.enable");await send("Runtime.enable");await send("Network.enable")

await ev(`(() => {
 const f=document.createElement("form");f.method="POST";f.action=${JSON.stringify(webpayUrl)}
 const i=document.createElement("input");i.type="hidden";i.name="token_ws";i.value=${JSON.stringify(token)}
 f.appendChild(i);document.body.appendChild(f);f.submit()
})()`)
log(`START scenario=${scenario} cart=${expectedCart} amount=${amount}`)

// 1. Medio de pago
const method=await wait("01-metodo",async()=>{
  const a=await controls()
  return findButton(a,[/tarjetas cr[eé]dito/,/cr[eé]dito.*d[eé]bito/,/^tarjetas/])
},15000)
log(`Click método: ${method.text||method.id}`)
await click(method.i)
await shot("neni-webpay-01-metodo")

// Cancelación deliberada.
if(scenario==="cancel"){
  const cancel=await wait("02-cancel-button",async()=>findButton(await controls(),[/anular compra/,/cancelar/,/volver/]),10000)
  log(`Click cancelación: ${cancel.text}`)
  await click(cancel.i)
}else{
  // 2. El UI actual presenta un control "card-number" que puede NO ser un input.
  let cardDone=false
  for(let pass=1;pass<=4&&!cardDone;pass++){
    const a=await wait(`02-card-control-${pass}`,async()=>{
      const all=await controls()
      return find(all,[/card-number/,/numero.*tarjeta/,/n[uú]mero.*tarjeta/,/card.?number/])
    },10000)

    log(`Card control detectado: ${JSON.stringify(a)}`)

    const editable=["INPUT","TEXTAREA"].includes(a.tag)&&!["button","submit","radio","checkbox","hidden"].includes((a.type||"").toLowerCase())
    if(editable){
      await setValue(a.i,cardValue)
      cardDone=true
      log("Número de tarjeta escrito en input editable.")
    }else{
      // Es selector/componente/botón: abrirlo y volver a inspeccionar.
      log(`card-number no editable (${a.tag}/${a.type||"-"}); click para abrir/controlar componente.`)
      await click(a.i)
      await sleep(500)

      const b=await controls()
      const nested=findEditable(b,[/card-number/,/numero.*tarjeta/,/n[uú]mero.*tarjeta/,/card.?number/]) ||
                   visible(b).find(x=>["INPUT","TEXTAREA"].includes(x.tag)&&!["button","submit","radio","checkbox","hidden"].includes((x.type||"").toLowerCase())&&x.maxLength>=15)
      if(nested){
        log(`Input tarjeta posterior al click: ${JSON.stringify(nested)}`)
        await setValue(nested.i,cardValue)
        cardDone=true
      }else{
        // Último fallback: el componente puede captar teclado al obtener focus.
        log("No apareció input convencional; probando focus + Input.insertText sobre el control.")
        await focusAndType(a.i,cardValue)
        await sleep(300)
        cardDone=true
      }
    }
  }

  if(!cardDone)throw new Error("No fue posible completar número de tarjeta.")
  await shot("neni-webpay-02-card-number")

  // Inspect-only: evidencia útil sin seguir con un pago.
  if(mode==="inspect"){
    await summary("INSPECT")
    await dump("neni-webpay-inspect")
    console.log(JSON.stringify({status:"INSPECTED",scenario,cart_id:expectedCart,url:await url()},null,2))
    process.exit(0)
  }

  // 3. State machine de pantallas: details / auth / approve / final.
  const deadline=Date.now()+45000
  let detailsFilled=false
  let authFilled=false
  let approveClicked=false

  while(Date.now()<deadline){
    const u=await url()
    const text=(await body()).toLowerCase()
    const all=await controls()

    // Éxito final.
    if(u.includes("/order-success?order_id=")){
      const order=new URL(u).searchParams.get("order_id")
      if(!order?.startsWith("order_"))throw new Error(`order_id inválido: ${u}`)
      await shot("neni-webpay-05-order")
      log(`PASS order=${order}`)
      console.log(JSON.stringify({status:"PASS",scenario,cart_id:expectedCart,amount,order_id:order,final_url:u},null,2))
      process.exit(0)
    }

    // Rechazo esperado.
    if(scenario==="rejected" && /rechazad|transacci[oó]n.*rechaz|no.*autoriz/.test(text)){
      await shot("neni-webpay-05-rejected")
      log("REJECTED esperado detectado.")
      console.log(JSON.stringify({status:"PASS",scenario,result:"REJECTED",cart_id:expectedCart,url:u},null,2))
      process.exit(0)
    }

    // Detectar explícitamente la pantalla de tarjeta.
    // Webpay usa card-cvv como input type=password; eso NO es una clave bancaria.
    const cardNumber=findEditable(all,[
      /card-number/,
      /numero.*tarjeta/,
      /n[uú]mero.*tarjeta/,
      /card.?number/,
      /cc-number/
    ])
    const cvv=findEditable(all,[
      /\\bcvv\\b/,
      /\\bcvc\\b/,
      /seguridad/,
      /card-cvv/
    ])
    const exp=findEditable(all,[
      /card-exp/,
      /cc-exp/,
      /venc/,
      /expir/,
      /fecha.*tarjeta/,
      /expiry/
    ])

    const cardScreen=Boolean(
      cardNumber ||
      cvv ||
      exp ||
      /n[uú]mero de tarjeta|fecha de expiraci[oó]n|\\bcvv\\b/.test(text)
    )

    // Rechazo terminal mostrado por el formulario de tarjeta.
    if(/intenta pagar con otra tarjeta/.test(text)){
      if(scenario==="rejected"){
        await shot("neni-webpay-05-rejected")
        log("REJECTED esperado detectado en pantalla de tarjeta.")
        console.log(JSON.stringify({
          status:"PASS",
          scenario,
          result:"REJECTED",
          cart_id:expectedCart,
          url:u
        },null,2))
        process.exit(0)
      }

      await shot("neni-webpay-card-rejected")
      throw new Error("La tarjeta approved fue rechazada por Webpay.")
    }

    // Mientras sigamos en tarjeta, nunca reinterpretar card-cvv como password bancario.
    if(cardScreen){
      if((cvv||exp)&&!detailsFilled){
        log(`Pantalla detalles tarjeta: cvv=${!!cvv} exp=${!!exp}`)

        if(cvv)await setValue(cvv.i,cvvValue)

        if(exp){
          const v=
            exp.type==="month"
              ?"2028-12"
              :exp.maxLength===4
                ?"1228"
                :"12/28"
          await setValue(exp.i,v)
        }

        detailsFilled=true
        await shot("neni-webpay-03-details")
        await sleep(500)
      }

      // Puede ser "Continuar" o "Pagar", y puede renderizarse después de completar
      // los campos. findButton compara también el texto visible.
      const cardControls=await controls()
      const pay=findButton(cardControls,[
        /^pagar$/,
        /^continuar$/,
        /^siguiente$/
      ])

      if(pay){
        log(`Click tarjeta: ${pay.text}`)
        await click(pay.i)
        await sleep(900)
        continue
      }

      await summary("CARD")
      await sleep(500)
      continue
    }

    // Banco: sólo clasificar como autenticación si ya salimos de tarjeta y la
    // página tiene señales explícitas de identidad/clave.
    const bankContext=
      /(?:\\brut\\b|\\bclave\\b|contrase|autentic|banco|\\busuario\\b)/.test(text)

    if(bankContext&&!authFilled){
      let rut=findEditable(all,[
        /\\brut\\b/,
        /\\busuario\\b/,
        /identific/
      ])

      let pass=findEditable(all,[
        /\\bclave\\b/,
        /password/,
        /contrase/
      ])

      const bankEditables=visible(all).filter(x=>{
        if(!["INPUT","TEXTAREA"].includes(x.tag))return false
        if(["hidden","button","submit","radio","checkbox"].includes(
          (x.type||"").toLowerCase()
        ))return false

        return !/card-number|card-cvv|card-exp|cc-number|cc-exp|\\bcvv\\b|\\bcvc\\b/.test(key(x))
      })

      rut=rut||bankEditables.find(x=>x!==pass)
      pass=
        pass ||
        bankEditables.find(
          x=>
            x!==rut &&
            (
              (x.type||"").toLowerCase()==="password" ||
              /\\bclave\\b|password|contrase/.test(key(x))
            )
        ) ||
        bankEditables.find(x=>x!==rut)

      if(rut&&pass){
        log(
          `Autenticación banco: rut=${rut.id||rut.name||rut.placeholder} ` +
          `pass=${pass.id||pass.name||pass.placeholder}`
        )

        await setValue(
          rut.i,
          rut.maxLength===9
            ?"111111111"
            :"11.111.111-1"
        )
        await setValue(pass.i,"123")

        authFilled=true
        await shot("neni-webpay-04-auth")

        const next=findButton(await controls(),[
          /aceptar/,
          /ingresar/,
          /continuar/,
          /autorizar/,
          /entrar/
        ])

        if(next){
          log(`Click autenticación: ${next.text}`)
          await click(next.i)
        }

        await sleep(800)
        continue
      }
    }

    // Pantalla de aprobación/rechazo posterior a autenticación.
    if(authFilled&&!approveClicked){
      const approve=findButton(all,[
        /^aceptar$/,
        /^aprobar$/,
        /^autorizar$/,
        /^continuar$/
      ])

      if(approve){
        log(`Click aprobación: ${approve.text}`)
        approveClicked=true
        await click(approve.i)
        await sleep(800)
        continue
      }
    }

    // Pantallas intermedias posteriores a tarjeta/banco.
    const generic=findButton(all,[
      /^continuar$/,
      /^siguiente$/
    ])

    if(generic){
      log(`Click intermedio: ${generic.text}`)
      await click(generic.i)
      await sleep(700)
      continue
    }

    await summary("STATE")
    await sleep(750)
  }

  throw new Error(`State machine timeout. url=${await url()} body=${(await body()).slice(0,2500)}`)
}

// Flujo cancel.
{
  const t=Date.now()
  while(Date.now()-t<20000){
    const u=await url()
    const text=(await body()).toLowerCase()
    if(!u.includes("transbank")){
      await shot("neni-webpay-05-cancel")
      log(`CANCEL retorno=${u}`)
      console.log(JSON.stringify({status:"PASS",scenario,result:"CANCELED",cart_id:expectedCart,final_url:u},null,2))
      process.exit(0)
    }
    if(/anulad|cancelad/.test(text)){
      log("Cancelación visible en Webpay; esperando retorno.")
    }
    await sleep(500)
  }
  throw new Error(`Cancel timeout: ${await url()}`)
}
NODE

set +e
CDP_PORT="$DEBUG_PORT" WEBPAY_URL="$WPURL" WEBPAY_TOKEN="$TOKEN" \
SCENARIO="$SCENARIO" MODE="$MODE" CARD="$CARD" CVV="$CVV" \
EXPECTED_AMOUNT="$AMOUNT" CART_ID="$CART_ID" \
node "$CDP_SCRIPT" | tee "$OUTPUT"
RC=${PIPESTATUS[0]}
set -e

if [[ "$RC" -ne 0 ]]; then
  echo
  echo "Webpay E2E falló. Evidencia:"
  ls -1 /tmp/neni-webpay-*.png /tmp/neni-webpay-*.html 2>/dev/null || true
  echo
  echo "Última salida:"
  tail -n 180 "$OUTPUT" 2>/dev/null || true
  exit "$RC"
fi
