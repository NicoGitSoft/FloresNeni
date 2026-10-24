# Neni Payments / Webpay Plus

## Objetivo del slice

Conseguir primero un vertical de e-commerce comprobable:

1. Cart de Medusa.
2. Datos de checkout Neni.
3. Shipping Method real en el Cart.
4. Payment Collection.
5. Payment Session.
6. Orden con `pp_system_default` para aislar el flujo Medusa.
7. Webpay Plus ambiente de integración.
8. `commit` server-side mediante el Payment Module Provider.
9. Order Medusa.
10. Refund desde el provider.

## Versiones objetivo

- Node >= 22.22.0; baseline de desarrollo/CI: Node 22.23.4 LTS.
- Medusa 2.22.1.
- transbank-sdk 6.1.1.
- PostgreSQL 15 soportado para este slice.
- Redis 7 soportado para este slice.

No se mezcla en esta rama una migración mayor de PostgreSQL/Redis ni el
Production/Availability Engine.

## Provider

Provider ID Medusa: `pp_webpay_webpay`.

El provider utiliza Webpay Plus normal (captura simultánea). No usa Webpay
Diferido en v1.

Ambiente de integración usa las credenciales oficiales embebidas por el SDK.
Producción exige `WEBPAY_COMMERCE_CODE` y `WEBPAY_API_KEY` por variables de
entorno y `WEBPAY_RETURN_URL` HTTPS.

## Flujo

`initiatePayment` crea la transacción Webpay y guarda en `PaymentSession.data`
solo información apta para storefront: token, URL, buy_order, session_id,
amount y currency.

`session_id` contiene el `cart_id`, lo que permite correlacionar el retorno sin
guardar secretos ni confiar en un parámetro inventado por el browser.

Transbank vuelve a `/webpay/return`.

- Si llega `TBK_TOKEN`, se considera abortado y NO se ejecuta `commit`.
- Si llega `token_ws`, se consulta `status(token)` para recuperar `session_id`,
  se verifica que el token coincida con la Payment Session del Cart y que
  `payment_session.amount === cart.total`.
- El retorno valida token, Cart, Payment Session y monto y redirige al storefront.
- El storefront usa el endpoint nativo `POST /store/carts/:id/complete`; Medusa
  llama al provider `authorizePayment`, que ejecuta `commit(token)`.
- El provider acepta éxito solamente con `status=AUTHORIZED`,
  `response_code=0`, monto, buy_order y session_id exactos.
- Webpay Plus normal se informa a Medusa como `captured`.

`cancelPayment` intenta refund si una transacción ya capturada necesita
compensación durante rollback.

## Riesgos conocidos cubiertos

- Medusa no siempre valida por sí mismo que el monto autorizado sea idéntico al
  total actual: el retorno Neni añade un guard explícito antes de completar.
- No se invoca `completeCartWorkflow` desde un workflow custom. La finalización
  usa el endpoint Store oficial para evitar el bug abierto de nested/runAsStep y
  reducir la superficie frente al retorno prematuro observado en Medusa.
- Ante error ambiguo de `commit`, el provider consulta `status(token)` antes de
  concluir que falló, evitando doble confirmación.
- `TBK_TOKEN` de cancelación nunca se envía a `commit`.
- CLP se exige entero positivo.
- Las credenciales productivas nunca se guardan en PaymentSession.data ni en Git.

## Qué queda fuera

- Webpay Plus Diferido.
- Oneclick.
- Múltiples pagos parciales en UI (Medusa Payment Collection ya soporta
  múltiples Payment Sessions/Payments).
- Production/Availability/reservas.
- Shipping real por comuna/tarifa.
- Redis Workflow Engine/Event Bus/locking de producción.

## QA y productividad

La matriz de pruebas vive en `docs/QA_TEST_MATRIX.md`.

Principio:
- unit/build/config deterministas → CI;
- Order local → smoke;
- browser E2E → local;
- Webpay sandbox externo → release gate, no CI.

Comandos principales:
- `pnpm neni:dev:up`
- `pnpm neni:dev:status`
- `pnpm neni:qa`
- `pnpm neni:qa:browser`
- `pnpm neni:qa:webpay`
