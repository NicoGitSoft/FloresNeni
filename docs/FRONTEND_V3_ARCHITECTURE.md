# Frontend v3 — Botanical Editorial System

Status: architecture baseline
Branch: `v3`
Base: stable `v2` at `49e88fe`
Scope: storefront UX, art direction, motion system and presentation architecture.

## Why v3 exists

v3 is not a cosmetic reskin. It is the next storefront architecture for Neni.

The goal is to make the site feel like an artisanal floral atelier with a modern,
editorial ecommerce experience: tactile, calm, botanical and recognizably Neni.
The site should feel premium because of composition, typography, photography, material
texture and restrained motion — not because every element moves.

Backend/payment work remains independent. Webpay is still being validated in its own
feature branch and must not be treated as complete merely because v3 exists.

## Product principles

1. Product photography remains the visual protagonist.
2. Motion communicates softness, air, tactility and continuity.
3. Decorative effects never block shopping tasks.
4. Checkout/payment reduces ambient motion instead of increasing it.
5. Native browser capabilities are preferred before JavaScript libraries.
6. Every effect must support reduced motion and touch.
7. No dependency is added without a concrete interaction that justifies it.
8. No visual effect should require a full SPA rewrite.
9. v3 must remain compatible with Medusa cart/checkout semantics.
10. Performance budgets are part of design acceptance, not post-launch cleanup.

## Current baseline

Storefront currently uses:

- Astro 7.3.8
- React 19.3 in `apps/storefront`
- @astrojs/react 7.0.1
- GSAP 3.15 already installed
- plain CSS in `src/styles/storefront.css`
- React islands for catalogue/cart/checkout

Important audit finding:

- root `package.json` still declares React/ReactDOM 18.3.1 while the storefront
  declares 19.3.0. v3 must normalize the dependency graph before adding new React UI
  packages.

The current home is structurally clean but visually flat:

- one solid ivory background;
- limited depth/layering;
- no coherent motion language;
- no page/shared-element transition system;
- cart embedded in flow rather than behaving as a modern ecommerce surface;
- cards have minimal hover behavior;
- no reusable modal/sheet/quick-view primitives;
- no ambient botanical signature;
- checkout and order-success do not share a polished visual shell.

## Technology strategy

### Native-first layer

Use native browser APIs for effects that no longer require a framework:

- View Transition API for cross-document continuity where supported;
- CSS scroll-driven animations for reveal/parallax/progress;
- CSS masks for watercolor edges;
- CSS Anchor Positioning for anchored labels/popovers where compatibility is acceptable;
- Popover/Dialog primitives where native behavior is sufficient;
- `color-mix()`, OKLCH and custom properties for tonal systems;
- `backdrop-filter` only in small translucent surfaces;
- Container Queries for component-local responsiveness.

Native APIs must degrade cleanly.

### Motion for React

Preferred React motion library for stateful UI:

- cart drawer;
- product quick view;
- AnimatePresence;
- layout changes;
- shared layout inside React islands;
- hover/tap/focus/drag gestures;
- spring-based microinteraction.

Motion is MIT licensed. Use it only where React owns the interaction. Do not duplicate
simple CSS transitions in Motion.

### Radix Primitives

Use selectively, not as a visual design system.

Candidates:

- Dialog / product quick view;
- accessible drawer/sheet foundation;
- Popover;
- Accordion;
- Tabs;
- Tooltip.

Radix is MIT and unstyled, which allows Neni to retain its own visual identity.

### Embla Carousel

Use for:

- product image gallery;
- seasonal/editorial story strip;
- touch-first mobile galleries.

No autoplay by default. MIT licensed.

### Lenis

Optional, not default.

Adopt only if native scroll + CSS timelines cannot deliver the desired tactile scroll
experience. It is MIT and explicitly supports reduced-motion. Avoid adding it simply
because smooth-scroll demos look polished.

### GSAP

Already present, technically excellent, but do not expand its role by default.

Reason: v3 is being designed around open/native primitives. If an existing GSAP use is
necessary, keep it isolated. New animation work should first be evaluated against CSS,
View Transitions and Motion.

### Custom Canvas/SVG botanical engine

Preferred implementation for Neni's signature ambient effect.

Do not begin with a generic particle engine. Build a constrained system with:

- a small atlas of watercolor leaf/petal sprites;
- 8–20 visible elements desktop, fewer on mobile;
- slow Bezier/flow-field trajectories;
- independent rotation;
- pointer proximity applying a soft lateral breeze;
- damping rather than explosive repulsion;
- optional scroll direction influence;
- low opacity;
- hard pause outside relevant viewport;
- no animation on checkout/payment;
- `prefers-reduced-motion` disables ambient loops.

