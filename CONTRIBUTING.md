# Contributing to Sumurai

Thanks for helping improve Sumurai. This guide covers the current workflow, local validation commands, and the conventions used in this repository.

> Heads-up: both `http://localhost:8080` and `http://localhost:3001` support end-to-end validation locally. `8080` runs through Nginx; `3001` uses Next dev rewrites to proxy `/api` and `/health` to the backend.

## Prerequisites

- Node 24.10+ and npm 10+
- Rust stable and Cargo
- Docker and Docker Compose
- `sqlx-cli`
- OpenSSL

## Getting Started

Clone your fork and create a feature branch:

```bash
git clone <your-fork-url>
cd sumurai
git checkout -b feat/my-change
```

Before the first backend build, fetch the model assets:

```bash
./backend/scripts/fetch-models.sh
```

The backend Docker build performs the same fetch automatically, but local `cargo build` expects the assets to be present first.

## Open source and AI-assisted contributions

This project treats **GitHub Actions as the merge gate**. The default Git hook trades some parity for contributor time.

**`npm run precommit` (Husky):** frontend **Biome check**, `typecheck`, **design guard**, and **Jest**, then **`npm run backend:ci`**. It does **not** run `npm ci` in `frontend/`, **`next build`**, Storybook static build, Vitest browser tests, or Playwright iframe smoke. Typecheck already includes `*.stories.tsx` under `src/` with the app.

For **full parity** with `.github/workflows/ci.yml` frontend steps before you push (for example Storybook/Vite/Playwright paths), run **`npm run backend:ci && npm run frontend:ci`** manually.

**Draft pull requests:** the **`ci`** workflow **does not** run GitHub-hosted jobs while the PR is marked draft. Mark the PR ready for review to trigger it (aside from what you run locally with `npm run precommit`). **CodeQL** runs on a weekly schedule only, not on pull requests.

On GitHub, backend or frontend jobs can be **skipped per path filters**; `precommit` still runs **both** stacks locally.

**If you only changed one side**, you can narrow scope while developing:

```bash
npm run backend:ci
```

```bash
npm run frontend:ci
```

For finer slices while iterating, use the commands in **Frontend Development** and **Backend Validation** below.

**Design-only edits:** changing repo-root `DESIGN.md` triggers the **frontend** CI job (path filter), so token and design guard failures show up there even when no files under `frontend/` changed.

**Skipping hooks:** `git commit --no-verify` is available, but **CI must pass** before maintainers can merge. If an automated or AI-generated patch skips the hook, treat the GitHub `ci` workflow as the review checklist.

**If you use AI coding tools:** follow this file, `AGENTS.md`, and existing patterns; keep changes small; do not commit `.env` or secrets; and ensure new behavior has tests in the existing `frontend/tests/` or `backend/src/tests/` layout.

## Full Stack

Start the **default OSS** stack (GHCR images, no Seq):

```bash
docker compose up -d --build
```

For **source-built** local development (console traces, Lax cookies in compose):

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

For the **production-oriented** stack with Seq, use `docker-compose.prod.yml` and [docs/PRODUCTION_TLS.md](docs/PRODUCTION_TLS.md).

Demo credentials (password `Test1234!` for each account):

- Plaid: `plaid@test.com`
- Teller: `teller@test.com`
- SimpleFIN: `simplefin@test.com` (requires `SIMPLEFIN_SETUP_TOKEN` in the environment)

## Frontend Development

```bash
cd frontend
npm install
npm run dev
npm run build
npm test
```

- `npm run dev` starts the Next.js dev server on `http://localhost:3001`.
- `http://localhost:3001` proxies `/api` and `/health` to the backend for local end-to-end flows.
- `http://localhost:8080` remains the Nginx-backed integrated stack.
- Supported local host platforms are macOS, Linux, and Windows through Docker Compose.

### Storybook

Component stories live under `frontend/src` as `*.stories.tsx`. From the repo root:

```bash
npm run storybook
npm run storybook:build
npm run frontend:storybook-test
```

The root Storybook commands delegate to `frontend/` (same as `cd frontend && npm run …`). `storybook` serves `http://localhost:6006`. `storybook:build` writes `frontend/storybook-static` (used by CI Storybook iframe smoke tests). `frontend:storybook-test` runs the Storybook Vitest project from the repo root. Storybook MCP needs Storybook running first; see `AGENTS.md`.

## Backend Validation

Use Cargo commands for backend changes:

