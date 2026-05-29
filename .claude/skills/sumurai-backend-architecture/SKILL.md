---
name: sumurai-backend-architecture
description: Use when working on Sumurai backend Rust, Axum APIs, SeaORM, Redis, auth, providers, services, models, migrations, middleware, OpenAPI, telemetry, or backend architecture. Guides agents to preserve service/model/provider separation.
---

# Sumurai Backend Architecture

Use this skill for backend implementation, refactors, reviews, and architecture decisions.

## Required Reads

Read the relevant reference before backend changes:

- Backend structure: `references/backend-map.md`
- Architecture rules: `references/backend-rules.md`

## Operating Rules

- Keep models in `backend/src/models`.
- Keep business logic in `backend/src/services`.
- Keep provider-specific external integration code in `backend/src/providers`.
- Keep HTTP routing and request/response glue in handlers, `middleware/`, `auth_middleware.rs`, and `main.rs`.
- Keep environment-driven configuration types and loading in `config.rs`.
- Keep database schema changes in forward migrations under `backend/migration/src/`.
- Keep tests in `backend/src/tests`.
- Preserve Redis as a required backend dependency.
- Do not read or write `.env` files.
- Do not add comments to source code.

## Workflow

1. Identify the backend boundary: model, service, provider, middleware, handler, migration, or OpenAPI.
2. Inspect nearby patterns before adding new abstractions.
3. Put business rules in services, not handlers.
4. Keep provider adapters behind existing provider traits and registries.
5. Update OpenAPI schemas/tags when API shapes change.
6. Add focused tests in `backend/src/tests`.

## Validation

Match local checks to `bun run backend:ci` from the repository root (locked workspace graph, same as GitHub):

- `cargo fmt -p sumurai-backend -p entity --check`
- `cargo check --workspace --locked --all-targets`
- `cargo clippy -p sumurai-backend -p entity --locked --all-targets --no-deps -- -D warnings`
- `cargo test -p sumurai-backend --locked`

`bun run backend:ci` runs the same steps and sets `RUST_BACKTRACE=1` for the test invocation only.
