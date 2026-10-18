# FloresNeni — AI Repository Instructions

## Mission

Build **Neni — Taller de Flores** as a production-grade floral ecommerce and operating system for a florist. Work fast, but preserve correctness, data integrity, and the business rules documented in this repository.

## Canonical branch and source of truth

- Active development branch: `v2`.
- Do not modify `main` unless explicitly requested.
- Business rules: `docs/NENI_PRODUCTION_LOGIC.md`.
- Technical roadmap/status: `docs/IMPLEMENTATION_ROADMAP.md`.
- The legacy root `index.html`, `src/`, and `public/` are preserved only as visual/reference material until Astro reaches parity. Do not delete them unless explicitly instructed.

## Architecture

- `apps/backend`: Medusa 2.x + TypeScript. This is the authoritative commerce/business layer.
- `apps/storefront`: Astro + React islands.
- PostgreSQL is the source of truth.
- Redis is used for ephemeral state, locking, event/workflow infrastructure, and concurrency where appropriate.
- Development infrastructure lives under `infra/dev`.
- Package manager is pinned to **pnpm 10.34.6**.
- Node 22+.

## Business-rule placement

Never make the browser authoritative for:
- prices,
- inventory,
- production capacity,
- daily product limits,
- promised delivery dates,
- payment state,
- stock reservations.

Astro handles structure, SEO, content and visual presentation.
React handles client interaction.
Medusa decides commerce and production rules.

The target invariant before charging a customer is:

`price + materials + production capacity + daily quota + promised date`

must all be valid server-side.

## Neni production model

Preserve the rules in `docs/NENI_PRODUCTION_LOGIC.md`, including:
- configurable global daily limit per product (initially 3),
- normal same-day cutoff 14:00,
- optional extended same-day window up to 18:00,
- same-day sales use physical stock only,
- future orders may consider planned procurement,
- baseline 180 productive minutes/day,
- procurement can consume production time,
- Sunday is non-production by default but orders may still be accepted,
- forward scheduling: if tomorrow cannot fit the order, find the first feasible later date,
- recipes/BOM,
- waste tracking,
- substitutions,
- automatic procurement list,
- future multi-florist capacity.

Do not hardcode these rules in React.

## Development style

Prefer complete vertical slices over tiny incremental edits.

For each substantial task:
1. Inspect the relevant implementation and docs first.
2. Implement the whole coherent slice.
3. Add/update validation or tests.
4. Run the narrowest reliable checks.
5. Update `docs/IMPLEMENTATION_ROADMAP.md`.
6. Keep commits focused and descriptive.

Do not repeatedly ask for package versions already declared in the repository.
Do not upgrade dependencies unless the task requires it.
Do not reopen known non-blocking warnings unless they become relevant.

## Validation

Storefront changes should normally pass:
- `pnpm --filter @neni/storefront exec tsc --noEmit`
- `pnpm --filter @neni/storefront build`

Backend changes should normally pass:
- `pnpm --filter @dtc/backend build`
- relevant unit/integration tests when present
- Medusa migrations when data models change

Run `git diff --check` before finishing.

## Medusa conventions

Prefer Medusa modules, workflows, links and official commerce primitives over duplicating platform functionality.

Use native Medusa features where they fit:
- carts and line items,
- customers,
- inventory and stock locations,
- inventory reservations,
- sales channels,
- fulfillment,
- payment collections/providers.

Custom Neni production logic belongs in a dedicated module under:

`apps/backend/src/modules/production/`

When adding data models, generate and apply migrations.

## Storefront conventions

- Preserve the premium/editorial Neni aesthetic.
- Use real product photography; do not replace it with generated imagery.
- Keep product/customer interactions accessible and mobile-first.
- Publishable API keys may be client-visible; secrets must never be exposed through Astro public env vars.

## Security

Never commit:
- `.env` files,
- passwords,
- JWT/cookie secrets,
- payment secrets,
- private API tokens.

Use `.env.example` files for required variable names and GitHub/Codespaces secrets for real credentials.

Validate payment callbacks server-side and make payment/order transitions idempotent.

## Documentation

When behavior changes, update the appropriate document:
- business semantics → `NENI_PRODUCTION_LOGIC.md`
- implementation state/order → `IMPLEMENTATION_ROADMAP.md`

Do not silently change Denise's business rules. If a required rule is ambiguous, implement the smallest reversible abstraction and mark the unresolved decision in documentation.

## AI workflow

This repository is intentionally optimized for AI-assisted development.
Agents should:
- inspect before editing,
- make useful multi-file changes autonomously,
- avoid unnecessary manual user steps,
- prefer one reproducible command over a sequence of ad-hoc shell actions,
- leave the repository buildable and documented.
