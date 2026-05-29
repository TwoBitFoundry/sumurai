# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Where things are documented

Read the relevant doc before editing — don't reinvent what's already specified.

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — runtime, data flow, provider flow, cache TTLs, RLS multi-tenancy. **Read first for any non-trivial change.**
- [AGENTS.md](AGENTS.md) — commands, design guardrails, testing split, security rules.
- [CONTRIBUTING.md](CONTRIBUTING.md) — local validation, sandbox credentials, env vars, troubleshooting.
- [DESIGN.md](DESIGN.md) — source of truth for design tokens. Generated Tailwind/DTCG exports are produced by `design:guard`; never hand-edit them.
- `.agents/skills/` — load the matching skill before non-trivial work: `sumurai-backend-architecture`, `sumurai-frontend-design-system`, `sumurai-design-token-pipeline`, `sumurai-testing-policy`.

## Single-test commands

AGENTS.md covers the full suites. For iteration:

- Frontend single file: `npm --prefix frontend test -- path/to/file.test.tsx`
- Frontend single test name: `npm --prefix frontend test -- -t "name pattern"`
- Backend single test: `cargo test -p sumurai-backend --locked <name_substring>` (from repository root)

## Architecture notes

These supplement `docs/ARCHITECTURE.md` — not replace it.

- **Provider abstraction.** Teller and Plaid implement `FinancialDataProvider` in [backend/src/providers/trait_definition.rs](backend/src/providers/trait_definition.rs) and register through [backend/src/providers/registry.rs](backend/src/providers/registry.rs). Add new providers by implementing the trait + registering — **do not branch on provider name** in handlers/services where the registry would do.
- **Backend layering.** `handlers` → `services` → `repository_service` (SeaORM entities via `with_tenant`) / `cache_service` (Redis) / `providers/*`. Domain types in `models/`. Tests in `backend/src/tests/`. Cross-cutting middleware in `middleware/` + `auth_middleware.rs`.
- **Frontend layering.** `services/` wrap [frontend/src/services/ApiClient.ts](frontend/src/services/ApiClient.ts) (auth refresh + retry centralized there — **do not bypass it**). Provider-specific flows live in the service/hook layer, not in pages. `features/<area>/` holds hooks + components per feature. App shell, onboarding, and provider-mismatch handling are in [frontend/src/App.tsx](frontend/src/App.tsx).
- **Cache TTLs are constants** at the top of [backend/src/services/cache_service.rs](backend/src/services/cache_service.rs) — if you change one, update the Caching section of `docs/ARCHITECTURE.md`.
- **RLS is real.** Don't write queries that assume the app role can bypass it; the auth middleware sets the user context that every query inherits.
- **Validate UI changes at `http://localhost:8080`** (Nginx-backed). `:3001` bypasses the proxy and won't catch routing/auth issues.

## When adding a new feature

1. Cross backend↔frontend: types in `backend/src/models/`, expose via handler, regenerate OpenAPI (`backend/openapi/`, `docs/OPENAPI.json`); mirror types in `frontend/src/types/api.ts`; access via a `services/*Service.ts` that goes through `ApiClient`.
2. Provider work: extend the registry trait — never branch on provider name in handlers.
3. Design changes: edit `DESIGN.md`, run `design:guard` to regenerate exports.
4. Tests go in `frontend/tests/**` or `backend/src/tests/**`, never inline with source.