```bash
cargo check --manifest-path backend/Cargo.toml
cargo test --manifest-path backend/Cargo.toml
cargo fmt --manifest-path backend/Cargo.toml --all --check
cargo clippy --manifest-path backend/Cargo.toml --all-targets --no-deps -- -D warnings
```

## Database Migrations

If you need to run migrations manually against a Postgres instance:

```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/accounting \
  sqlx migrate run
```

## Repository Layout

- `frontend/` - Next.js 16, React 19, TypeScript, Tailwind, Biome, Jest, Recharts
- `backend/` - Rust 1.95, Axum, SQLx, Redis, PostgreSQL, provider integrations, OpenTelemetry
- `docs/` - architecture, screenshots, compliance, and reference documents

## Coding Standards

- TypeScript: keep types precise, follow the existing hooks and service patterns, and use `tsc -b` for type checks.
- Rust: keep units small and testable, prefer idiomatic error handling, and use `cargo fmt` and `cargo clippy`.
- Tests: keep them in the existing test folders and update them when business logic changes.
- Secrets: never commit real secrets or `.env` files.

## Branches, Commits, and PRs

- Branch from `main` and keep PRs focused.
- Use Conventional Commits, for example `feat: add budgets summary chart` or `fix: handle empty transactions`.
- Use `feat!:` or `BREAKING CHANGE:` for breaking changes.
- Keep CI green before requesting review.
- Merge strategy is squash-and-merge on `main`.

## PR Checklist

- Feature or bug has a linked issue or a short rationale
- Code follows the existing patterns and keeps the blast radius small
- Tests were added or updated where needed
- The relevant validation commands pass locally
- No secrets or credentials were committed

## Troubleshooting

- Use `docker compose logs -f <service>` for logs.
- Use `docker compose down -v` to reset local data.
- Redis is required for the backend to start in Docker.
- Validate end-to-end behavior through either `http://localhost:3001` or `http://localhost:8080`.

## Environment Variables

Set the values you actually need in [`.env.example`](.env.example). Everything else is defined in Docker Compose.

Required values:

- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `POSTGRES_PASSWORD`

Plaid values when using Plaid:

- `PLAID_CLIENT_ID`
- `PLAID_SECRET`

Teller values when using Teller:

- `TELLER_APPLICATION_ID`

SimpleFIN:

- `SIMPLEFIN_SETUP_TOKEN` (one-time bridge setup token; claim from [beta-bridge.simplefin.org/info/developers](https://beta-bridge.simplefin.org/info/developers) for local trials)
- `DEFAULT_PROVIDER=simplefin` when SimpleFIN is the default onboarding provider

Optional values:

- `NGROK_AUTHTOKEN`
- `NGROK_URL`
- `SEQ_PASSWORD`
- `SEQ_API_KEY`
- `CLEAR_SESSIONS_ON_BOOT` set to `true` only when you intentionally want backend startup to invalidate all active sessions

## Authentication Rate Limiting

Login and register under `/api/auth/` are rate limited in the Axum backend with progressive lockouts after repeated 429s. Nginx also applies a looser edge limit on `/api/auth` so only unusually high request rates are rejected before proxying to the backend.

## Teller Setup

1. Create a Teller developer account at [https://teller.io](https://teller.io).
2. Download the mTLS certificate and private key.
3. Set `TELLER_APPLICATION_ID`.
4. Open Teller from the UI to link accounts.

## Sandbox Credentials

Use these provider test credentials for local sandbox flows:

- SimpleFIN
  - Sign in as `simplefin@test.com` / `Test1234!`, set `DEFAULT_PROVIDER=simplefin` and `SIMPLEFIN_SETUP_TOKEN` (demo token from [beta-bridge.simplefin.org/info/developers](https://beta-bridge.simplefin.org/info/developers)), start the stack, then connect in onboarding.
- Teller
  - Sumurai login: `teller@test.com` / `Test1234!`
  - Teller Connect sandbox (when prompted): `username` / `password`
- Plaid
  - Sumurai login: `plaid@test.com` / `Test1234!`
  - Plaid Link sandbox (when prompted): `user_good` / `pass_good`

If a sandbox provider prompts for 2FA, click through with empty fields.

For sandbox testing, allow the local origin in your Teller dashboard.

## HTTPS with Let's Encrypt

See [docs/PRODUCTION_TLS.md](docs/PRODUCTION_TLS.md) for the current production TLS workflow.

## License and Contributions

By contributing, you agree your contributions are licensed under the project’s license. See `LICENSE` for details.

If you are unsure about scope or approach, open a draft PR early or start a discussion in the issue tracker.
