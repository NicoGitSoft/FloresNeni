# Neni — Especificación de Producción, Inventario y Disponibilidad

**Estado:** borrador funcional v0.1  
**Fecha:** 2026-10-15  
**Objetivo:** documentar de forma persistente la lógica operativa de Neni para que el ecommerce no prometa pedidos que no puedan producirse a tiempo, y para que Denise pueda administrar inventario, recetas, merma, capacidad y compras desde el backend.

---

## 1. Principio general

Neni no debe tratar la disponibilidad de un ramo como un simple “hay/no hay stock”.

La disponibilidad real depende de cuatro factores:

1. **Inventario físico:** flores y materiales disponibles.
2. **Receta del producto:** qué materiales consume cada ramo y en qué cantidad.
3. **Capacidad humana:** cuántos minutos de trabajo requiere cada ramo y cuántos minutos productivos existen en cada día.
4. **Calendario y promesa de entrega:** cuál es la primera fecha realista en que el pedido puede quedar listo.

La regla general será:

> **Fecha disponible = primera fecha futura en la que exista simultáneamente capacidad de materiales, capacidad humana y una ventana de producción válida.**

La tienda debe intentar preservar la venta: si mañana ya no cabe el pedido, no debería decir simplemente “agotado”; debe calcular y ofrecer la **primera fecha disponible posterior**.

---

## 2. Reglas comerciales confirmadas por Denise

### 2.1. Límite inicial por producto y por día

- El límite **NO es por cliente**.
- El límite inicial es **global por producto y por fecha**.
- Se fija inicialmente en **máximo 3 unidades del mismo producto por día**.
- Debe ser **configurable desde administración**.
- Un cliente puede comprar distintos productos en un mismo pedido, siempre que cada producto respete sus límites y la capacidad total del día.

Ejemplo:

- Ramo de Octubre para 18/10: máximo comercial = 3.
- Si ya hay 2 reservados para 18/10, sólo queda 1 cupo de ese producto para esa fecha.
- Si la capacidad real por stock o por tiempo fuese menor que 3, manda el valor menor.

Fórmula:

```text
unidades_disponibles_producto_fecha =
mínimo(
  límite_comercial_producto_fecha,
  capacidad_por_materiales,
  capacidad_por_tiempo
)
```

### 2.2. Pedido para el mismo día

Regla base:

- Los pedidos para el **mismo día** se aceptan normalmente hasta las **14:00**.
- Para pedidos del mismo día **NO se debe asumir compra de flores faltantes**.
- Sólo se puede vender lo que sea fabricable con el **stock físico disponible en ese momento**.

Existe además una lógica deseada de extensión:

- Si durante el día no han entrado pedidos y existe stock suficiente, se quiere tener la posibilidad de extender la ventana del mismo día hasta las **18:00**.
- Esta extensión debe poder configurarse y/o ser habilitada por Denise.

### Propuesta de implementación

```text
same_day_cutoff_normal = 14:00
same_day_cutoff_extended = 18:00
allow_extended_same_day = true/false
```

Condición sugerida para extensión automática:

```text
pedidos_confirmados_del_día == 0
AND
stock_físico_suficiente == true
AND
capacidad_humana_suficiente == true
```

Debe existir además un **override manual** para Denise.

> Esta condición automática debe validarse nuevamente con Denise antes de dejarla definitiva.

### 2.3. Pedidos con anticipación

Cuando un cliente pide para un día futuro:

- El sistema puede considerar que Denise podrá **comprar las flores faltantes** antes de producir el pedido.
- Un pedido anticipado tiene prioridad porque permite planificar abastecimiento.
- Por ejemplo: si hoy no existe stock para un Ramo de Octubre pero el cliente lo pide para mañana, el sistema puede aceptar el pedido si existe tiempo operativo para comprar y confeccionar.

Para el mismo día, en cambio, el sistema usa sólo stock físico real.

### 2.4. No perder una venta por falta de capacidad mañana

Si mañana ya no tiene capacidad:

- No mostrar simplemente “no disponible”.
- Buscar hacia adelante en el calendario.
- Mostrar la **primera fecha factible**.

Ejemplo:

