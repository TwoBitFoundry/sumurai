# Contributing to Sumurai

Thanks for helping improve Sumurai. This guide covers the current workflow, local validation commands, and the conventions used in this repository.

> Heads-up: both `http://localhost:8080` and `http://localhost:3001` support end-to-end validation locally. `8080` runs through Nginx; `3001` uses Next dev rewrites to proxy `/api` and `/health` to the backend.

## Prerequisites

- Node 24.10+ and Bun 1.3.14+
- Rust stable and Cargo
- Docker and Docker Compose
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

**`bun run precommit` (Husky):** frontend **Biome check**, `typecheck`, **design guard**, and **`bun test`**, then **`bun run backend:ci`**. It does **not** run `bun install` in `frontend/`, Storybook static build, Vitest browser tests, or Playwright iframe smoke. Typecheck already includes `*.stories.tsx` under `src/` with the app.

For **full parity** with `.github/workflows/ci.yml` frontend steps before you push (for example Storybook/Vite/Playwright paths), run **`bun run backend:ci && bun run frontend:ci`** manually.

**Draft pull requests:** the **`ci`** workflow **does not** run GitHub-hosted jobs while the PR is marked draft. Mark the PR ready for review to trigger it (aside from what you run locally with `bun run precommit`). **CodeQL** runs on a weekly schedule only, not on pull requests.

On GitHub, backend or frontend jobs can be **skipped per path filters**; `precommit` still runs **both** stacks locally.

**If you only changed one side**, you can narrow scope while developing:

```bash
bun run backend:ci
```

```bash
bun run frontend:ci
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

Dev compose uses separate Postgres/Redis volumes (`postgres_data_dev`, `redis_data_dev`) from the default OSS stack (`postgres_data_oss`, `redis_data_oss`). The first run after switching stacks starts with a fresh database. Only the dev stack sets `SEED_DEMO_USER=true`, which recreates the demo account and workspace on startup. The dev backend image is built with the `dev-seed` Cargo feature so local development uses password auth instead of passkeys. The dev frontend sets `NEXT_PUBLIC_PASSWORD_AUTH=true` at build time (docker compose) and in the `bun run dev` script. The default OSS compose stack does not seed demo data and requires passkeys.

For the **production-oriented** stack with Seq, use `docker-compose.prod.yml`, [docs/PRODUCTION_TLS.md](docs/PRODUCTION_TLS.md), and [docs/PRODUCTION_BILLING.md](docs/PRODUCTION_BILLING.md) for Paddle billing setup.

Demo credentials (dev compose): `me@test.com` / `Test1234!`

## Frontend Development

`frontend/package.json` is the canonical frontend command surface. From the repo root, use the thin wrappers:

```bash
bun run frontend:build
bun run frontend:test
bun run frontend:typecheck
bun run frontend:lint
```

Or directly in `frontend/`:

```bash
cd frontend
bun install
bun run dev
bun run build
bun run test
```

- `bun run dev` starts the Next.js dev server on `http://localhost:3001`.
- `http://localhost:3001` proxies `/api` and `/health` to the backend for local end-to-end flows.
- `http://localhost:8080` remains the Nginx-backed integrated stack.
- Supported local host platforms are macOS, Linux, and Windows through Docker Compose.

### Storybook

Component stories live under `frontend/src` as `*.stories.tsx`. From the repo root:

```bash
bun run storybook
bun run storybook:build
bun run frontend:storybook-test
```

The root Storybook commands delegate to `frontend/` (same as `cd frontend && bun run …`). `storybook` serves `http://localhost:6006`. `storybook:build` writes `frontend/storybook-static` (used by CI Storybook iframe smoke tests). `frontend:storybook-test` runs the Storybook Vitest project from the repo root. Storybook MCP needs Storybook running first; see `AGENTS.md`.

## Backend Validation

Run backend validation from the repository root (workspace lockfile is `Cargo.lock`):

```bash
bun run backend:ci
```

Or run individual steps:

```bash
cargo fmt -p sumurai-backend -p entity --check
cargo check --workspace --locked --all-targets
cargo clippy -p sumurai-backend -p entity --locked --all-targets --no-deps -- -D warnings
cargo test -p sumurai-backend --locked
```

## Backend Docker image

The backend image is built from the **repository root** (not `backend/` alone). Compose and CI use `docker build -f backend/Dockerfile .`.

The Rust workspace lockfile is **`Cargo.lock`** at the repo root. Workspace members are `backend`, `backend/entity`, `backend/migration`, and `cli`.

