# Frontend B3 — Botanical Motion / Art Direction

Status: research + architecture baseline  
Branch: `feature/b3-botanical-motion`  
Base: Webpay feature HEAD `00b6d85`  
Scope: storefront presentation only. Do not change backend/payment semantics.

## Intent

Neni should feel like a small floral atelier, not a generic ecommerce template and not a
"tech demo". The visual target is editorial, tactile and botanical:

- 95% photography / typography / whitespace / paper texture.
- 5% motion used as brand expression.
- Cream, paper, blush, wine, graphite and botanical green.
- Watercolor edges, translucent washes, soft gradients and subtle grain.
- Leaves and petals that react as if moved by a light current of air.
- Layered sections that overlap rather than feeling like isolated boxes.
- Product interactions that feel physical but quiet.
- Motion must never compete with product photography or checkout clarity.

## Current repo baseline

The storefront currently uses:

- Astro 7.3.8.
- React 19.3.
- `@astrojs/react` 7.0.1.
- GSAP 3.15.
- Plain CSS in `src/styles/storefront.css`.
- React islands for catalogue/cart/checkout.
- Medusa as the commerce backend.

Current visual limitations:

- flat solid page background;
- no shared-element/page transitions;
- cart is embedded above the grid instead of behaving like an ecommerce surface;
- product cards have no image choreography;
- no layered botanical art direction;
- no motion/reduced-motion system;
- no reusable design-token layer beyond a few colors;
- checkout, catalogue and success pages do not yet share a full visual shell.

There is also a monorepo version inconsistency to clean up deliberately: the storefront
declares React 19.3 while the root devDependencies still contain React 18.3.1.

## Technology policy

Prefer, in this order:

1. Native CSS / browser APIs.
2. Astro-native transitions/navigation.
3. Small React animation primitives where state/gesture matters.
4. Canvas/SVG only for branded ambient effects.
5. WebGL only if a concrete visual cannot be achieved cleanly in 2D.

Every animated feature must have:

- `prefers-reduced-motion` behavior;
- touch/mobile behavior;
- teardown on navigation/unmount;
- no layout shift;
- no payment/checkout dependency;
- a performance fallback.

## Recommended stack

### Tier A — adopt for B3

#### Native View Transitions + Astro

Use for:

- catalogue → product detail/quick-view continuity;
- image/title shared transitions;
- soft page crossfades;
- order-success transition;
- navigation without visual hard reload.

Prefer native/cross-document View Transitions where possible. Use Astro ClientRouter only
where the project actually needs its routing behavior.

#### CSS scroll-driven / scroll-triggered animation

Use for:

- section reveal;
- very slow watercolor wash drift;
- botanical layers moving a few pixels at different rates;
- decorative rule/underline drawing;
- hero typography reveal.

This should replace JavaScript for simple scroll choreography.

#### Motion for React

Primary library candidate for React islands.

Use for:

- cart drawer;
- product quick view;
- AnimatePresence;
- layout transitions;
- spring hover/tap behavior;
- drag/swipe;
- product card reordering/filter transitions.

Keep animations in React components and use CSS for purely decorative motion.

#### Radix Primitives

Use selectively for accessible:

- Dialog / quick view;
- Sheet-like cart surface;
- Popover;
- Accordion;
- Tabs;
- Tooltip.

Style everything as Neni; do not adopt a generic component-library look.

#### Floating UI

Use only where exact floating positioning is needed:

- tooltips;
- occasion/color helper popovers;
- delivery hints;
- small product-info callouts.

#### Embla Carousel v8 stable

Use for:

- product image gallery;
- seasonal/editorial story strips;
- mobile swipe carousels.

Do not use autoplay by default.

### Tier B — targeted experiments

#### Custom Canvas 2D botanical wind field

Preferred solution for the signature ambient effect.

Concept:

- 8–20 transparent PNG/SVG watercolor petals or leaves;
- low particle count;
- Bezier/flow-field movement;
- very slow velocity;
- occasional rotation;
- pointer creates a local "breeze", not a repelling explosion;
- scroll can slightly alter flow direction;
- opacity stays low;
- particles disappear behind/around foreground sections;
- disabled/reduced on mobile and reduced-motion.

This is closer to the old Galaxy-style drifting/petal memory than generic particles.

Implement custom first. Only use tsParticles if it materially reduces code without making
the behavior look generic.

#### SVG watercolor filters

Use SVG `feTurbulence` + `feDisplacementMap` for:

- paper/wash edges;
- subtly irregular borders;
- soft watercolor masks;
- section separators;
- decorative organic blobs.

Never apply strong live filters to large photographic areas; rasterize/cache decorative
assets where it is cheaper.

#### Paper.js

Good optional tool for:

