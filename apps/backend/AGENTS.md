# Backend Agent Instructions

Also follow the repository-level `AGENTS.md` and `.github/copilot-instructions.md`.

This directory is the Medusa backend and is authoritative for commerce/business rules.

Guidelines:
- Prefer Medusa modules, workflows, links and built-in commerce primitives.
- Put florist-specific capacity/availability logic in `src/modules/production/`.
- When data models change, generate and apply migrations.
- Validate server-side; never trust browser prices, stock, dates or production capacity.
- Design concurrency, cancellation and idempotency paths.
- Keep payment credentials and all secrets outside Git.
- Use official current Medusa documentation for version-sensitive APIs.
