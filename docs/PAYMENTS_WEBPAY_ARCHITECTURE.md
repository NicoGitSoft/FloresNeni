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

- Si llega `TBK_TOKEN`, se considera abortado y NO se consulta ni confirma ese
  token. Si llegan ambos formatos de token, el retorno se rechaza.
- Con `token_ws`, el backend consulta `status(token)` y deriva el Cart desde el
  `session_id` remoto. Antes de completar, valida CLP, monto entero positivo,
  `session_id`, `buy_order`, monto actual del Cart y que exista exactamente una
  sesión de pago procesable que corresponda a una Payment Session Webpay con
  ese token. Tokens antiguos o sesiones/proveedores ambiguos fallan cerradas.
- El endpoint de retorno ejecuta `completeCartWorkflow(...).run()` como flujo
  top-level. Su hook `validate` vuelve a comparar el monto/token contra el
  snapshot de Cart que el workflow realmente usará, no solo contra una lectura
  previa al lock/flujo, y exige el proof del retorno si existe una sesión
  Webpay procesable. Así la ruta Store genérica no puede saltarse las
  validaciones de callback. No crea un segundo camino de finalización en el
  storefront ni usa `runAsStep()`. Antes de redirigir, reconsulta y exige Cart
  completado, Payment Session autorizada, Order existente y vínculo
  Order/Payment Collection; una respuesta incompleta falla cerrada.
- El provider consulta el estado remoto antes de `commit`. Si ya está
  `AUTHORIZED` con identidad/monto correctos, recupera el resultado sin volver
  a invocar `commit`. Si está `INITIALIZED`, confirma una sola vez; ante una
  respuesta de commit ambigua o malformada vuelve a consultar el estado remoto.
  Si la consulta no demuestra autorización coincidente, no produce un pago
  capturado.
- El provider acepta éxito solamente con `status=AUTHORIZED`,
  `response_code=0`, monto, buy_order y session_id exactos.
- Webpay Plus normal se informa a Medusa como `captured`.

`refundPayment` consulta el saldo remoto y no solicita un importe superior al
saldo verificable. Solo acepta `REVERSED` o una respuesta `NULLIFIED` con
`response_code=0`. `cancelPayment` usa el saldo remoto para su compensación y
falla si no puede verificarlo.

## Riesgos conocidos cubiertos

- Medusa no siempre valida por sí mismo que el monto autorizado sea idéntico al
  total actual: el retorno Neni compara Payment Session, datos de sesión y total
  actual autoritativo antes de completar.
- La finalización es una ejecución top-level del workflow oficial; no hay un
  workflow custom que anide `completeCartWorkflow.runAsStep()`.
- Medusa 2.22.1 crea el Order antes de los links/cart update, que se ejecutan en
  paralelo; la autorización del pago ocurre después de esos pasos. El workflow
  adquiere un lock por Cart y busca primero el link Order↔Cart para evitar crear
  una segunda Order en una repetición.
- Webpay status es la fuente remota de verdad para reanudar autorización después
  de un timeout. Un estado no concluyente no se traduce a pago fallido ni a pago
  exitoso, y no activa un segundo `commit`.
- La [documentación oficial de Webpay Plus](https://www.transbankdevelopers.cl/documentacion/webpay-plus)
  documenta `TBK_TOKEN` en la anulación del cliente, la consulta de estado
  durante los siete días posteriores a la creación y los campos de saldo/tipo/
  respuesta del refund que usa esta implementación.
- `TBK_TOKEN` de cancelación nunca se envía a `commit`.
- CLP se exige entero positivo.
- Las credenciales productivas nunca se guardan en PaymentSession.data ni en Git.

## Límites / release gates

- La idempotencia de refund de Medusa 2.22.1 usa y reusa una key de refund en
  Medusa, y serializa el control de saldo en la base de datos. El SDK/API de
  Webpay recibe únicamente `refund(token, amount)`; no recibe esa key. Por eso
  la idempotencia Medusa no demuestra deduplicación económica remota en
  Transbank.
- El provider verifica saldo y respuesta antes de declarar éxito, pero no hay
  un ledger durable local que identifique una operación parcial de refund cuya
  respuesta se perdió tras completarse remotamente. Los retries de refunds
  parciales ambiguos requieren conciliación operativa; no deben repetirse a
  ciegas. La key de `context.idempotency_key` que Medusa envía al provider no se
  transmite a `transaction.refund(token, amount)`. El smoke de refund con
  Transbank sigue siendo una validación externa.
- Si una escritura parcial de links Medusa falla, el workflow puede dejar una
  Order/local state incompleta. La ruta retorna error de forma segura, pero no
  repara automáticamente relaciones parciales ni libera/recupera un workflow
  checkpoint o Cart lock perdido. El comando de solo lectura
  `NENI_WEBPAY_CART_ID=cart_... pnpm neni:webpay:diagnose` reporta Cart, sesiones,
  estado remoto, Order y Payment Collection link; no altera registros ni
  reintenta operaciones económicas.
- No se pudo demostrar en esta validación el comportamiento ante fallo de
  persistencia de checkpoint después de un efecto remoto. El estado de pago
  debe reconciliarse consultando Webpay y el Order existente; no ejecutar un
  refund automático ante un fallo de lectura local aislado.
- La prueba sandbox aprobada/rechazada/cancelada, pruebas de refund, recuperación
  de Order parcial y pruebas browser siguen siendo release gates; no se
  ejecutaron como parte de los checks deterministas.

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
- `pnpm neni:test:webpay` incluye ahora selección/validación de retorno,
  recuperación de commit ambiguo y validación de saldo/respuesta de refund.

Comandos principales:
- `pnpm neni:dev:up`
- `pnpm neni:dev:status`
- `NENI_WEBPAY_CART_ID=cart_... pnpm neni:webpay:diagnose`
- `pnpm neni:qa`
- `pnpm neni:qa:browser`
- `pnpm neni:qa:webpay`
