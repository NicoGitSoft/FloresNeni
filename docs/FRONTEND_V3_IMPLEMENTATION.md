# Neni v3 — Implementación, auditoría y criterios de salida
Actualizado: 2026-10-24 · Rama: `v3` · Base: `v2`

## Resumen de implementación real

| Entrega | Estado | Ubicación |
| --- | --- | --- |
| Hero editorial, imágenes reales, navegación, relatos y cierre | Implementado | `src/pages/index.astro` |
| Estilos de acuarela, papel, glass header y responsive | Implementado | `src/styles/storefront.css` |
| Lámina botánica ilustrada (SVG local) | Implementado | `public/images/botanical/atelier-bloom.svg` |
| Motor de viento Canvas 2D, presupuesto móvil y suspensión | Implementado, falta QA visual real | `public/js/botanical-wind.js` |
| Tarjetas con hover/focus, precio autoritativo Medusa | Implementado | `src/components/ProductGrid.tsx` |
| Quick view modal, galería ligera con hasta dos fotos, sincronización `?producto=handle`, navegación atrás | Implementado, falta QA navegador móvil/teclado | `src/components/ProductGrid.tsx` |
| Carrito modal, portal al header, cantidades, error y CTA | Implementado | `src/components/Storefront.tsx` |
| Checkout con estilo v3, sin viento | Implementado (presentación solamente) | `src/pages/checkout.astro` |
| Root React 18 innecesario retirado y lockfile consistente | Implementado, validar pnpm frozen en CI | `package.json`, `pnpm-lock.yaml` |
| Smoke Node para activos, versiones, viento y checkout | Implementado, validar en CI | `scripts/neni-v3-smoke.test.mjs` |

Todas las piezas de comercio siguen conectadas a `CartContext` y `src/lib/medusa.ts`. No se añadieron precios inventados ni un segundo estado de carrito. El checkout existente conserva el workflow y la validación en el backend.

## Auditoría de versiones

- `@dtc/backend`: Medusa 2.21.2, dependencias React 18 del admin intactas.
- `@neni/storefront`: Astro declarado `^7.3.8`, React/DOM `^19.3.0`, `@astrojs/react ^7.0.1`, GSAP `^3.15.0` (no usado en las interacciones v3).
- Raíz: estaba declarado React/DOM `18.3.1`. **Se eliminó de raíz y de su importer en el lockfile**, porque la propia documentación de Medusa advierte fallos de prerender cuando el root y storefront tienen majors diferentes, aunque sus tipos coincidan. No modificar React 18 en `apps/backend`.
- El lockfile permanece en pnpm 10 (lockfile v9), para instalaciones `--frozen-lockfile`. No se agregaron paquetes runtime.
- Astro 7.4.x (lanzado el 15-oct-2026) establece Node mínimo 22.22.0, que nuestro workspace ya satisface. La actualización de Astro se pospone para un PR específico de upgrade+lockfile+compatibilidad+regresión; evitar confundir actualización de dependencias con mejoras visuales.
- No se mezcló ni copió código Webpay desde `feature/webpay-checkout-v1`. El release gate de pagos sigue siendo independiente.

## Investigación y selección de tecnologías

| Candidato OSS / estándar | Decisión | Motivo |
| --- | --- | --- |
| Canvas 2D + SVG nativo | Adoptado | Identidad botánica original, cero deps nuevas; configurable y desacoplable |
| CSS scroll-driven / View Transition API | Adoptar progresivamente | Mejora básica con degradación segura; no justificar una SPA |
| Native `<dialog>` | Adoptado | Modal y foco de teclado integrados sin paquete extra |
| Motion for React (MIT) | Reservado | Usar al implementar gestos/layout avanzado; no cargarlo solo para opacidad |
| Radix Primitives (MIT) | Reservado | Si QA revela limitación de diálogo nativo, implementar control de focus/overlays |
| Embla Carousel (MIT) v8 | Reservado | Galería táctil para múltiples fotos; v9 sigue RC |
| Lenis / tsParticles / Paper.js / PixiJS / Three.js | No adoptados | No justificados para una home floral ligera; afectan peso/complejidad |
| Rive / Lottie | Reserva de marca | Una sola animación de logo si existe un archivo de autor y un caso comercial |
| GSAP | No expandido | Está en el repo, pero no es licencia OSI open source |

