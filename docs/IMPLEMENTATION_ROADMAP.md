# Neni — Implementation Roadmap

**Branch:** v2  
**Arquitectura:** Astro + React + Medusa + PostgreSQL + Redis  
**Documento funcional:** `docs/NENI_PRODUCTION_LOGIC.md`

---

## Developer Platform v1

- [x] Codespaces fija Node 22.22.0 y conserva pnpm 10.34.6.
- [x] `pnpm neni:setup` aplica migraciones Medusa y luego ejecuta el bootstrap Neni.
- [x] `pnpm neni:bootstrap` provisiona solo recursos/catálogo Neni validados; no crea fixtures ni stock DEMO.
- [x] `pnpm neni:bootstrap:inventory-demo` crea separadamente los fixtures técnicos de Inventory/BOM para desarrollo o CI efímero.
- [x] La Publishable API Key queda vinculada a `Neni Web` y se escribe en el `.env` ignorado del storefront.
- [x] Scripts raíz usan los package names actuales.
- [x] Workflow CI configura pnpm 10.34.6 antes de Node 22.22.0 y ejecuta las validaciones.
- [x] GitHub Actions completó exitosamente el workflow CI anterior del PR #2.
- [x] Se identificó y corrigió la causa raíz del error `Search index "product" has no active version yet` en DB nueva.
- [x] El bootstrap ahora valida el estado del índice antes de crear productos y usa Medusa’s official search reindex flow cuando es necesario.
- [x] `.devcontainer/devcontainer-lock.json` se versiona para fijar versiones, digests e integridad de las Features de Dev Containers.
- [x] Smoke test de bootstrap limpio con PostgreSQL/Redis efímeros, dos ejecuciones y conteos exactos está implementado en CI.
- [x] GitHub Actions ejecutó exitosamente el workflow CI actualizado con el smoke de bootstrap limpio.
- [ ] Rebuild del Codespace para activar/verificar Node 22.22.0.
- [ ] Una DB ya inicializada con el seed demo conserva esos datos; no se borra ni migra automáticamente.

Para un entorno nuevo: `pnpm neni:setup`, luego `pnpm neni:dev`. El catálogo real se repite con `pnpm neni:bootstrap`; los datos sintéticos se crean solo con `pnpm neni:bootstrap:inventory-demo`.

---

## Estado actual

- [x] PostgreSQL
- [x] Redis desarrollo
- [x] Medusa 2.21.2
- [x] Región Chile / CLP
- [x] Sales Channel Neni Web
- [x] Publishable API Key
- [x] Catálogo de 11 productos
- [x] Precios desde Medusa
- [x] Metadata y composición
- [x] Fotografías locales
- [x] Astro
- [x] React
- [x] Store API conectada
- [x] ProductGrid dinámico
- [x] Especificación de producción
- [x] Carrito real
- [x] Checkout Base sin pagos: datos de contacto y retiro/despacho guardados en Cart vía Medusa.
- [x] `requested_date` persistida como fecha solicitada, sin promesa de disponibilidad.
- [x] Inventory Items y niveles nativos de Medusa para cuatro materiales sintéticos DEMO, marcados como no comerciales.
- [x] BOM/Inventory Kit persistente en una variante fixture `DRAFT` no vendible; productos comerciales siguen sin recetas inventadas.
- [x] `material_buildable_quantity` puro y API Store de inspección de componentes.
- [ ] Materias primas, stock y recetas reales confirmadas por Denise.
- [ ] Production Module
- [ ] Availability Engine
- [ ] `promised_date`, reservas y concurrencia
- [ ] Admin Denise
- [ ] Webpay
- [ ] Producción

---

## Fase 1 — Storefront y carrito

- Cart Medusa real
- Persistencia con cart ID
- Agregar variante
- Cambiar cantidades
- Eliminar producto
- Contador
- Subtotal
- Recuperar carrito después de recargar
- Página/ficha de producto

---

## Fase 2 — Checkout base

Sin pagos todavía.

- [x] Nombre y apellido
- [x] Email nativo del Cart y teléfono
- [x] Dirección Medusa requerida para despacho; retiro no inventa una dirección.
- [x] Intención de retiro/despacho en metadata del Cart.
- [x] `requested_date` persistida como solicitud, con validación de fecha civil en Chile.
- [x] Validación server-side de Cart, contacto, método y dirección.
- [x] Página `/checkout` con resumen Medusa, recuperación desde Cart y sin completar la orden.
- [ ] Availability Engine y `promised_date` autoritativa.
- [ ] Reservas/concurrencia y Webpay.

