# Neni — Implementation Roadmap

**Branch:** v2  
**Arquitectura:** Astro + React + Medusa + PostgreSQL + Redis  
**Documento funcional:** `docs/NENI_PRODUCTION_LOGIC.md`

---

## Developer Platform v1

- [x] Codespaces fija Node 22.22.0 y conserva pnpm 10.34.6.
- [x] `pnpm neni:setup` separa migraciones (`--skip-scripts`) del bootstrap de datos.
- [x] `pnpm neni:bootstrap` provisiona recursos Neni y los 11 productos de forma idempotente.
- [x] La Publishable API Key queda vinculada a `Neni Web` y se escribe en el `.env` ignorado del storefront.
- [x] Scripts raíz usan los package names actuales.
- [x] CI valida instalación frozen-lockfile, versiones, storefront, backend y `neni:check`.
- [ ] Rebuild del Codespace para activar/verificar Node 22.22.0.
- [ ] Una DB ya inicializada con el seed demo conserva esos datos; no se borra ni migra automáticamente.

Para un entorno nuevo: `pnpm neni:setup`, luego `pnpm neni:dev`. Para volver a ejecutar solo los datos: `pnpm neni:bootstrap`.

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
- [ ] Checkout
- [ ] Inventario materias primas
- [ ] Recetas
- [ ] Production Module
- [ ] Availability Engine
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

- datos cliente
- dirección
- retiro / despacho
- email
- teléfono
- fecha solicitada
- validación servidor

---

## Fase 3 — Inventario

Crear Stock Location:

`Taller Neni`

Materias primas:

- flores
- follajes
- papeles
- cintas
- insumos

Activar `manage_inventory`.

Mantener:

- cantidad física
- cantidad reservada
- cantidad útil
- costo
- proveedor
- fecha ingreso

---

## Fase 4 — Recetas / BOM

Cada ramo debe conocer:

- ingredientes
- cantidades
- componentes obligatorios
- componentes sustituibles
- minutos de confección

Usar Medusa Inventory Kits cuando la receta sea fija.

Las sustituciones florales se administrarán en Neni Production.

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