```text
Mañana: sin capacidad
Pasado mañana: sin capacidad
Sábado: capacidad disponible

→ “Disponible desde sábado”
```

Esto es una forma de **forward scheduling / order promising**.

### 2.5. Capacidad productiva diaria actual

Denise definió:

- Si ya existe todo el stock necesario: **3 horas productivas al día**.
- Si es necesario salir a comprar flores/materiales: **1,5 horas productivas al día**.

Versión inicial de cálculo:

```text
sin compra necesaria:
180 minutos productivos/día

con compra necesaria:
90 minutos productivos/día
```

A futuro es mejor modelar la compra como un bloque de tiempo separado, en vez de cambiar la jornada completa.

Ejemplo futuro:

```text
capacidad base = 180 min
viaje/compra = -90 min
capacidad restante = 90 min
```

### 2.6. Domingo

Decisión confirmada parcialmente:

- El sitio debe poder seguir **recibiendo pedidos el domingo**.
- El domingo no se considera un día normal de producción.
- Los compromisos de producción/consulta deben desplazarse al siguiente día hábil según la configuración.
- El cliente debe recibir un mensaje claro cuando la fecha seleccionada cae en un día no operativo.

**Pendiente de confirmar:** tratamiento exacto del sábado y qué texto desea Denise para fines de semana/no hábiles.

---

## 3. Recetas de cada ramo

Cada producto debe tener una receta editable por Denise.

Una receta contiene:

```text
Producto
├── ingrediente/material A × cantidad
├── ingrediente/material B × cantidad
├── ingrediente/material C × cantidad
├── papel × cantidad
├── otros insumos × cantidad
└── minutos de confección por unidad
```

### Ejemplo: Ramo de Octubre

Velocidad informada:

```text
4 ramos por hora
= 15 minutos por ramo
```

Ingredientes dictados verbalmente:

- 3 “remedios” — **nombre exacto por confirmar**
- 2 clavellinas
- 2 mini claveles
- 2 “malvices” — **nombre exacto por confirmar**
- 3 rosas
- “500 papeles” — **cantidad/unidad por confirmar**

No se deben corregir ni inventar esos nombres hasta que Denise confirme la receta real.

---

## 4. Inventario de flores y materiales

Denise debe poder administrar desde el backend:

- tipo de flor/material
- variante o color, cuando corresponda
- SKU interno
- cantidad física
- cantidad reservada
- cantidad útil estimada
- unidad de compra
- costo
- fecha de ingreso
- proveedor, opcional
- vencimiento/estado, opcional
- merma real
- ubicación, si más adelante existen varias

Ejemplos:

```text
ROSA-ROJA
MINI-CLAVEL-FUCSIA
EUCALIPTO
PAPEL-VINO
CINTA-NENI
```

---

## 5. Merma

La cantidad comprada no equivale necesariamente a la cantidad realmente utilizable.

Ejemplo dado por Denise:

```text
paquete de rosas = 25 unidades
merma esperada = 5
cantidad útil estimada = 20
```

En ese ejemplo la merma esperada es 20%, pero **no debe hardcodearse como regla global**.

Cada material debería poder tener:

```text
cantidad_comprada
merma_estimada
rendimiento_esperado
cantidad_útil
```

Además debe existir un **registro de merma real**:

```text
fecha
material
cantidad
motivo
costo estimado
nota
```

Motivos posibles:

- podrido
- quebrado
- marchito
- mala calidad de origen
- daño en manipulación
- sobrante no reutilizable
- otro

Esto permitirá después obtener reportes de cantidad y costo perdido por material y período.

---

## 6. Sustituciones y fotografía de referencia

La fotografía del producto es una **referencia del diseño**, no una promesa absoluta de que cada flor será idéntica.

Debe quedar claro en la descripción del producto que:

- se mantiene la intención, paleta, volumen y estilo del diseño;
- algunas flores, follajes o texturas pueden variar según disponibilidad y temporada;
- las sustituciones deben respetar el criterio floral de Neni.

La receta debe soportar dos tipos de componentes:

### Componentes obligatorios

No pueden sustituirse sin cambiar el producto.

### Componentes flexibles

Pueden pertenecer a un grupo de sustitución.

Ejemplo conceptual:

