# Repository Guidelines

## Project Structure & Module Organization
- `frontend-next/` — Next.js + React + TypeScript UI (Tailwind, Recharts).
- `backend/` — Rust (Axum) API with SQLx, Redis cache, and Postgres.
- `docs/` — architecture diagrams and screenshots used by the README.
- `docker-compose.yml` — local stack: nginx + backend + frontend + postgres + redis.

## Build, Test, and Development Commands
- `docker compose up -d --build` — run the full stack at `http://localhost:8080` (required for end-to-end flows).
- `docker compose up -d redis` — start Redis for local backend runs.
- `REDIS_URL=redis://localhost:6379 cargo run` — run the backend locally.
- `cargo check` / `cargo test` / `cargo build --release` — Rust build and test.
- `cd frontend-next && npm install` — install frontend dependencies.
- `npm run dev` — Next.js dev server on `http://localhost:3001` (UI iteration only).
- `npm run build` / `npm test` / `npm run lint` — production build, Jest tests, ESLint.

## Coding Style & Naming Conventions
- Rust: small, testable units; idiomatic error handling; use `cargo fmt` and `cargo clippy`.
- TypeScript: precise types; follow existing hooks/service patterns; `tsc -b` for type checks.
- Naming: follow existing module naming; tests live under `backend/src/tests/` and `frontend-next` with Jest defaults.

## Testing Guidelines
- Backend tests are in `backend/src/tests/` and run with `cargo test`.
- Frontend tests use Jest + React Testing Library: `cd frontend-next && npm test`.
- Add/adjust tests when changing business logic; keep assertions Given/When/Then clear.

## Commit & Pull Request Guidelines
- Commit style: Conventional Commits (e.g., `feat: add budgets summary chart`, `fix: handle empty transactions`).
- Keep PRs small and focused; link an issue or explain the rationale.
- CI should be green before requesting review; squash-and-merge on `main`.
- If breaking changes: use `feat!:` or include `BREAKING CHANGE:` in the PR description.

## Security & Configuration Tips
- Never commit real secrets or `.env` files.
- Use `.env.example` as a base; set `JWT_SECRET` and `ENCRYPTION_KEY` via `openssl rand -hex 32`.
- Redis is mandatory; backend exits without it.
- Demo credentials for local E2E: `me@test.com` / `Test1234!`.
