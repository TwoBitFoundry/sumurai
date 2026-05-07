# Repository Guidelines

## Project Structure
- `frontend/` - Next.js 16 + React 19 + TypeScript UI with Tailwind, Biome, Jest, Recharts, and OpenTelemetry browser instrumentation.
- `backend/` - Rust 1.95 Axum API with SQLx, Redis, Postgres, JWT auth, provider integrations, and OpenTelemetry export to Seq.
- `docs/` - architecture docs, screenshots, threat model, compliance docs, and reference diagrams.
- `nginx/` - local reverse proxy and TLS entrypoint files used by Docker Compose.
- `docker-compose.yml` - full local stack with nginx, frontend, backend, Postgres, Redis, Seq, and certbot.
- `docker-compose.development.yml` - local build override for the app images.

## Build And Run
- `docker compose up -d --build` - start the production-like stack at `http://localhost:8080`.
- `docker compose -f docker-compose.yml -f docker-compose.development.yml up -d --build` - start the local development compose stack with source builds.
- `npm --prefix frontend install` - install frontend dependencies.
- `npm --prefix frontend run dev` - Next.js dev server on `http://localhost:3001`.
- `npm --prefix frontend run build` / `npm --prefix frontend test` - frontend build and tests.
- `npm run precommit` matches the **backend** and **frontend** jobs in `.github/workflows/ci.yml` (ordering and flags, including `jest --ci`, `next build`, `playwright install chromium --with-deps`, Storybook static build, Storybook Vitest, and iframe smoke). Uses `npm --prefix frontend ci` like CI. GitHub may still **skip** a job on a PR via path filters; locally this always runs **both** halves.

## Design system guardrails and Storybook AI

- `npm --prefix frontend run design:guard` runs DESIGN.md lint, token drift checks, raw styling guard, and regenerates DTCG + Tailwind exports from `DESIGN.md` (same guard chain as `frontend:design` in root `package.json`).
- `npm --prefix frontend run storybook` serves Storybook on port 6006. Global Cursor MCP may point at `http://localhost:6006/mcp`; that endpoint exists only while Storybook is running. Start Storybook first, wait until it prints ready, then reload the Cursor window or toggle the Storybook MCP server off and on so the client reconnects. If it still fails, use Output → MCP Logs. Use Storybook MCP tools for component docs and story workflows before inventing new UI patterns.
- `npm run frontend:playwright-install` (or `npm --prefix frontend run playwright:install`) downloads Playwright’s Chromium for light local use. `npm --prefix frontend run playwright:install-ci` matches CI (`--with-deps`). Pre-commit uses the CI-style install.
- CI builds static Storybook and runs iframe smoke tests (`test:storybook-runtime`) on pull requests and pushes.

## Coding Style
- Rust: keep units small and testable, prefer idiomatic error handling, and use `cargo fmt` and `cargo clippy`.
- TypeScript: keep types precise, follow existing hooks/service patterns, and use `tsc -b` style checks through the frontend scripts.
- Keep tests in the existing test folders; do not add tests inline with source files.

## Testing
- Backend tests live in `backend/src/tests/` and run with `cargo test --manifest-path backend/Cargo.toml`.
- Frontend Jest tests live under `frontend/tests/` and own services, domain logic, hooks, API contracts, observability, setup, mocks, token flows, and business rules.
- Storybook Vitest owns rendered UI states, browser interactions, loading/error/disabled states, form validation display, callback outcomes, and other browser-only component behavior.
- Playwright Storybook iframe smoke tests own static Storybook load checks without screenshot baselines.
- Add or adjust tests when changing business logic, especially around auth, provider sync, budgets, and cache behavior.

## Commit And PRs
- Use Conventional Commits, for example `feat: add budgets summary chart` or `fix: handle empty transactions`.
- Keep PRs focused and small.
- Ensure CI is green before requesting review.
- Use `feat!:` or `BREAKING CHANGE:` for breaking changes.

## Security
- Never read or write `.env` files from automation.
- Use `.env.example` as the reference for local configuration.
- Never commit real secrets.
- Generate local secrets with `openssl rand -hex 32` for `JWT_SECRET` and `ENCRYPTION_KEY`.
- Redis is mandatory; the backend exits without it.
- Local E2E demo credentials are `me@test.com` / `Test1234!`.