```text
Follaje fresco × 3
puede satisfacerse con:
- eucalipto
- ruscus
- tuya
```

La política de sustitución se configura por receta.

---

## 7. Capacidad humana

Cada producto tendrá un tiempo estándar de confección.

Ejemplo:

```text
Ramo de Octubre = 15 min/unidad
```

Si existe una jornada de 180 minutos:

```text
180 / 15 = 12 unidades teóricas
```

Pero la capacidad real será el mínimo entre:

- tiempo humano disponible
- materiales disponibles
- límite comercial diario
- reservas/pedidos existentes

Cuando existan varios tipos de ramos, todos compiten por el mismo pool de minutos.

Ejemplo:

```text
2 Ramo Octubre × 15 = 30 min
1 Bouquet complejo × 45 = 45 min
3 Bouquet medio × 25 = 75 min

Total consumido = 150 min
```

Si el día tiene 180 min:

```text
capacidad restante = 30 min
```

---

## 8. Futuro: múltiples floristas

La capacidad no debe estar hardcodeada como “Denise = 3 horas”.

Modelo futuro:

```text
Recurso: Denise
fecha: 18/10
minutos disponibles: 180

Recurso: Florista 2
fecha: 18/10
minutos disponibles: 300
```

Capacidad total:

```text
suma de minutos efectivos de los trabajadores habilitados
```

Eso permite escalar sin reescribir el sistema.

---

## 9. Lógica de disponibilidad

Entrada:

```text
product_id
quantity
requested_date opcional
current_datetime
```

El motor debe evaluar fechas en orden hasta encontrar una factible.

### Pseudológica

```text
para cada fecha candidata desde hoy hacia adelante:

  si fecha es no productiva:
      continuar a siguiente fecha

  comprobar límite comercial por producto/fecha

  si fecha == hoy:
      usar sólo inventario físico útil disponible
      aplicar cutoff mismo día
      no considerar compras futuras

  si fecha > hoy:
      considerar stock existente
      considerar compras planificables
      generar faltantes de compra

  calcular minutos de producción necesarios

  calcular minutos ya reservados/comprometidos

  calcular capacidad humana restante

  si:
      límite comercial suficiente
      AND materiales factibles
      AND minutos suficientes

      devolver esta fecha como primera fecha disponible
```

---

## 10. Dos niveles de stock

Conviene distinguir:

### Stock físico

Lo que Denise realmente tiene hoy en el taller.

### Stock planificable

Lo que puede conseguir antes de una fecha futura.

Para pedidos del mismo día:

```text
usar únicamente stock físico
```

Para pedidos futuros:

```text
stock físico
+
abastecimiento planificable
```

Esto evita prometer un pedido urgente basándose en flores que todavía no existen en el taller.

---

## 11. Lista de compras automática

Confirmado por Denise: **sí se quiere**.

A partir de los pedidos confirmados, el sistema debe calcular:

```text
necesidad_total_material
-
stock_útil_disponible
-
compras_ya_planificadas
=
cantidad_a_comprar
```

Vista ejemplo:

```text
COMPRAS PARA MAÑANA

Rosas rojas       18
Mini clavel        8
Eucalipto         12
Papel vino         4
```

Idealmente debe poder agrupar:

- por fecha de producción
- por flor/material
- por proveedor
- por pedido

---

## 12. Vista administrativa de Denise

Debe existir una sección propia en Medusa Admin.

Propuesta de navegación:

```text
Neni Producción
├── Hoy
├── Calendario
├── Inventario
├── Recetas
├── Compras
├── Merma
├── Capacidad
└── Configuración
```

### Dashboard diario

Ejemplo:

```text
VIERNES 16

Pedidos confirmados        7
Ramos totales             11
Minutos requeridos       145
Capacidad disponible     180
Capacidad restante        35

FALTANTES
Rosa roja                 12
Eucalipto                  5

COMPRAS
14 rosas rojas
6 eucaliptos
```

---

## 13. Experiencia del cliente

El cliente no debería ver la complejidad interna.

Ejemplos de mensajes:

```text
Disponible hoy
Pedido antes de las 14:00
```

```text
Disponible desde mañana
```

```text
Los cupos de mañana ya están completos.
Primera disponibilidad: sábado 18.
```

