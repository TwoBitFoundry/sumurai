# Contributing to Sumaura

Thanks for your interest in improving Sumaura! This guide helps you get set up quickly, follow the project workflow, and submit high‑quality PRs.

> Heads‑up: End‑to‑end validation happens only at `http://localhost:8080` via Nginx → backend proxy. Vite dev (`:5173`) is fine for UI iteration, but not for full flows.

## Prerequisites

- Node 18+ and npm 9+
- Rust (stable) and Cargo
- Docker and Docker Compose
- cross (for macOS → Linux backend builds)
- sqlx‑cli (for running migrations locally)

## Getting Started

Clone your fork and create a feature branch:

```bash
git clone <your-fork-url>
cd sumaura
git checkout -b feat/my-change
```

### Full Stack (Docker)

The fastest way to boot everything:

```bash
./scripts/build-backend.sh           # cross‑compile backend (x86_64 Linux)
docker compose up -d --build         # frontend + backend + redis + postgres
# Open http://localhost:8080
```

E2E demo credentials:
- Username: `me@test.com`
- Password: `Test1234!`

### Frontend Development

```bash
cd frontend
npm install
npm run dev               # Vite on :5173 for fast UI iteration
npm run build             # production build
npm test                  # unit tests (Vitest + RTL)
npm run test:ui           # UI test runner
```

Notes:
- Use the mock/real toggle in the header for rapid UI testing.
- Validate integrated flows at `http://localhost:8080` (not Vite’s port).

### Backend Development

Run with local Redis (Redis is required; no in‑memory fallback):

```bash
docker compose up -d redis
REDIS_URL=redis://localhost:6379 cargo run
```

Common cargo commands:

```bash
cargo check
cargo test
RUST_BACKTRACE=1 cargo test some_test -- --nocapture
cargo build --release
```

### Database Migrations

Using a local Postgres instance:

```bash
# Example: adjust host/port/user/password as needed
DATABASE_URL=postgresql://postgres:password@localhost:5432/accounting \
  sqlx migrate run
```

### Repo Structure (quick tour)

- `frontend/` — React 18 + TypeScript + Vite; Tailwind; Recharts
- `backend/` — Rust + Axum + SQLx; Redis caching; RLS policies
- `scripts/` — build helpers (e.g., `build-backend.sh`)
- `docs/` — images/diagrams used in README

See `README.md` for architecture details and endpoint mapping.

## Coding Standards

- TypeScript: keep types precise; prefer hooks and services per the existing patterns. Run `tsc -b` to type‑check.
- Rust: prefer small, testable units; follow trait‑based DI for services. Use idiomatic error handling.
- Formatting/Linting: use project defaults (e.g., `cargo fmt`, `cargo clippy`, TypeScript/ESLint if configured). Keep changes focused and minimal.
- Tests: write or update unit tests when changing business logic (frontend or backend). Aim for Given/When/Then clarity.
- Secrets: never commit real secrets or `.env` files. Redis is mandatory in all code paths.

## Branch, Commits, and PRs

- Branch from `main` and keep PRs small and focused.
- Commit style: Conventional Commits. Examples:
  - `feat: add budgets summary chart`
  - `fix: handle empty Plaid accounts`
  - `refactor: extract transaction filter utils`
  - Use `feat!:` or include a `BREAKING CHANGE:` section in the PR description for breaking changes.
- Open a PR when ready; CI should be green before requesting review.
- Merge strategy: squash‑and‑merge on `main`.
- Releases: created automatically on `main` via semantic‑release; do not push tags manually.

### PR Checklist

- [ ] Feature/bug has a linked issue (or a brief rationale in the PR)
- [ ] Follows existing patterns and style; minimal blast radius
- [ ] Includes tests for changed business logic (if applicable)
- [ ] Builds and runs locally (`docker compose up -d --build` works)
- [ ] No secrets or credentials committed; docs updated if user‑facing behavior changed

## Troubleshooting

- Logs: `docker compose logs -f <service>`
- Reset local data: `docker compose down -v` (removes volumes)
- Common gotchas:
  - Backend fails fast without Redis; start Redis first for local runs.
  - Validate E2E only at `http://localhost:8080` (SPA + API proxy).

## License and Contributions

By contributing, you agree your contributions are licensed under the project’s license (SUL‑Community‑1.0). See `LICENSE` for details.

If you’re unsure about scope or approach, open a draft PR early or start a discussion in the issue to align before implementation.