- procedural curved stems;
- Bezier leaf/petal paths;
- hand-drawn path variation;
- non-3D botanical sketches.

Do not add unless custom Canvas/SVG becomes hard to maintain.

#### PixiJS

Reserve for a richer 2D scene if the lightweight Canvas prototype cannot achieve the
required performance. It is capable but larger than Neni needs for v1.

#### Rive runtime

Interesting for one authored vector interaction:

- logo bloom;
- ranunculus opening;
- small illustrated delivery/confirmation moment.

Runtimes are MIT/open source. Treat authored `.riv` assets as optional brand assets, not
the general animation system.

#### dotLottie

Use only for pre-authored decorative vector animations that are difficult to reproduce
with CSS/SVG. Prefer interactive/native code for page UI.

### Tier C — inspiration/reference, not default dependencies

- Motion Primitives: study transitions and interaction patterns; copy/adapt only the small
  primitive required.
- React Bits: useful idea library, but many effects are intentionally loud. Cherry-pick
  only quiet effects.
- Magic UI: reference library for animated UI patterns. Avoid copying its "SaaS glow"
  aesthetic into Neni.
- Theatre.js: powerful choreography/timeline system, but unnecessary for normal ecommerce
  UI; consider only for a one-off art-directed hero sequence.
- tsParticles: capable and active, but default aesthetics skew particle/confetti. Use only
  with fully custom watercolor sprites and constrained physics.
- GSAP 3.15: already present and excellent technically, now free for commercial use, but
  it uses GreenSock's Standard no-charge license rather than an OSI open-source license.
  Because B3 prefers open-source dependencies, do not expand reliance on GSAP until the
  team deliberately accepts that license distinction.

## Visual system proposals

### 1. Watercolor paper canvas

Body background composed from:

- warm ivory base;
- extremely subtle paper grain;
- large radial color washes at 3–8% opacity;
- occasional hand-painted botanical corner art;
- no repeating obvious pattern.

Palette direction:

- ivory / parchment;
- dusty blush;
- muted terracotta;
- wine;
- graphite;
- restrained botanical green;
- optional pale sky-blue accent for selected seasonal collections.

### 2. Botanical wind layer

A persistent but sparse decorative layer behind content.

Behavior:

- petals/leaves drift on slow curved trajectories;
- pointer proximity adds a mild lateral force;
- velocity damps naturally;
- elements rotate independently;
- no constant screen-filling motion;
- hero has the strongest effect;
- catalogue uses only 2–4 passing elements;
- checkout disables it.

### 3. Watercolor section transitions

Instead of hard rectangular sections:

- mask sections with soft SVG edges;
- overlap the next section by 40–120 px;
- place translucent "wash" blobs behind headings;
- use asymmetric whitespace;
- introduce faint botanical line drawings extending outside the content grid.

### 4. Product cards

Cards should feel editorial, not dashboard-like.

Possible effects:

- image scales 1.00 → 1.025 on pointer hover;
- image pans 4–8 px following pointer;
- very subtle paper shadow increases;
- title/price move 1–3 px;
- a translucent wine/cream action strip appears;
- secondary product image can crossfade on hover;
- card border can use a faint gradient/watercolor edge;
- focus-visible treatment remains strong and accessible.

No 3D tilt by default.

### 5. Product quick view

Open product details as a large layered sheet/dialog:

- image expands visually from the card;
- background page stays visible and slightly softened;
- panel slides/fades from lower-right or bottom;
- product image remains dominant;
- close returns smoothly to its original card;
- URL/state strategy decided separately.

This gives the "sections/panels overlap the main layout" behavior without unnecessary
full-page navigation.

### 6. Cart drawer

Replace the cart block above the product grid with:

- cart button/badge in header;
- right-side drawer desktop;
- bottom sheet mobile;
- spring open/close;
- item image thumbnail;
- quantity updates with layout animation;
- subtotal sticky at bottom;
- checkout CTA always visible.

Cart state remains the existing CartContext/Medusa implementation.

### 7. Header

- initially transparent/quiet over hero;
- becomes paper/glass surface after scroll;
- very low blur and thin translucent border;
- logo can reduce slightly in size;
- cart badge animates only when count changes;
- mobile nav opens as a full-height editorial sheet rather than a small dropdown.

### 8. Hero

Preferred direction:

- huge serif display type;
- one photographic arrangement or cropped flower;
- watercolor bloom/wash behind text;
- 3–8 petals/leaves moving slowly;
- typography reveal by line/mask;
- CTA magnetic movement limited to 2–4 px;
- optional decorative handwritten note, not animated continuously.

Alternative hero experiment:

A ranunculus/flower mark whose petals separate by a few pixels on pointer movement and
settle back with spring physics. This is 2D SVG, not 3D.