---

## Fase 3 — Inventario

Reutilizar la ubicación existente, sin crear otra:

`Taller Neni`

- [x] Usar Inventory Module de Medusa para Inventory Items y Inventory Levels.
- [x] Crear fixture DEMO de flor/follaje/papel/cinta con SKUs estables, unidad nativa y categoría en `InventoryItem.material`, mediante comando explícito.
- [x] Inicializar niveles sintéticos DEMO en Taller Neni; `pnpm neni:bootstrap` no los crea ni modifica.
- [ ] Cargar materias primas y stock reales de Denise.
- [ ] Activar inventario en variantes comerciales al confirmar sus recetas.
- [ ] Costos unitarios, proveedor, lote y precio histórico; mantenerlos separados de Pricing/precio de venta.

Medusa expone `available_quantity` en sus niveles y `retrieveAvailableQuantity` en Inventory Module. Este slice no crea ni consume reservas.

---

## Fase 4 — Recetas / BOM

- [x] Persistir el BOM DEMO mediante el Inventory Kit nativo de la variante fixture `DRAFT`.
- [x] Guardar `required_quantity` en los links oficiales Variant ↔ Inventory Item; los componentes actuales son requeridos.
- [x] Calcular `material_buildable_quantity` usando cantidades disponibles autoritativas de Medusa.
- [x] Exponer `GET /store/neni/variants/:id/materials` exclusivamente para el producto/variant DEMO y componentes `demo_only`; sin costos/proveedores ni stock real.
- [ ] Definir recetas productivas de los 11 productos con cantidades confirmadas por Denise.
- [ ] UI Admin para editar BOM sin código.
- [ ] Grupos de sustitución; hoy el BOM es exacto y no modela sustituciones.

El modelo deja cada componente como link individual, lo que permite añadir más adelante grupos de sustitución sin inventar recetas ni ampliar ahora el módulo de producción. Minutos quedan para el Production Module. La futura consulta de receta/stock real debe ser Admin-authenticated o interna de Production/Availability, nunca una Store API pública con cantidades operativas.

---

## Fase 5 — Neni Production Module

Ruta:

`apps/backend/src/modules/production/`

Responsabilidades:

- configuración
- capacidad
- calendario
- tiempos por ramo
- límites diarios
- reservas
- merma
- abastecimiento
- primera fecha disponible

---

## Fase 6 — Availability Engine

Debe responder:

`¿cuándo puedo entregar X unidades de este ramo?`

Considerar:

- stock físico
- stock planificable
- receta
- producción comprometida
- minutos disponibles
- límite diario por producto
- cutoff
- calendario
- pedidos existentes
- reservas temporales

Regla:

`fecha disponible = primera fecha realmente factible`

---

## Fase 7 — Reglas Denise

Configurables desde Admin:

- límite inicial: 3 unidades/producto/día
- cutoff normal: 14:00
- cutoff extendido: 18:00
- capacidad base: 180 min/día
- tiempo de compra estimado: 90 min
- domingos no productivos por defecto
- excepciones de calendario
- minutos por producto
- horizonte de disponibilidad

Nada de esto debe quedar hardcodeado en React.

---

## Fase 8 — Merma

Registrar:

- material
- cantidad
- fecha
- motivo
- costo
- lote/proveedor cuando exista
- observaciones

Reportes:

- merma por flor
- merma por proveedor
- costo de merma
- evolución temporal

---

## Fase 9 — Compras automáticas

Calcular:

`necesidad de pedidos - stock útil - compras planificadas`

Generar:

- lista de compra por fecha
- cantidades
- proveedor
- estado pendiente/comprado/recibido

---

## Fase 10 — Admin Denise

Sección:

`Neni Producción`

Pantallas:

- Hoy
- Calendario
- Inventario
- Recetas
- Capacidad
- Compras
- Merma
- Configuración

Dashboard:

- pedidos
- ramos
- minutos comprometidos
- minutos restantes
- faltantes
- compras necesarias

---

## Fase 11 — Reservas y concurrencia