A generic particle engine is acceptable only if the custom prototype proves more costly
without improving the result.

## Visual direction

### Core aesthetic

Name: **Botanical Editorial Motion**

Neni should feel:

- artisanal;
- editorial;
- warm;
- tactile;
- feminine without becoming childish;
- contemporary without looking like a SaaS template;
- refined without looking luxury-cold;
- botanical without filling every empty space with flowers.

### Material palette

Primary:

- warm ivory / parchment;
- paper white;
- wine;
- graphite;
- restrained botanical green.

Secondary washes:

- dusty blush;
- pale terracotta;
- muted rose;
- occasional pale sky blue for seasonal use.

Use color as watercolor wash, not flat UI chrome everywhere.

### Background system

Layer three inexpensive visual materials:

1. warm base color;
2. extremely subtle paper grain;
3. large blurred/radial watercolor washes.

Optional botanical illustration sits at edges/corners and should not repeat like
wallpaper.

### Typography

Current Georgia/Arial are placeholders, not the final brand system.

Target:

- open-licensed editorial display serif;
- open-licensed humanist sans for commerce/body;
- optional handwritten accent for very small editorial notes only.

No script font for body, prices or form controls.

## Signature interactions

### 1. Hero bloom

A large editorial hero composed from:

- oversized serif copy;
- one strong floral photograph/crop;
- watercolor wash behind the composition;
- sparse drifting petals/leaves;
- masked line reveal;
- subtle image drift or focus shift;
- CTA movement limited to a few pixels.

Optional signature experiment:
a 2D SVG flower/ranunculus whose petals separate slightly in response to pointer
movement and settle back with spring physics. This recreates the emotional quality of
the old "petals dispersing" memory without 3D/WebGL.

### 2. Botanical wind

The key Neni motion motif.

Behavior:

- not confetti;
- not continuous random chaos;
- slow directional current;
- occasional element crosses foreground;
- cursor creates a local breeze;
- mobile gets fewer elements and no pointer interaction;
- section changes can subtly alter current direction.

### 3. Layered sections

Replace hard rectangular stacking with:

- 40–120 px visual overlaps;
- translucent captions;
- asymmetrical whitespace;
- photo + cream panel overlaps;
- SVG watercolor masks or irregular separators;
- botanical line art extending beyond the content column.

### 4. Product cards

Target behavior:

- image zoom 1.00 → about 1.02–1.03;
- tiny pointer-linked image pan;
- secondary image crossfade where available;
- warm shadow increase;
- translucent action strip;
- animated underline/detail;
- no 3D tilt by default;
- keyboard focus receives equally polished state.

### 5. Product quick view

Open product detail as a layered surface rather than forcing every exploration into a
hard navigation:

- large image;
- background remains contextually visible;
- shared visual continuity from the originating card;
- accessible Dialog semantics;
- close returns focus to the originating product;
- mobile becomes bottom sheet/full-height sheet.

URL/product-detail strategy must be explicit so quick view does not harm deep links,
SEO or browser navigation.

### 6. Cart drawer

Replace the current inline cart presentation:

Desktop:
- right-side sheet;
- fixed subtotal/checkout area;
- item layout animation.

Mobile:
- bottom/full-height sheet;
- large touch targets;
- no nested-scroll surprises.

The existing CartContext/Medusa semantics remain the source of truth.

### 7. Header

- quiet/transparent over hero;
- transitions to warm paper/glass after scroll;
- subtle border;
- small logo-size shift;
- cart badge animation only when count changes;
- mobile nav becomes an editorial sheet.

### 8. Editorial storytelling

Use between catalogue blocks:

- full-bleed workshop photography;
- sticky photo + scrolling copy;
- seasonal collection story;
- florist notes;
- bouquet ingredient annotations;
- horizontal narrative strip where it is useful.

Do not put scroll effects on every section.

### 9. Image gallery

- Embla touch/swipe;
- warm graphite backdrop;
- shared image transition;
- optional click/pinch zoom;
- no automatic carousel movement.

### 10. Checkout

Checkout intentionally becomes calmer:

- same typography/material tokens;
- no botanical particle loop;
- minimal transitions;
- clear progress/feedback;
- strong focus/error states;
- payment area visually stable.

## Motion grammar

Define tokens instead of ad-hoc timing:

- instant feedback: 100–140 ms;
- fast UI: 140–190 ms;
- normal UI: 220–320 ms;
- large sheet/dialog: 320–450 ms;
- editorial reveal: 500–900 ms;
- ambient botanical: 8–30 s;
- low-bounce springs;
- transforms/opacity before filters/layout properties.

No continuous blur/filter animation on large surfaces.

## Modern browser features worth exploiting

### View Transitions

