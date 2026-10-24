# Neni Frontend v3 — Sistema visual B3 y criterios de aceptación

**Revisión:** 2026-10-24. **Rama Git:** `v3`. **Base:** `v2`. **Estado:** implementación iterativa; requiere QA en navegadores reales.  
Este documento es la fuente de verdad de **estética/UX** y no una descripción del negocio ni del modelo de comercio.

## Norte creativo
Un taller de flores de autor, íntimo y artesanal: acuarela, papel marfil, tonos vino/grafito/verde profundo, fotografías auténticas, composición editorial con respiro. Cada interacción debe sentirse natural; nada debe recordar a una plantilla genérica o a una interfaz de juego.

### Identidad
- **Logo oficial:** el logotipo proporcionado por la marca muestra **Neni en verde pintado** y **taller de flores en rosa coral**, rematado con ranúnculo. Se debe usar el archivo **con transparencia real** en cabecera; no el logotipo antiguo circular como identificador principal. El master original se recibió en la revisión B3. La copia web transparente y recortada **sí está versionada** en `public/images/Logos/Neni_oficial_acuarela.webp` (240×151px, WebP de 13.8 KB). Conservar el PNG maestro de 1536×1024 fuera de Git como fuente de identidad; esta copia web es una optimización para el header, no un reemplazo del original de impresión.
- El logo se mantiene reconocible y legible en teléfono; no debe crecer hasta competir con el catálogo ni quedar reducido a una miniatura irreconocible.
- Encabezados Cormorant Garamond, cuerpo DM Sans, con fallbacks; no alterar importes o precios desde CSS.

### Fotografía de producto — **regla no negociable**
- **PROHIBIDO** recortar el ramo en círculos. Las fotografías son **rectangulares verticales** con esquinas moderadamente redondeadas/asimétricas (superior derecha e inferior izquierda).
- Foto principal sin máscaras circulares, `object-fit: cover` y punto focal visible.
- **Doble marco desplazado** ligeramente hacia abajo y derecha, como el bloque «Nuestro taller». Sombra tenue y nunca un marco verde saturado universal.
- Evitar reglas globales `.product-card button` que terminen afectando el radio, padding o tamaño del botón-fotografía.
- Mantener etiquetas visibles y legibles, fuera de zonas de poca legibilidad; títulos/composición/precio real de Medusa.

### Armonía cromática por ramo — motor visual
- Cada imagen local de Medusa se **muestrea con Canvas2D** (72×72 como máximo) sin servicio externo; agrupar píxeles por sectores de tono (24 grupos de 15°).
- Excluir píxeles casi grises, blancos/negros extremos y transparentes. Ponderar saturación, centralidad y tonos florales cálidos para no dominar con fondo celeste de estudio o follaje verde.
- Aplicar **lavado suave** extraído al cuerpo de la tarjeta (`--flower-wash`), **marco** (`--flower-frame`) y acento de texto (`--flower-ink`). La fotografía conserva sus colores reales; jamás usar tintes fuertes detrás de precios.
- Cache por URL, procesar una sola vez por imagen al cargar, fallback marfil si Canvas o CORS fallan. **Es heurística de color; no detector semántico/segmentador de flores.**
- La vista rápida reusa exactamente la paleta de su tarjeta. El nombre, la composición y el precio deben seguir siendo contrastados.

### Composición botánica y movimiento
- Ilustración `atelier-bloom.svg`: **tallo corto, exactamente una hoja a izquierda y otra a derecha**, sin tercera rama.
- Hojas/pétalos con color lavado y densidad baja. Viento en **hero, catálogo y vista rápida**; en touch y mouse. El contenido y los botones siempre quedan por encima del viento.
- Presupuesto contenido: en móvil 5 hojas hero, 7 catálogo, 3 modal (máximo de las escenas visibles); en escritorio 14/18/7. `requestAnimationFrame` y `IntersectionObserver` con pausa en pestaña oculta, modal cerrado y `prefers-reduced-motion`; escena secundaria limitada a ~30 FPS.
- Ornamentos estáticos discretos en espacios vacíos; nunca obstaculizar fotografía, lectura o controles.

### Modal de producto
- Base marfil con tintes del ramo, esquinas asimétricas, marco fotográfico desplazado a derecha/abajo, la **misma flor de dos hojas en esquina inferior derecha** y viento muy suave de fondo.
- Galería: mostrar segunda fotografía únicamente si Medusa entrega `image_2`. El cierre, botón de agregar y miniaturas llevan microinteracciones elegantes; foco de teclado visible; `Escape` y backdrop para cerrar; el modal utiliza `<dialog>`.
- No alterar las mutaciones del carrito ni falsificar los importes. Reutilizar `CartContext`.

### Móvil y accesibilidad
- Pantallas objetivo 360/390/768/1440/1920px; ninguna barra horizontal, CTA tap-target >=44px, sin hover obligatorio.
- El movimiento por dedo se gestiona con Pointer Events pasivos y una capa visual `pointer-events:none`; jamás interceptar scroll/clics.
- Respeto de movimiento reducido, buen contraste, imágenes con alt descriptivo y adornos decorativos con alt vacío.

## Pruebas de aceptación (pendientes de verificación visual)
1. El logotipo oficial `Neni_oficial_acuarela.webp` está en la cabecera y sin bloque blanco detrás, con verde/coral.
2. Las 11 fotos del catálogo se ven **rectangulares** en móvil y escritorio. Revisar particularmente Mirasol, Tríada Amarilla, Mix del Día y Romántico de 12.
3. El fondo/marco de cada tarjeta difiere si cambia el ramo: rojizos/rosas/amarillos y una mezcla floral. Un fondo azul de estudio no debe necesariamente ganar el cálculo.
4. La sección catálogo **sí muestra hojas tenues** en el background. Tocar o arrastrar el dedo afecta el viento sin bloquear scroll.
5. Modal: foto con marco doble, ornamento inferior derecho, fondo cromático asociado, botón agregar y X animados. Volver/adelante y cerrar con Esc.
6. Carrito Medusa real agrega/actualiza/elimina; 11 productos CLP, retiro/despacho sin ruptura. Webpay fuera de alcance.
7. Reducir movimiento en el SO elimina la animación y mantiene todo usable.
8. Inspeccionar Lighthouse, LCP, CLS y CPU móvil antes de dar el PR por aprobado.

## Cambios de implementación B3
- `src/lib/floralPalette.ts`: algoritmo de paleta floral dependiente de fotografía.
- `src/components/ProductGrid.tsx`: marco doble, paleta por producto, vista rápida enriquecida.
- `src/styles/v3-refinements.css`: parche acotado para evitar colisión de CSS con radios circulares y añadir capas cromáticas.
- `public/js/floral-scenes.js`: escenas animadas en catálogo/modal con gestos táctiles.
- `public/js/botanical-wind.js`: el viento hero también atiende Pointer Events táctiles.
- `public/images/botanical/atelier-bloom.svg`: simetría de dos hojas.

## Gobierno de cambios
La rama **se llama `v3`**, mientras **B3 es el nombre de esta iteración de diseño**, no una rama nueva. No integrar en `v2` ni `main` antes de CI, revisión móvil real, accesibilidad y autorización. Evitar mezclar la rama Webpay.