Antes de pago:

1. revalidar disponibilidad
2. reservar materiales
3. reservar minutos
4. reservar cupo diario
5. establecer expiración

Si expira:

- liberar inventario
- liberar capacidad
- liberar cupo

Redis/locking evitará overselling concurrente.

---

## Fase 12 — Fulfillment

- retiro
- despacho
- zonas
- tarifas
- horario
- fecha prometida
- estados de preparación y entrega

---

## Fase 13 — Webpay

Implementar Payment Provider Medusa.

Flujo:

Cart
→ validar
→ reservar producción
→ Payment Collection
→ Webpay
→ redirect
→ commit servidor
→ verificar monto/estado/token
→ Order

Debe ser idempotente.

---

## Fase 14 — Cancelaciones y refunds

Cancelar debe reconciliar:

- pedido
- inventario
- producción
- cupo
- compras
- Webpay

---

## Fase 15 — Notificaciones

- pedido recibido
- pago aprobado
- en preparación
- listo
- despachado
- entregado
- cancelado
- reembolsado

---

## Fase 16 — Documentación tributaria

Definir modelo SII:

- boleta electrónica
- tratamiento de pago electrónico
- DTE
- integración correspondiente

---

## Fase 17 — Media

Migrar fotografías desde `public/` hacia almacenamiento administrable:

- S3 o Cloudflare R2
- upload desde Admin
- CDN

---

## Fase 18 — Seguridad / producción

- secrets externos
- Redis Event Bus
- Redis Locking
- Redis Workflow Engine
- almacenamiento S3/R2
- rate limiting
- Cloudflare
- Turnstile
- HTTPS
- backups PostgreSQL
- observabilidad
- logs
- alertas
- auditoría
- dependency scanning

---

## Fase 19 — Funciones comerciales posteriores

- promociones
- cupones
- favoritos
- clientes
- historial de pedidos
- newsletter
- reviews
- back-in-stock
- analytics
- SEO producto
- sitemap
- OpenGraph

---

## Regla de arquitectura

Nunca cobrar un pedido hasta poder garantizar:

`precio + materiales + capacidad + cupo + fecha`

## Payment vertical slice — Webpay v1

Objetivo inmediato: cerrar el happy path e-commerce antes de seguir
sobreconstruyendo Availability.

- [x] Medusa 2.22.1 + Node >=22.22.0 validados en build local.
- [x] Shipping Method dev para despacho/retiro.
- [x] Payment Collection + `pp_system_default` → Order real (smoke local).
- [x] Payment Provider `pp_webpay_webpay` implementado y configurado.
- [x] Webpay Plus integration create → redirect → return → commit implementado.
- [x] Retorno valida Cart, token, proveedor, CLP, monto, buy_order y session_id.
- [x] Commit ambiguo se reconcilia con status remoto antes de aceptar pago.
- [x] Retorno ejecuta un solo flujo top-level de finalización Medusa.
- [ ] Validar Order success en sandbox aprobado y fallo/cancelación sin Order pagada.
- [ ] Refund smoke.
- [ ] Credenciales/HTTPS de producción (posterior).
- [ ] Availability/reservas/locking productivo (posterior).

### Cierre técnico verificado en feature/webpay-checkout-v1

- [x] Frozen install, scripts check, checkout tests, inventory tests, Webpay tests
  y storefront/backend builds pasan localmente.
- [x] Readiness de payments y Cart→Order local (API + browser) pasan.
- [x] Regresión determinista para no recommit cuando status remoto ya está
  `AUTHORIZED`, recuperación tras timeout y sesiones callback viejas/ambiguas.
- [x] Provider valida balance remoto antes de refund y la respuesta de
  `NULLIFIED`/`REVERSED`.
- [x] Comando read-only `neni:webpay:diagnose` reporta estado remoto, token
  redactado, Order y vínculo con Payment Collection sin reintentar operaciones.
- [x] Smoke E2E de Order (API + browser).
- [ ] Sandbox Webpay aprobado/rechazado/cancelado y refund; no verificados en
  este entorno.
- [ ] Ledger/conciliación durable para reintentos de refund parcial ambiguo y
  reparación automática de links/checkpoints/locks Medusa; requisito antes de
  producción. El diagnóstico actual solo informa y no repara.