Use for navigation and shared product imagery where progressive enhancement is safe.
Do not force a client router only to get transitions; Astro itself notes that modern
native browser support increasingly reduces the need for ClientRouter.

### CSS scroll-driven animation

Preferred for lightweight parallax and reveal because progress can be bound to a scroll
or view timeline without JavaScript scroll listeners.

### CSS Anchor Positioning

Candidate for:

- product annotations;
- floating labels;
- anchored helpers;
- editorial callouts.

Because this is newly baseline in 2026, use fallback positioning.

### CSS masks

Use for:

- watercolor edge reveals;
- soft section fades;
- irregular image boundaries;
- subtle paper tears/washes.

### Backdrop filters

Use sparingly in:

- header;
- cart sheet;
- quick-view surface.

Warm/translucent, not blue glassmorphism.

## Accessibility requirements

Every v3 visual feature must satisfy:

- keyboard navigation;
- visible focus;
- focus trapping/restoration for dialogs;
- semantic buttons/links;
- WCAG contrast;
- `prefers-reduced-motion`;
- touch target size;
- no critical information revealed only by hover;
- no parallax required to understand content.

## Performance budgets

Initial v3 targets:

- no ambient animation bundle on checkout/payment;
- zero per-frame React state;
- requestAnimationFrame loop only while visible;
- decorative Canvas suspends on hidden tab;
- responsive product imagery;
- lazy decorative media;
- animation primarily transform/opacity;
- no autoplay background video;
- no unbounded particle counts;
- mobile animation budget lower than desktop;
- visual effects must not regress Core Web Vitals materially.

Before merging each visual milestone, capture Lighthouse/Web Vitals baseline and compare.

## Architecture sequence

### v3.0 — foundation

- normalize React dependency declarations;
- evaluate Astro 7.3.8 → 7.4.x with changelog/build verification;
- create shared page shell/layout;
- introduce design tokens for color/type/radius/shadow/motion;
- reduced-motion utilities;
- visual regression screenshot baseline.

### v3.1 — editorial home

- paper/watercolor background system;
- new hero composition;
- layered sections;
- modernized product card;
- restrained native scroll reveals;
- responsive/mobile pass.

### v3.2 — ecommerce interaction surfaces

- cart drawer;
- product quick view;
- accessible Dialog/Sheet primitives;
- product gallery;
- shared-element transitions;
- header state transitions.

### v3.3 — signature botanical motion

- custom petal/leaf Canvas/SVG prototype;
- pointer breeze;
- scroll coupling;
- watercolor masks;
- device/reduced-motion fallbacks;
- performance profile.

### v3.4 — checkout and release polish

- common visual shell;
- quiet checkout transitions;
- success/error states;
- accessibility audit;
- mobile QA;
- performance audit.

## Explicit non-goals

- no 3D flower configurator in this milestone;
- no WebGL by default;
- no neon/glow/gaming aesthetic;
- no custom cursor replacement;
- no page-wide perpetual parallax;
- no animation merely because a library provides it;
- no frontend change that modifies payment semantics.

## Dependency decision matrix

### Adopt when implementation begins

- Motion: yes, for React state/layout/gesture interactions.
- Radix Primitives: yes, selectively for accessible overlay primitives.
- Embla: yes, when the product gallery lands.

### Prototype before adopting

- Lenis: only if native scrolling is not enough.
- Rive: only for one branded authored animation.
- Paper.js/PixiJS: only if the custom botanical engine demonstrates a concrete need.
- tsParticles: fallback option, not first choice.

### Avoid adding for v3 foundation

- Three.js / React Three Fiber;
- generic effects packs;
- full UI theme frameworks;
- animation libraries that duplicate Motion/native features.

## Backend/payment relationship

Webpay remains a separate release track.

At the time v3 was created, the Webpay feature branch is ahead of stable v2 and its
latest CI is green, but live release gates are still pending. v3 must not claim those
gates are complete.

Pending payment work remains:

- approved sandbox end-to-end;
- rejected sandbox;
- cancel sandbox;
- refund smoke;
- ambiguous partial-refund reconciliation;
- final human review before integration.

After the payment branch is accepted into the stable integration line, v3 should absorb
it through an explicit merge/rebase with conflict review. Do not casually copy payment
files into v3.

## Definition of done for v3 visual work

v3 is not done because it "looks animated".

It is done when:

- art direction is coherent across home/catalogue/checkout;
- primary shopping tasks are faster or equally clear;
- motion communicates Neni's brand;
- reduced-motion is complete;
- keyboard/touch flows are complete;
- performance budgets pass;
- no payment behavior changed;
- visual tests exist for key responsive breakpoints;
- dependencies are justified and documented;
- user can remove any decorative layer without breaking commerce.