### 9. Editorial storytelling sections

Between product groups:

- full-bleed photograph with cream text panel overlapping it;
- horizontal story strip;
- sticky image + scrolling copy;
- seasonal collection intro;
- "from the workshop" detail photography;
- ingredient/flower labels anchored around a bouquet image.

Motion should be scroll-linked and subtle.

### 10. Image gallery / lightbox

- shared-element transition from product card;
- pinch/zoom or click-to-zoom;
- touch swipe;
- background dimmed in warm graphite rather than black;
- captions stay editorial/minimal.

### 11. Buttons and links

- 150–250 ms opacity/background transitions;
- 1–2 px lift;
- soft liquid/ink fill on primary CTA as optional experiment;
- animated underline for text links;
- no neon glows.

### 12. Decorative borders

Possible treatments:

- 1 px translucent wine/graphite;
- gradient border with very low contrast;
- SVG irregular watercolor stroke;
- clipped corner botanical line;
- shadow tinted with warm brown/rose rather than black.

### 13. Glass/translucent panels

Use sparingly:

- header;
- quick view;
- cart;
- occasional floating caption.

Use cream-tinted transparency, not cold blue "glassmorphism".

### 14. Typography

Move away from browser Georgia/Arial toward an explicit licensed/open font pair in a later
B3 step.

Target:

- expressive editorial serif for display;
- neutral humanist sans for commerce/body;
- optional handwriting accent only for tiny labels.

Font files must be optimized/subset and self-hosted where licensing allows.

### 15. Motion language

Define reusable motion tokens:

- fast UI: ~140–180 ms;
- normal UI: ~220–320 ms;
- editorial reveal: ~500–900 ms;
- ambient botanical: 8–30 s;
- spring: low bounce;
- opacity and transform first;
- blur only in small areas;
- no large continuous filter animation.

### 16. Reduced motion

When `prefers-reduced-motion: reduce`:

- remove ambient petals/wind;
- disable parallax;
- use instant/short opacity state changes;
- retain functional drawer/dialog transitions only where needed for orientation.

## Performance budgets

B3 should target:

- no ambient JS on checkout/payment unless required;
- hero visual effects lazy/init after critical content;
- particles capped by viewport/device capability;
- no autoplay video background by default;
- images use responsive sizes and modern formats;
- decorative assets compressed and lazy loaded;
- avoid animation of layout properties;
- avoid per-frame React state;
- use transform/opacity or Canvas for frame loops.

## Proposed implementation phases

### B3.0 — foundation

- align React dependency declarations;
- decide whether to upgrade Astro 7.3.8 → current 7.4.x after changelog review;
- create reusable page shell;
- expand design tokens;
- add reduced-motion primitives;
- establish visual QA screenshots.

### B3.1 — editorial home

- watercolor/paper background;
- hero art direction;
- layered section composition;
- product-card hover/reveal;
- scroll reveals;
- responsive/mobile pass.

### B3.2 — ecommerce surfaces

- cart drawer;
- product quick view;
- product gallery/lightbox;
- shared transitions;
- persistent header.

### B3.3 — signature botanical motion

- custom 2D petal/leaf wind field;
- pointer breeze;
- scroll coupling;
- SVG watercolor masks/filters;
- device/performance fallback.

### B3.4 — checkout polish

- shared design shell;
- calm progress/feedback transitions;
- no ambient distraction around payment;
- accessible validation motion.

## Non-goals

- no 3D flower configurator in B3;
- no WebGL as the primary visual layer;
- no gamer/neon effects;
- no cursor replacement;
- no constant parallax on every element;
- no animation that blocks product interaction;
- no dependency added merely for one trivial CSS transition.

## Payment/backend work intentionally still pending

B3 must not hide or close the Webpay release gates. Still pending separately:

- approved sandbox end-to-end;
- rejected sandbox path;
- cancel sandbox path;
- refund smoke;
- durable reconciliation for ambiguous partial refund;
- final human review of PR #5 before merge.

Frontend work can proceed independently, but payment readiness remains a release gate.

## Research references

- Astro View Transitions: https://docs.astro.build/en/guides/view-transitions/
- Motion: https://motion.dev/
- Radix Primitives: https://www.radix-ui.com/primitives
- Floating UI: https://floating-ui.com/
- Embla Carousel: https://www.embla-carousel.com/
- Lenis: https://lenis.darkroom.engineering/
- tsParticles: https://particles.js.org/
- Paper.js: https://paperjs.org/
- PixiJS: https://pixijs.com/
- Rive runtimes: https://rive.app/
- Motion Primitives: https://motion-primitives.com/
- React Bits: https://reactbits.dev/
- Magic UI: https://magicui.design/