Fuentes de consulta:
- https://astro.build/blog/astro-740/
- https://docs.medusajs.com/cloud/deployments/troubleshooting
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog
- https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations
- https://motion.dev/docs/react-layout-animations
- https://www.radix-ui.com/primitives/docs/components/dialog
- https://www.embla-carousel.com/docs/get-started/react

## Diseño y accesibilidad

Identidad: marfil, vino, grafito y verde profundo. Lavados de blush y terracota en segundo plano; serif editorial `Cormorant Garamond`; sans comercial `DM Sans`; fuentes externas de Google Fonts con fallback local. Foto real sobre flor sintética. Las ilustraciones ornamentales tienen `alt=""` y el Canvas es `aria-hidden`.

El efecto de viento tiene 14 elementos en puntero fino y 5 en móvil; usa rAF y pausa con IntersectionObserver, pestaña oculta y movimiento reducido. No hay estado React por frame. Las rutas de checkout no cargan su script. El objetivo es un viento suave y poco frecuente, no partículas o confeti.

Las transiciones CSS usan `transform` y `opacity`; la ruta de movimiento reducido neutraliza animaciones. Los enlaces no dependen del hover para mostrar información crítica. La vista rápida tiene trigger nativo `button`, modal y cierre Esc; aún se requiere verificar el recorrido completo en Safari/Android/teclado real.

## Pruebas

```bash
git switch v3
git pull --ff-only origin v3
pnpm install --frozen-lockfile
pnpm neni:test:frontend-v3
pnpm neni:check
pnpm neni:dev
```

En GitHub Actions, el gate `v3` debe ejecutar los smoke tests, las pruebas existentes, typecheck Astro y backend build. **No declarar completada la release sin inspeccionar esa ejecución.**

### Revisión manual en navegador, pendiente

1. Desktop 1440/1920, tablet 768, Android 360/390: sin scroll horizontal, texto recortado o imágenes ausentes.
2. Contraste en fondos de acuarela y header transparente; navegación con Tab y lector de pantalla.
3. Activar reduced motion del SO: Canvas inmóvil, sin scroll-reveal obligatorio, cart usable.
4. Navegar vista rápida, URL `?producto=handle`, historial atrás, Escape y foco restaurado.
5. Carrito real: crear, agregar, actualizar, borrar y recargar; CLP autorizado por Medusa.
6. Checkout pickup/delivery y error de backend: sin animaciones intrusivas y con estado persistido.
7. CPU móvil/GPU: perfilar FPS, long tasks, CLS, LCP; medir frente a v2 antes de cerrar #7–#9.
8. Verificar imágenes de catálogo cuando la API Medusa no está disponible y el estado vacío/error.

## Trabajo deliberadamente pendiente

- Galería actual de hasta dos imágenes por producto implementada con botones nativos y crossfade en tarjeta. Ampliar a Embla únicamente cuando se requieran gestos de swipe, más fotos y navegación avanzada.
- Vista de detalle SSR indexable con canonical permanente (la actual vista rápida enlazada por query es mejora de UX, **no sustituto de una ficha SEO**).
- Visual snapshots con capturas verificadas y Lighthouse a 3 resoluciones.
- Revisión profesional de fotos, arte final de acuarela/sprites y accesibilidad WCAG en navegadores reales.
- Integración Webpay únicamente tras el gate independiente del issue #10.

## Política de integración

Trabajar siempre en `v3`, sin tocar `main` ni unir la rama equivocada `feature/b3-botanical-motion`. No hacer cambios en flujo de pago o APIs Medusa desde este rediseño. Para fusionar: CI verde + QA visual + revisión de accesibilidad + smoke de carrito y checkout.