[`backend/Dockerfile`](backend/Dockerfile) uses [cargo-chef](https://github.com/LukeMathWalker/cargo-chef) to cache dependency compilation:

1. **Planner** — copies root `Cargo.toml` / `Cargo.lock`, workspace crate manifests, and minimal `src` stubs (not application source), then runs `cargo chef prepare`.
2. **Builder** — `cargo chef cook` from `recipe.json`, then copies full `backend/` and `cli/` sources and builds `sumurai-backend`, `migration`, and `sumurai` binaries.
3. **Runtime** — ONNX assets plus the release binaries and entrypoint scripts.

Only manifest or lockfile changes should invalidate the planner/cook layers; ordinary Rust edits in `backend/src/` rebuild in the final `cargo build` step.

Local dev stack: `docker compose -f docker-compose.dev.yml up -d --build` rebuilds from source. Published images are built by `.github/workflows/publish-images.yml` after semantic-release tags a release.

## Working with the database

Schema and migrations live in `backend/migration/` (migrations) and `backend/entity/` (entities). **All schema application runs through Docker Compose** — `backend/scripts/docker-entrypoint.sh` runs `docker-migrate.sh` (legacy SQLx cutover or fresh schema), then the backend applies pending migrations via `Migrator::up` in `backend/src/main.rs`.

Do not run `cargo run -p migration` against a legacy SQLx database outside Compose.

### Add a migration

1. Update or add entities in `backend/entity/src/` first (schema source of truth).
2. Scaffold the migration with SeaORM CLI (registers the module in `backend/migration/src/lib.rs`):

   ```bash
   sea-orm-cli migrate generate <name> -d backend/migration --local-time
   ```

3. Implement `up`/`down` with SeaORM builders — prefer `Schema::create_table_from_entity`, `entity::*::Column`, and `ActiveModel` inserts. Reserve `execute_unprepared` for RLS policy DDL the builder cannot express.
4. Apply via Docker: `docker compose -f docker-compose.dev.yml up -d --build`
5. Regenerate entities from the migrated database (see below)

Example migration skeleton:

```rust
use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Users::Table)
                    .add_column(ColumnDef::new(Users::Nickname).string().null())
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Users::Table)
                    .drop_column(Users::Nickname)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum Users {
    Table,
    Nickname,
}
```

### Regenerate entities

After a migration is applied through Docker, point `sea-orm-cli` at that database:

```bash
cargo install sea-orm-cli --locked
sea-orm-cli generate entity \
  --database-url "$DATABASE_URL" \
  --output-dir backend/entity/src \
  --entity-format dense
```

Use the same `DATABASE_URL` as the dev stack (for example from `.env.example` and your local compose env). Run this from a machine that can reach Postgres, or exec into the backend container after `docker compose -f docker-compose.dev.yml up -d --build`.

Review generated `Relation` impls; hand-edit only when the generator misses a composite or polymorphic link. Re-export modules from `backend/entity/src/prelude.rs` if you add tables.

### Write queries

- Tenant-scoped reads/writes go through `PostgresRepository::with_tenant` and use entity DSL inside the closure (`entity::transaction::Entity::find()`, etc.).
- Convert `entity::Model` to domain types via `backend/src/models/conversions.rs` — handlers and services never import `entity::*`.
- When the DSL is insufficient (complex CTEs, aggregates), use the escape hatch in `repository_service.rs`:

```rust
Model::find_by_statement(Statement::from_sql_and_values(
    DbBackend::Postgres,
    r#"SELECT …"#,
    vec![…],
))
```

Document why the escape hatch was needed in the PR.

### Column walkthrough (end to end)

1. Add a migration file and register it in `Migrator::migrations()`.
2. Apply via Docker: `docker compose -f docker-compose.dev.yml up -d --build backend`
3. Regenerate entities (see **Regenerate entities** above).
4. Use the new `Column` variant in `repository_service.rs` (inside `with_tenant` when tenant-scoped).
5. Add or extend a `From<entity::…::Model>` mapping in `conversions.rs` if the API exposes the field.
6. Run `cargo test -p sumurai-backend --locked` from the repository root.

## Recovery

If a user loses every enrolled passkey, an operator with database access can clear their credentials so the user is prompted to enroll again on the next sign-in. The user account and financial data are not deleted.

The `sumurai` CLI ships in the backend Docker image at `/app/sumurai`. It connects with `DATABASE_URL` using the same superuser connection as migrations, so it bypasses row-level security for operator maintenance.

```bash
docker compose -f docker-compose.dev.yml exec backend /app/sumurai reset-passkeys user@example.com
```

You can pass an email address or the user's UUID. On success the command prints:

`Passkeys cleared for user@example.com. User will be prompted to enroll a new passkey on next sign-in.`

If no matching user exists, the command exits with a non-zero status and an error message.

For local development without Docker, build the CLI from the repository root and point it at Postgres:

```bash
cargo build --release -p sumurai-cli
DATABASE_URL=postgres://… ./target/release/sumurai reset-passkeys user@example.com
```

## Repository Layout

- `frontend/` - Next.js 16, React 19, TypeScript 6, Tailwind 4, Biome 2, Recharts 3
- `backend/` - Rust 1.95, Axum, SeaORM, Redis, PostgreSQL, provider integrations, OpenTelemetry
- `cli/` - operator CLI (`sumurai reset-passkeys`, …)
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

Use these sandbox credentials for local provider flows with `me@test.com` / `Test1234!`:

- SimpleFIN
  - Start the stack, choose SimpleFIN in the provider picker, and paste a setup token from [beta-bridge.simplefin.org/info/developers](https://beta-bridge.simplefin.org/info/developers) when prompted. The shared beta demo bridge works with any account.
- Teller
  - Teller Connect sandbox (when prompted): `username` / `password`
- Plaid
  - Plaid Link sandbox (when prompted): `user_good` / `pass_good`

If a sandbox provider prompts for 2FA, click through with empty fields.

For sandbox testing, allow the local origin in your Teller dashboard.

## HTTPS with Let's Encrypt

See [docs/PRODUCTION_TLS.md](docs/PRODUCTION_TLS.md) for the current production TLS workflow.

## License and Contributions

By contributing, you agree your contributions are licensed under the project’s license. See `LICENSE` for details.

If you are unsure about scope or approach, open a draft PR early or start a discussion in the issue tracker.
