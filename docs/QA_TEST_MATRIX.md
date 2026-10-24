# Neni QA / Test Matrix

La meta de esta suite es evitar volver a depurar el proyecto con comandos
aislados y distinguir fallas de Neni de fallas externas.

## Capas

| Comando | Capa | Crea datos | Red externa | CI |
|---|---|---:|---:|---:|
| `pnpm neni:test:checkout` | validación checkout | no | no | sí |
| `pnpm neni:test:inventory` | BOM/inventario | no | no | sí |
| `pnpm neni:test:webpay` | provider Webpay | no | no | sí |
| `pnpm neni:check` | builds/typecheck | no | no | sí |
| `pnpm neni:verify:payments` | configuración Medusa | lectura | no | sí, después del bootstrap |
| `NENI_WEBPAY_CART_ID=cart_... pnpm neni:webpay:diagnose` | conciliación Webpay/Order | lectura | Transbank status | operador |
| `pnpm neni:e2e:order` | Cart→Order real | sí | no | local/smoke |
| `pnpm neni:e2e:browser` | navegador real | sí | no | local |
| `pnpm neni:e2e:webpay` | Webpay integración | sí | **sí** | **no** |
| `pnpm neni:qa` | QA determinista local | sí | no | local |
| `pnpm neni:qa:browser` | QA + browser | sí | no | local |
| `pnpm neni:qa:webpay` | QA + Transbank | sí | sí | manual/release |

## Por qué Webpay sandbox no corre en CI

El sandbox de Transbank es una dependencia externa. Un cambio visual, captcha,
mantenimiento o latencia puede romper un E2E sin que el código de Neni tenga
una regresión. CI debe ser determinista.

La prueba externa se usa como **release gate**, no como unit test.

## Flujo de desarrollo recomendado

```text
pnpm neni:dev:up
pnpm neni:dev:status

# ciclo corto
pnpm neni:test:webpay

# antes de push
pnpm neni:qa

# cuando cambia UI/checkout
pnpm neni:qa:browser

# antes de considerar Webpay listo para merge/release
pnpm neni:qa:webpay
```

## Evidencia

Los E2E guardan evidencia temporal bajo `/tmp` para no contaminar Git:

- `/tmp/neni-webpay-*.png`
- `/tmp/neni-webpay-*.log`
- `/tmp/neni-webpay-*.json`

El diagnóstico Webpay es de solo lectura. Redacta el token como un prefijo
SHA-256, consulta el estado remoto y compara las relaciones Order/Cart y
Order/Payment Collection; nunca ejecuta commit, refund ni reparación.

## Estado esperado antes del merge de Webpay v1

- catálogo 11/11;
- checkout unitario verde;
- Inventory/BOM verde;
- backend/storefront build verdes;
- `pp_system_default` crea Order;
- `pp_webpay_webpay` crea `token_ws`;
- sandbox aprobado crea Order;
- cancelación/rechazo no crea una Order pagada;
- refund probado;
- ningún secreto versionado.

## Webpay state-machine runner

El runner Webpay no asume una única pantalla. Detecta dinámicamente:
1. selector "Tarjetas Crédito, Débito, Prepago";
2. control `card-number` (input, botón o componente);
3. pantallas intermedias;
4. CVV/vencimiento;
5. autenticación bancaria;
6. aprobación/rechazo;
7. retorno a Neni.

Comandos:
- `pnpm neni:e2e:webpay:inspect`
- `pnpm neni:e2e:webpay`
- `pnpm neni:e2e:webpay:rejected`
- `pnpm neni:e2e:webpay:cancel`

La prueba externa sigue fuera de CI.
