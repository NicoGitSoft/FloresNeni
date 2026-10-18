# AGENTS.md — FloresNeni

This repository is optimized for AI-assisted engineering.

Before making substantial changes, read:
- `.github/copilot-instructions.md`
- `docs/NENI_PRODUCTION_LOGIC.md`
- `docs/IMPLEMENTATION_ROADMAP.md`

Active development branch: `v2`.

Architecture:
- `apps/backend`: Medusa 2.x, authoritative commerce and production logic.
- `apps/storefront`: Astro + React islands.
- PostgreSQL: source of truth.
- Redis: locking, ephemeral state and production infrastructure.
- `infra/dev`: local/Codespaces development infrastructure.

Core rule: never let the browser be authoritative for price, inventory, production capacity, daily quotas, promised delivery dates, or payment state.

Prefer complete vertical slices over tiny edits. Inspect first, implement all required files, validate, update the roadmap, and leave the repo buildable.

Never commit secrets or `.env` files.
Do not modify `main` or delete the legacy root frontend unless explicitly requested.
