# Repository Guidelines

## Project Structure
- `frontend/` - Next.js 16 + React 19 + TypeScript UI with Tailwind, Biome, Bun test, Recharts, and OpenTelemetry browser instrumentation.
- `backend/` - Rust 1.97.1 Axum API with SeaORM, Redis, Postgres, JWT auth, provider integrations, and OpenTelemetry tracing (`OTEL_TRACES_EXPORTER`: none, console, or OTLP).
- `docs/` - architecture docs, screenshots, threat model, compliance docs, and reference diagrams.
- `nginx/` - local reverse proxy and TLS entrypoint files used by Docker Compose.
- `docker-compose.yml` - OSS-style deployment: prebuilt GHCR images, nginx (slim template, no Seq), frontend, backend, Postgres, Redis, optional certbot profile.
- `docker-compose.dev.yml` - same topology as OSS but builds frontend and backend from source; console trace export and relaxed auth cookies for local use.
- `docker-compose.prod.yml` - production-oriented stack with Seq, full nginx template (Seq UI and OTLP ingress), public 80/443, and OTLP export to Seq.

## Build And Run
- `docker compose up -d --build` - start the default OSS stack at `http://localhost:8080` (pulls or uses local GHCR-tagged images per compose).
- `docker compose -f docker-compose.dev.yml up -d --build` - start the development stack with local image builds.
- `docker compose -f docker-compose.prod.yml up -d --build` - start the production-oriented stack (requires production env and secrets; see `docs/PRODUCTION_TLS.md`).
- `bun --cwd=frontend install` - install frontend dependencies.
- `bun --cwd=frontend run dev` - Next.js dev server on `http://localhost:3001`.
- `bun --cwd=frontend run build` / `bun --cwd=frontend run test` - frontend build and tests.
- `bun run precommit` (Husky default): frontend Biome check, `typecheck`, `design:guard`, and `bun test`, then `backend:ci`. Does not reinstall `frontend` deps, nor Storybook static build, Vitest browser tests, Playwright iframe smoke, or Chromium install; `typescript`/`tsc` still covers `*.stories.tsx` under `src/` with the rest of the app sources. Assumes dependencies are installed. Run `bun run backend:ci && bun run frontend:ci` when you need full local parity with the GitHub frontend job (`frontend:ci`).

## Design system guardrails and Storybook AI

- `bun --cwd=frontend run design:guard` runs DESIGN.md lint, token drift checks, raw styling guard, and regenerates DTCG + Tailwind exports from `DESIGN.md` (same guard chain as `frontend:design` in root `package.json`).
- `bun --cwd=frontend run storybook` serves Storybook on port 6006. Global Cursor MCP may point at `http://localhost:6006/mcp`; that endpoint exists only while Storybook is running. Start Storybook first, wait until it prints ready, then reload the Cursor window or toggle the Storybook MCP server off and on so the client reconnects. If it still fails, use Output → MCP Logs. Use Storybook MCP tools for component docs and story workflows before inventing new UI patterns.
- `bun run frontend:playwright-install` (or `bun --cwd=frontend run playwright:install`) downloads Playwright’s Chromium for light local use. `bun --cwd=frontend run playwright:install-ci` matches CI (`--with-deps`; used by `frontend:ci`).
- CI builds static Storybook and runs iframe smoke tests (`test:storybook-runtime`) on pull requests and pushes.

## Coding Style
- Rust: keep units small and testable, prefer idiomatic error handling, and use `cargo fmt` and `cargo clippy`.
- TypeScript: keep types precise, follow existing hooks/service patterns, and use `tsc -b` style checks through the frontend scripts.
- Keep tests in the existing test folders; do not add tests inline with source files.

## Testing
- Backend tests live in `backend/src/tests/` and run with `cargo test -p sumurai-backend --locked` from the repository root (`bun run backend:ci` for the full backend suite).
- Frontend Bun tests live under `frontend/tests/` and own services, domain logic, hooks, API contracts, observability, setup, mocks, token flows, and business rules.
- Storybook Vitest owns rendered UI states, browser interactions, loading/error/disabled states, form validation display, callback outcomes, and other browser-only component behavior.
- Playwright Storybook iframe smoke tests own static Storybook load checks without screenshot baselines.
- Add or adjust tests when changing business logic, especially around auth, provider sync, budgets, and cache behavior.

## Commit And PRs
- Use Conventional Commits, for example `feat: add budgets summary chart` or `fix: handle empty transactions`.
- Keep PRs focused and small.
- Ensure CI is green before requesting review once the PR is marked ready (**`ci`** skips draft PRs on GitHub). **CodeQL** runs on a weekly schedule only.
- Use `feat!:` or `BREAKING CHANGE:` for breaking changes.

## UI policy
- Use `.agents/skills/sumurai-frontend-design-system/SKILL.md` for Sumurai frontend UI work.
- That skill is the source of truth for `DESIGN.md`, primitives, recipes, tokens, and composition examples.

## Security
- Never read or write `.env` files from automation.
- Use `.env.example` as the reference for local configuration.
- Never commit real secrets.
- Generate local secrets with `openssl rand -hex 32` for `JWT_SECRET` and `ENCRYPTION_KEY`.
- Redis is mandatory; the backend exits without it.
- Local E2E demo user (dev compose only): `me@test.com` / `Test1234!`.

## Product rules
- Transaction category and merchant identity for business logic are defined under **Conventions** in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (effective category → default category; normalized merchant → default merchant name).