No usar mensajes internos como “no hay capacidad humana”. La comunicación debe mantener el tono Neni.

---

## 14. Patrón reconocido en ecommerce / manufactura

Esta problemática ya existe en sistemas comerciales y de manufactura.

### ATP — Available to Promise

Determina qué puede prometerse considerando suministro/inventario disponible.

### CTP — Capable to Promise

Extiende la promesa considerando la **capacidad de producir** algo que todavía no está disponible.

### Lead time

Tiempo mínimo de preparación/producción.

### Cut-off time

Hora límite después de la cual un pedido pasa a la siguiente ventana o fecha.

### Forward scheduling

Si una fecha no es factible, buscar hacia adelante hasta encontrar la primera fecha viable.

La lógica de Neni combina:

```text
ATP
(stock)
+
CTP
(capacidad humana)
+
lead time
+
cutoff
+
recetas/BOM
+
calendario
=
fecha prometida al cliente
```

---

## 15. Cómo se implementa en nuestra arquitectura

### PostgreSQL

Fuente de verdad para inventario, recetas, merma, configuración, calendario, reservas, capacidad y pedidos.

### Medusa

Debe contener la lógica autoritativa.

La pregunta:

```text
“¿Puedo vender 2 Ramo de Octubre para esta fecha?”
```

se decide en Medusa, nunca en el navegador.

### Astro

Responsable de SEO, estructura pública, contenido, identidad visual y páginas editoriales.

### React

Responsable de selector de cantidad, selector de fecha, carrito, mensajes de disponibilidad y actualización de cupos.

React consulta; no decide las reglas.

---

## 16. Uso del inventario nativo de Medusa

No conviene recrear desde cero todo el inventario.

Medusa Inventory soporta:

- inventory items
- niveles por ubicación
- disponibilidad
- reservas
- múltiples inventory items asociados a una variante

Los **Inventory Kits** permiten que una variante consuma varios inventory items con una `required_quantity`.

Esto encaja directamente con una receta floral simple:

```text
Ramo X
├── 3 rosas
├── 2 mini claveles
└── 1 papel
```

Cada componente puede existir como Inventory Item y Medusa puede reservar/deducir cantidades.

Sin embargo, Neni necesita reglas adicionales que Inventory por sí solo no cubre:

- tiempo humano
- calendario
- cutoffs
- abastecimiento futuro
- merma
- sustituciones
- lista de compras
- forward scheduling

Esas reglas irán en un módulo propio.

---

## 17. Módulo propio recomendado

Ruta propuesta:

```text
apps/backend/src/modules/production/
```

Nombre conceptual:

```text
Neni Production Module
```

Modelos iniciales propuestos:

### `ProductionSettings`

- same_day_cutoff_normal
- same_day_cutoff_extended
- extended_same_day_enabled
- default_daily_minutes
- procurement_daily_minutes
- timezone
- horizon_days
- default_product_daily_cap

### `ProductProductionProfile`

- product_id / variant_id
- production_minutes
- daily_cap
- active
- complexity_label opcional

### `ProductionCalendar`

- date
- working
- available_minutes
- note

### `ProductionReservation`

- cart_id/order_id
- variant_id
- production_date
- quantity
- minutes_reserved
- status
- expires_at

### `WasteLog`

- inventory_item_id
- date
- quantity
- reason
- estimated_cost
- notes

### `ProcurementPlan`

- production_date
- inventory_item_id
- required_quantity
- available_quantity
- missing_quantity
- status

Las recetas físicas se deberían apoyar en Medusa Inventory Kits siempre que la receta sea compatible con required quantities.

---

## 18. Reserva durante checkout

Problema:

```text
queda capacidad para 1 ramo

Cliente A entra al checkout
Cliente B entra al checkout
```

Los dos podrían ver disponibilidad simultáneamente.

Por eso se necesita una reserva temporal de:

- materiales
- minutos de producción
- cupo diario del producto

Flujo:

```text
cliente inicia checkout
↓
revalidar disponibilidad
↓
crear reserva temporal
↓
Webpay
↓
si paga:
    convertir reserva en compromiso confirmado

si abandona / vence:
    liberar reserva
```

