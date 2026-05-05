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
- `npm run precommit` - run the full validation set used by the repo.

## Coding Style
- Rust: keep units small and testable, prefer idiomatic error handling, and use `cargo fmt` and `cargo clippy`.
- TypeScript: keep types precise, follow existing hooks/service patterns, and use `tsc -b` style checks through the frontend scripts.
- Keep tests in the existing test folders; do not add tests inline with source files.

## Testing
- Backend tests live in `backend/src/tests/` and run with `cargo test --manifest-path backend/Cargo.toml`.
- Frontend tests use Jest + React Testing Library under `frontend/`.
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