La operación debe ser idempotente y protegida contra concurrencia.

---

## 19. Orden recomendado de desarrollo

### Fase 0 — actual

- catálogo Medusa: hecho
- API Store: hecho
- Chile/CLP: hecho
- Astro + React: hecho
- conexión storefront/Medusa: en curso

### Fase 1 — catálogo visual

- mostrar 11 productos
- ficha de producto
- selector de cantidad
- carrito básico

### Fase 2 — inventario real

- activar `manage_inventory`
- crear inventory items de materias primas
- crear stock location “Taller Neni”
- cargar stock
- vincular recetas compatibles como Inventory Kits

### Fase 3 — Production Module

- configuración
- tiempos por producto
- límite diario
- calendario
- motor de disponibilidad
- primera fecha factible

### Fase 4 — Admin Neni

- inventario
- recetas
- calendario/capacidad
- merma
- lista de compras
- dashboard diario

### Fase 5 — checkout

- fecha prometida
- reserva temporal
- revalidación
- bloqueo de concurrencia
- expiración de reservas

### Fase 6 — Webpay

Sólo integrar pago cuando el sistema pueda garantizar:

```text
precio
+
inventario
+
capacidad
+
fecha prometida
```

---

## 20. Decisiones que NO deben hardcodearse

Todas estas variables deben ser administrables:

- máximo diario por producto
- minutos de confección
- horas/minutos productivos del día
- días hábiles
- excepciones/feriados
- cutoff mismo día
- cutoff extendido
- disponibilidad de extensión
- merma esperada
- sustituciones
- stock
- tiempo de compra
- capacidad por trabajador
- productos habilitados

---

## 21. Pendientes de confirmar con Denise

1. ¿El sábado es un día productivo normal, reducido o no hábil?
2. ¿La extensión de 14:00 a 18:00 debe ser automática cuando no haya pedidos, o Denise debe activarla manualmente?
3. Confirmar nombres y cantidades exactas de la receta del Ramo de Octubre.
4. Definir si el límite inicial de 3 por producto/día debe poder variar individualmente por producto desde el primer MVP.
5. Definir horizonte máximo para calcular fechas futuras, por ejemplo 14, 30 o 60 días.
6. Definir cómo se trata un material sustituible: equivalencia 1:1 o cantidades diferentes por sustituto.
7. Definir si el tiempo de compra de 90 minutos se aplica una sola vez al día aunque falten varios tipos de flores.

---

## 22. Regla de negocio resumida

La tienda Neni no vende únicamente inventario.

Vende una **promesa realista de confección y entrega**.

El motor debe responder:

```text
¿Qué materiales necesito?
¿Qué tengo?
¿Qué puedo comprar antes de esa fecha?
¿Cuánto tiempo requiere?
¿Cuánto trabajo ya está comprometido?
¿Cuál es el límite comercial?
¿Cuál es la primera fecha en que todo eso cabe?
```

La respuesta a esas preguntas determina la disponibilidad que ve el cliente.

---

## 23. Fuentes conceptuales consultadas

- Medusa — Inventory Module  
  https://docs.medusajs.com/resources/commerce-modules/inventory
- Medusa — Inventory Kits  
  https://docs.medusajs.com/resources/commerce-modules/inventory/inventory-kit
- Medusa — Reservations Lifecycle  
  https://docs.medusajs.com/resources/commerce-modules/inventory/reservations-lifecycle
- Medusa — Admin Widgets  
  https://docs.medusajs.com/learn/fundamentals/admin/widgets
- Oracle — Global Order Promising / ATP / CTP  
  https://docs.oracle.com/en/cloud/saas/supply-chain-and-manufacturing/
- WooCommerce — Order Delivery / lead time / cut-off / picking days  
  https://woocommerce.com/document/woocommerce-order-delivery/

---

## 24. Control de cambios

### v0.1 — 2026-10-15

Primera especificación basada en conversación con Denise y Nico.

Incluye:

- límite inicial por producto/día
- same-day cutoff
- extensión hasta 18:00
- reglas de stock físico vs futuro
- forward scheduling
- capacidad humana
- domingo
- recetas
- merma
- sustituciones
- lista de compras
- administración
- arquitectura técnica
- plan de implementación
