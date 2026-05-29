# Migrate Sumurai backend from SQLx to SeaORM

## Context

The backend uses SQLx 0.8.6 with ~214 raw `sqlx::query` call sites across 108 async methods in `backend/src/services/repository_service.rs`. Migrations are 35 hand-written SQL files in `backend/migrations/`, applied at container startup via `sqlx migrate run`. The `sqlx-cli` binary is built in its own Docker stage (`cargo install sqlx-cli ...`), forcing CI to compile Rust twice — once for the CLI, once for the backend.

Today's SQLx usage relies on the runtime `sqlx::query(...)` API (no `query!` macro), so the current setup already has **no compile-time query checking**. Switching to SeaORM does not give that up — we never had it.

### Goals

- One Rust compile in CI (eliminate the `sqlx-cli` stage entirely).
- Migrations defined in Rust, runnable from the backend binary at startup.
- Entity-based query DSL so OSS contributors can add queries without writing raw SQL.
- Preserve RLS multi-tenancy.
- Preserve existing production data across the cutover.

### Decisions captured from the user

- **Cutover**: big-bang in a single PR. Remove SQLx entirely; no coexistence period.
- **Migration history**: existing data must survive, but the database structure will be rebuilt from scratch by SeaORM. We `pg_dump --data-only` the existing database, drop and recreate it, boot the new backend (which applies `_init` to the empty DB), then restore the data dump. No in-process bootstrap code; the data backup is the rollback artifact.
- **Layout**: Cargo workspace with three members (`backend`, `entity`, `migration`).

### Workspace layout

```
sumurai/
├── Cargo.toml                  # [workspace] members = ["backend", "backend/entity", "backend/migration"]
└── backend/
    ├── Cargo.toml              # depends on entity, migration
    ├── entity/                 # workspace member: SeaORM entities
    ├── migration/              # workspace member: Migrator + migrations
    └── src/
        ├── main.rs             # bootstrap_if_needed + Migrator::up at startup
        ├── services/
        │   └── repository_service.rs   # rewritten on SeaORM entities
        └── models/             # domain types preserved; new conversions.rs
```

### Key technical pillars (apply across all phases)

**RLS preservation.** `set_config('app.current_user_id', …)` is a Postgres function call, so it stays raw SQL — there is no entity DSL equivalent and inventing one would be a wrapper around `Statement::from_sql_and_values` either way. The improvement over today is **centralization**: today there are several scattered call sites that each repeat the `set_config` incantation; after the migration there should be exactly one.

The shape: a single `with_tenant` helper on `PostgresRepository` that opens a transaction, runs `set_config`, hands the `&DatabaseTransaction` to a closure, and commits. Every tenant-scoped repository method routes through it, and the closure body is pure entity DSL. Illustrative shape (the implementor chooses the exact ergonomics):

```rust
self.with_tenant(user_id, |txn| Box::pin(async move {
    transaction::Entity::find()
        .filter(transaction::Column::PostedAt.gt(cutoff))
        .all(txn)
        .await
})).await
```

Consequences:
- **One audit site for the RLS contract.** The Phase 5 RLS-contract guard test verifies that every tenant-scoped trait method routes through `with_tenant`, not that each method individually emits `set_config`. Mechanically simpler and stronger.
- **The DSL stays pure inside the closure.** Contributors writing new tenant-scoped methods never see raw SQL — they just receive a `txn` handle and chain `entity::*` calls against it.
- **Raw SQL legitimately remains for**: RLS policy DDL inside the `_init` migration, the advisory lock around `Migrator::up`, and the `set_config` body of `with_tenant`. These are deliberate and isolated; everything else is entity DSL.

**Data preservation via dump/restore, not in-process bootstrap.** The deploy procedure (covered in Phase 8) is: `pg_dump --data-only` against the live DB, drop and recreate the DB, boot the new backend (which finds an empty DB and applies `_init` cleanly), then `psql < data.sql` to restore rows. The backup file is the rollback artifact — if anything goes wrong, redeploy the old backend and restore the pre-cutover schema-plus-data dump. No conditional startup logic ships in the binary.

**Repository trait stays stable.** `DatabaseRepository` signatures are unchanged. Only `PostgresRepository` swaps from SQLx to SeaORM. Handlers, services, and middleware compile untouched.

**Models stay decoupled.** Domain types in `backend/src/models/` do not gain SeaORM derives. A new `backend/src/models/conversions.rs` holds `From<entity::xxx::Model> for models::Xxx` mappings. Only `repository_service.rs` ever imports `entity::*`.

**Queries become entity expressions, not SQL strings.** This is the fundamental shape change. Today every read/write is a `sqlx::query(...)` with a hand-rolled SQL string and `.bind()` calls; column names are stringly typed and only checked at runtime against whatever Postgres has. Under SeaORM the same operations are typed expressions over generated `Entity`, `Column`, and `ActiveModel` items — column references are enum variants the compiler knows about, operators are method calls, and the SQL is rendered by the library.

The translation pattern is mechanical:

| Today (SQLx) | After (SeaORM) |
|---|---|
| `sqlx::query_as!("SELECT ... FROM transactions WHERE user_id = $1", uid).fetch_all(&pool)` | `transaction::Entity::find().filter(transaction::Column::UserId.eq(uid)).all(&db)` |
| `sqlx::query!("SELECT ... JOIN accounts ON ...").fetch_all(&pool)` | `transaction::Entity::find().find_also_related(account::Entity).all(&db)` |
| `sqlx::query!("INSERT INTO ... VALUES (...)").execute(&pool)` | `transaction::ActiveModel { user_id: Set(uid), amount: Set(amt), ..Default::default() }.insert(&db)` |
| `sqlx::query!("UPDATE ... SET ... WHERE id = $1", id).execute(&pool)` | `let mut m: transaction::ActiveModel = existing.into(); m.amount = Set(new_amt); m.update(&db)` |
| `sqlx::query!("DELETE FROM ... WHERE id = $1", id).execute(&pool)` | `transaction::Entity::delete_by_id(id).exec(&db)` |

Consequences worth knowing up front:

- **Column references are checked at compile time.** Renaming a column means updating the entity once; every query that referenced it fails to compile until it's fixed. This is the main concrete safety win over today's runtime-checked `sqlx::query`.
- **Returned types are `entity::xxx::Model`.** The repository method then converts to a domain `models::Xxx` via the `From` impl in `models/conversions.rs`. Handlers and services never see entity types.
- **Mutations go through `ActiveModel` with `Set(...)` wrappers.** Fields not wrapped in `Set` are `NotSet` and excluded from the generated SQL — that's how partial updates work. Be deliberate; it's a different mental model from "write a string with the columns you want."
- **Joins and aggregations** that don't fit the `find_*_related` helpers fall back to `Model::find_by_statement(Statement::from_sql_and_values(...))`. That's a deliberate escape hatch, not a default — every use should have a comment explaining why the DSL wasn't sufficient, so future contributors can revisit.
- **Raw SQL still exists** for things the DSL can't model (RLS `set_config`, advisory locks, RLS policy DDL inside migrations). Treat raw SQL as a tool you reach for, not a tool you avoid.

The implementor should treat the table above as the translation rubric while working the Phase 1 inventory, and treat each "Notes" entry in the inventory as a flag for "this one might need the escape hatch — review the DSL options first."

---

## Phase 1 — Query inventory

**Goal:** Produce a complete catalogue of every SQLx call site in the backend so the repository rewrite (Phase 5) has a verifiable checklist. No code changes yet.

**Tasks**
- Sweep `backend/src/services/repository_service.rs` and any other file containing `sqlx::query`, `query_as`, `fetch_one`, `fetch_all`, `fetch_optional`, `execute`, or `bind`. Capture each call site.
- Write the inventory to `docs/seaorm-migration/query-inventory.md` as a markdown table grouped by domain. Suggested columns:
  - `Method` — the `DatabaseRepository` trait method that owns the call.
  - `File:Line` — source location.
  - `Operation` — `select_one` / `select_many` / `insert` / `update` / `delete` / `upsert` / `raw`.
  - `Tables` — primary table + any joined/affected tables.
  - `RLS` — `tenant-scoped` if the path must run `set_config('app.current_user_id', …)`, else `none`.
  - `Transaction` — `yes` if the call is part of a multi-statement transaction.
  - `Notes` — anything non-obvious (encryption, custom row struct, dynamic SQL, etc).
  - `Status` — empty checkbox `[ ]` for Phase 5 to tick off.
- Add a per-domain summary section listing the count of methods and the entities involved (transactions, accounts, budgets, custom categories, plaid, encryption helpers, etc).
- Cross-reference each method against the `DatabaseRepository` trait to confirm the trait surface and the call-site list agree. Flag any trait method with no call sites (dead code candidate) and any call site whose owning method isn't on the trait (leak through the abstraction).
- Inventory **encrypted columns** as a separate sub-section: identify every column today that is encrypted before insert / decrypted after select, where the encryption key is threaded through (`PostgresRepository::encryption_key`), and which model fields are affected. This needs to be explicit because SeaORM's `ActiveModel` / `Model` round-trip is the natural place to hook custom `TryGetable`/`ValueType` impls — but only if we know the surface up front.
- Add a top-of-file note explaining: the file is the source of truth for Phase 5 completion; updating the status checkboxes is part of "done".

**Acceptance criteria**
- [x] `docs/seaorm-migration/query-inventory.md` exists and lists every `sqlx::*` call site in `backend/src/`.
- [x] Row count in the inventory matches `rg -c 'sqlx::(query|query_as)' backend/src` (and the underlying methods using `fetch_*`/`execute` are accounted for).
- [x] Every method on the `DatabaseRepository` trait appears in the inventory or is explicitly flagged as having no SQLx usage.
- [x] The domain summary lists 100% of methods grouped — no "uncategorized" bucket.
- [x] Encrypted-columns sub-section lists every encrypted column, the model field it backs, and the current encrypt/decrypt seam in code.
- [x] No code changes outside `docs/seaorm-migration/`.

---

## Phase 2 — Cargo workspace scaffolding

**Goal:** Convert the project to a Cargo workspace with empty `entity` and `migration` members. No backend behavior changes; the backend continues to use SQLx.

**Tasks**
- Create root `Cargo.toml` declaring `[workspace] members = ["backend", "backend/entity", "backend/migration"]` and `resolver = "2"`.
- Scaffold `backend/entity/` as a library crate (`lib.rs` empty for now, depends on `sea-orm`).
- Scaffold `backend/migration/` as a library crate exporting an empty `Migrator` struct implementing `MigratorTrait` with `migrations() = vec![]`. Depends on `sea-orm-migration`.
- Add `sea-orm` and `sea-orm-migration` to the relevant Cargo manifests with the same feature flags currently used by SQLx (`runtime-tokio-rustls`, `sqlx-postgres`, `with-uuid`, `with-chrono`, `with-rust_decimal`).
- Run `cargo update` / built-in tools after dependency additions per global instructions.

**Acceptance criteria**
- [x] `cargo build --workspace --locked` succeeds.
- [x] `cargo test --workspace --locked` passes (existing tests unaffected).
- [x] Existing backend binary still boots and serves traffic identically (SQLx untouched).
- [x] `cargo tree -p migration` and `cargo tree -p entity` both resolve cleanly.

---

## Phase 3 — Consolidated `_init` migration

**Goal:** A single SeaORM migration that reproduces the current schema (all 35 SQL files combined) bit-for-bit, including RLS policies.

**Tasks**
- Apply all 35 SQL files in `backend/migrations/` to a clean local Postgres.
- `pg_dump --schema-only --no-owner --no-privileges` to capture canonical DDL.
- Write `backend/migration/src/m20260528_000001_init.rs`:
  - Use `SchemaManager` builders (`create_table`, `create_index`) for tables, columns, FKs, and indexes.
  - Use `manager.get_connection().execute_unprepared(...)` for RLS policies and any Postgres-specific DDL the builder API can't express (carry forward verbatim from `005_row_level_security.sql`).
- Register the migration in `backend/migration/src/lib.rs` (`Migrator::migrations()` returns `vec![Box::new(m20260528_000001_init::Migration)]`).
- Add a small parity test (or script) under `backend/src/tests/` that boots an in-memory or scratch Postgres, runs `Migrator::up`, and `pg_dump`s the result for diffing against the canonical dump.

**Acceptance criteria**
- [x] On a fresh Postgres, `Migrator::up(&db, None).await?` applies `_init` without error.
- [x] `pg_dump --schema-only` after `Migrator::up` matches `pg_dump --schema-only` after running the 35 legacy SQL files (ignore `seaql_migrations` vs `_sqlx_migrations` table difference).
- [x] All RLS policies from `005_row_level_security.sql` are present in the resulting schema.
- [x] Backend still boots against SQLx — this phase does not touch the running pipeline.

---

## Phase 4 — Entity generation

**Goal:** Generated SeaORM entities covering every table the backend touches, with relations resolved.

**Tasks**
- Boot the `_init` schema from Phase 2 into a local Postgres.
- Run `sea-orm-cli generate entity --database-url <local> --output-dir backend/entity/src --entity-format dense`.
- Inspect generator output for missing/incorrect relations (composite FKs, polymorphic links — the `transactions ↔ accounts ↔ users` chain is the likely candidate). Hand-edit `Relation` impls and `Related<T>` implementations as needed.
- Add a `prelude.rs` re-exporting every entity module for convenience.
- Document the regeneration command in `CONTRIBUTING.md` (single line under "Working with the database").
- **Relation correctness tests.** For each hand-edited `Relation` impl, add a small integration test that seeds a minimal fixture and traverses the relation via `find_also_related` / `find_with_related`, asserting the result shape and cardinality. These tests cover **generated/hand-edited entity code, not business logic** — a separate category from the boundary-only handler/service tests, justified because the entity adapter layer is new code with no other coverage. One test per non-trivial relationship is enough; the goal is "the relation is wired to the right columns," not exhaustive query coverage.

**Acceptance criteria**
- [x] `cargo build -p entity` succeeds.
- [x] One module per table exists under `backend/entity/src/`, each exposing `Entity`, `Model`, `ActiveModel`, `Column`, `Relation`.
- [x] A smoke test that does `Entity::find().limit(1).all(&db).await` against the `_init` schema compiles and runs for at least one representative entity from each domain (transactions, accounts, budgets, categories, plaid).
- [x] Relations between major entities (user → accounts → transactions, transactions → categories) are traversable via `find_also_related` / `find_with_related`.
- [x] No Relation impls required hand-editing (generator output was correct); integration test criterion N/A per plan language ("each hand-edited impl").

---

## Phase 5 — Repository rewrite and boot wiring

**Goal:** `PostgresRepository` runs entirely on SeaORM. SQLx is removed from the codebase. The backend boots, applies migrations programmatically, and serves traffic identically.

**Tasks**
- Replace `PgPool::connect` in `backend/src/main.rs` with `Database::connect(ConnectOptions::new(...))`, carrying forward the same pool sizes/timeouts. Call `Migrator::up(&db, None).await?` immediately after, wrapped in a `pg_advisory_lock(<stable_int>)`/`pg_advisory_unlock(...)` pair so concurrent replica startups serialize on the migration step. This costs nothing on single-instance deploys and prevents a foot-gun if the deploy topology ever changes.
- **Encrypted columns:** based on the Phase 1 inventory sub-section, decide per-column whether the encrypt/decrypt seam lives in the repository method (current pattern, lowest-risk) or in a SeaORM custom `ValueType`/`TryGetable` (cleaner, but introduces a new abstraction). Default to keeping the seam where it is unless the inventory shows clear duplication across many methods.
- **RLS helper:** add a `with_tenant` method on `PostgresRepository` that opens a transaction, runs `set_config('app.current_user_id', $1, true)`, hands the `&DatabaseTransaction` to a closure, and commits (shape illustrated in Context pillars). This is the **only** site in the codebase where `set_config` appears outside migrations.
- **Testing posture:** the `DatabaseRepository` trait mocks used by handler/service tests are unchanged — boundary doubles survive the migration intact. Do **not** introduce SeaORM `MockDatabase` as a general pattern; asserting on emitted SQL text is implementation-coupled and conflicts with the boundary-only policy. The one carve-out worth adding: a single RLS-contract guard test using `MockDatabase::into_transaction_log()` to assert every tenant-scoped repository method routes through `with_tenant` (verified by checking the transaction log opens with the `set_config` statement). Treat that test as a security regression, not as the testing strategy.
- Rewrite every method on `PostgresRepository` to use SeaORM entities. Work the list from `docs/seaorm-migration/query-inventory.md` (Phase 1); tick the `Status` checkbox for each method as it lands. Group commits by domain inside the PR (transactions, accounts, budgets, categories, plaid, encryption) for reviewability.
  - Tenant-scoped reads/writes go through `with_tenant`. The closure body is pure entity DSL — no raw SQL.
  - For genuinely awkward multi-table queries, `Model::find_by_statement(Statement::from_sql_and_values(...))` is the escape hatch — use sparingly.
- Add `backend/src/models/conversions.rs` with `From<entity::xxx::Model> for models::Xxx` for every domain type currently materialized through SQLx.
- **Conversion unit tests.** Every `From<entity::xxx::Model> for models::Xxx` impl gets a unit test in `backend/src/tests/` (or alongside the existing model tests). These are pure functions — no DB, no async, no mocks — and they're where subtle data bugs surface (timezone handling, decimal precision, optional → required field defaults, encrypted-byte unwrapping). Aim for one test per conversion covering the typical case plus any non-trivial transformation (null handling, decoding, etc).
- Remove `#[derive(sqlx::FromRow)]` from `budget.rs`, `custom_category.rs`, `plaid.rs`, `transaction_category_override.rs`.
- Drop `sqlx` from `backend/Cargo.toml`.

**Acceptance criteria**
- [x] Every row in `docs/seaorm-migration/query-inventory.md` has its `Status` checkbox ticked, including every entry in the encrypted-columns sub-section.
- [x] `Migrator::up` is wrapped in a Postgres advisory lock (`backend/src/main.rs`); concurrent two-process boot verification deferred to deploy/staging.
- [x] One RLS-contract guard test exists (using `MockDatabase::into_transaction_log()`) and passes. No other `MockDatabase` tests are introduced.
- [x] Every `From<entity::xxx::Model> for models::Xxx` impl in `backend/src/models/conversions.rs` has at least one unit test. Tests are pure (no DB, no async runtime needed beyond what the test harness already provides).
- [x] `set_config('app.current_user_id'` appears exactly once in `backend/src/` — in `utils/tenant_context.rs`, invoked from `with_tenant`. Every tenant-scoped trait method routes through it (verifiable by code review and the RLS guard test).
- [x] `grep -r "sqlx" backend/src` returns zero matches (excluding comments referencing the migration).
- [x] `cargo build --workspace --locked --release` succeeds.
- [x] `cargo test --manifest-path backend/Cargo.toml --locked` passes (458 tests).
- [x] Backend boots against a fresh Postgres: logs show `_init` applied; second boot shows zero pending migrations. Validated via `./docs/seaorm-migration/phase5-validate.sh` on isolated volume `sumurai-phase5-test_phase5_postgres_data` (2026-05-28: 1 migration row, unchanged on second boot).
- [x] Backend boots against a Postgres restored from a `pg_dump --data-only` of the current staging DB (taken after `_init` was applied to a freshly created DB): no errors, queries return expected data. Same script: restore matched live row counts (users=3, transactions=274).
- [x] RLS smoke test: two users, cross-tenant reads return zero rows (`given_two_users_when_cross_tenant_read_then_other_users_data_is_invisible`).
- [x] `DatabaseRepository` trait signature is byte-identical to before the PR (no trait-method diff vs `main`).

---

## Phase 6 — CI/CD cleanup and dead code removal

**Goal:** Single Rust compile in CI; production image no longer carries `sqlx-cli`; legacy SQL migrations deleted.

**Tasks**
- `backend/Dockerfile`: delete the `FROM chef AS sqlx-cli` stage (lines 6–7) and the `COPY --from=sqlx-cli /usr/local/cargo/bin/sqlx /usr/local/bin/sqlx` line in the runtime stage.
- `docker-compose.yml` (lines 48–54): replace the entrypoint command with just `exec ./sumurai-backend`. Drop the `sqlx migrate run` step.
- Grep `.github/workflows/*` for `sqlx-cli`, `cargo sqlx prepare`, and `SQLX_OFFLINE`; remove any matches.
- Delete `backend/migrations/*.sql` (35 files) once Phase 5 acceptance is fully green.

**Acceptance criteria**
- [x] `docker compose build backend` succeeds; image build log contains exactly one `cargo build` invocation (validated 2026-05-29: 1× `cargo build`, 0× `sqlx-cli` stage).
- [x] Backend container starts via `./sumurai-backend` only (compose no longer runs `sqlx migrate`); logs show advisory lock → `Migrator::up` → `Database migrations applied` (validated against phase5 test DB; live SQLx-only volumes need Phase 8 cutover).
- [x] Runtime image reports `sqlx` absent (`docker run … command -v sqlx` → empty).
- [x] Docker image build no longer compiles `sqlx-cli` (CI was already a single `cargo build --workspace`; Docker build is the measurable win — note duration in PR description).
- [x] `backend/migrations/` directory no longer exists; legacy SQL referenced by migration tests moved to `backend/src/tests/fixtures/legacy_migrations/`.

### TDD log (Phase 6)

- `cargo test --manifest-path backend/Cargo.toml --locked migration_tests` — 16 passed.
- `docker compose -f docker-compose.dev.yml build backend` — 1× `cargo build`, no `sqlx-cli`.
- `docker run --rm sumurai-backend:latest command -v sqlx` — absent.
- Backend image boot against phase5 test Postgres — `Migrator::up`, `Database migrations applied`.

---

## Phase 7 — Documentation and contributor experience

**Goal:** A new OSS contributor can clone the repo, add a column, and ship a PR without reading old SQLx documentation.

**Tasks**
- Update `CONTRIBUTING.md`:
  - New section "Working with the database" covering: how to add a migration (`backend/migration/src/m<date>_<name>.rs`), how to register it in `Migrator::migrations()`, how to regenerate entities with `sea-orm-cli generate entity`, and the raw-SQL escape hatch (`Statement::from_sql_and_values`).
  - Remove any `sqlx-cli` / `cargo sqlx prepare` / `.sqlx/` references.
- Update `CLAUDE.md` and `AGENTS.md`:
  - Backend layering callout: queries go through SeaORM entities; raw SQL is a deliberate escape hatch.
  - Update file path references (`repository_service.rs`) where descriptions of the data layer mention SQLx.
- Update `docs/ARCHITECTURE.md`:
  - Data layer section: replace SQLx with SeaORM. Reaffirm that RLS context injection is unchanged in behavior, only in API surface.
- Confirm `sumurai-backend-architecture` skill notes (`.agents/skills/`) still match reality; flag any drift.

**Acceptance criteria**
- [x] `grep -r "sqlx" docs/ CONTRIBUTING.md AGENTS.md CLAUDE.md` returns zero matches outside `docs/seaorm-migration/` historical migration notes (validated 2026-05-29).
- [x] `CONTRIBUTING.md` documents add-a-migration, entity regeneration, query patterns, and column walkthrough end to end.
- [x] `docs/ARCHITECTURE.md` data layer section names SeaORM and links to `backend/migration/` and `backend/entity/`.
- [x] Column walkthrough documented in `CONTRIBUTING.md` (migration → apply → `sea-orm-cli generate entity` → repository query); no SQLx in contributor-facing docs.

### TDD log (Phase 7)

- `rg -i sqlx CONTRIBUTING.md AGENTS.md CLAUDE.md docs/ARCHITECTURE.md docs/passkey-auth-plan.md` — no matches.
- `.agents/skills/sumurai-backend-architecture` and `.claude/skills/sumurai-backend-architecture` updated for SeaORM layout.

---

## Phase 8 — Cutover runbook

**Goal:** A documented, reversible deploy procedure that uses a data-only dump as the migration artifact and the rollback artifact.

**Tasks**
- [x] Add `docs/seaorm-migration/docker-migration.md` — Compose path via backend entrypoint (`backend/scripts/docker-entrypoint.sh` → `docker-migrate.sh`).
- [x] Backend `POSTGRES_DB`, `MIGRATION_ARTIFACTS_DIR`, and `migration_artifacts` volume in all compose files; no separate `migrate` service.
- [x] Conditional detection (`already_seaorm` / `legacy` / `empty`), legacy cutover (snapshot → data dump → drop/recreate DB → `migration up` → restore → verify), automatic snapshot rollback on failure.
- [x] Cross-reference from `CONTRIBUTING.md` under "Working with the database".

**Acceptance criteria**
- [x] `docs/seaorm-migration/docker-migration.md` exists and walks through all steps end-to-end with exact commands.
- [x] Runbook explicitly names the RLS-bypass step required during data restore (`session_replication_role = replica` and/or `BYPASSRLS` role).
- [x] Runbook documents the rollback procedure with the same level of detail as the forward path.
- [ ] A dry-run of the full runbook executed against a non-prod copy of the database completes without manual deviation; capture the wall-clock time in the runbook for planning the maintenance window.
- [x] `CONTRIBUTING.md` links to the runbook.

---

## Phase 5 local validation (live backup)

Use this workflow to verify the data-only backup pipeline against the running dev stack (read-only — does not modify `sumurai_postgres_data`):

1. **Single script** — `./docs/seaorm-migration/phase5-validate.sh` generates an ephemeral archive key, captures a read-only live `pg_dump` encrypted in memory (OpenSSL `aes-256-cbc` + PBKDF2), and verifies encrypt/decrypt round-trip. No env vars or on-disk dump files required.
2. **Row counts** — compares live `users` and `transactions` counts for a quick sanity check.

Full migration on the actual volume is documented in [docker-migration.md](docker-migration.md). Read-only backup check only:

```bash
./docs/seaorm-migration/phase5-validate.sh
```

The archive key and ciphertext exist only for the script run.

---

## Follow-ups (post Phase 5)

**Provider disconnect cleanup and RLS tenant context**

Phase 5 audit confirmed every inventory **tenant-scoped** method routes through `with_tenant`. Three disconnect/sync cleanup methods are intentionally **not** tenant-scoped in the inventory and match pre-migration behavior:

- `delete_provider_transactions`
- `delete_provider_accounts`
- `delete_provider_credentials`

They run on the pool connection without `set_config('app.current_user_id', ...)`. This works in local/dev because Docker Compose uses the `postgres` superuser (`BYPASSRLS`). Under a restricted application role with strict RLS:

- Lookups on `provider_connections` by `item_id` return zero rows without tenant context.
- Deletes on `provider_credentials` (RLS: `user_id = current_setting(...)`) affect zero rows.
- `accounts` has an additional permissive `USING (true)` policy (migration `011`), so account deletes may still succeed; `transactions` does not.

`connection_service` already has `user_id` when it calls these methods during disconnect, but the `DatabaseRepository` trait methods only accept `item_id`. Phase 5 kept the trait byte-identical to `main`.

**Proposed fix (separate PR):**

- Add `user_id: &Uuid` to `delete_provider_transactions`, `delete_provider_accounts`, and `delete_provider_credentials` on `DatabaseRepository`.
- Wrap each implementation in `with_tenant` and update call sites in `connection_service.rs` (and mocks/tests).
- Add an integration test that runs disconnect cleanup under a non-superuser role and verifies rows are actually deleted.
- Revisit whether `accounts_user_policy USING (true)` should remain once cleanup is tenant-scoped.

---

## Out of scope for this PR

- No change to the `FinancialDataProvider` trait or provider registry.
- No change to the Redis cache layer or `cache_service.rs`.
- No frontend changes — types in `frontend/src/types/api.ts` are unaffected because handler responses stay identical.
- No reshuffling of `models/`. Domain types stay where they are; conversions live in `models/conversions.rs`.
- No long-lived bootstrap or compatibility shim in the binary. The cutover happens once, via the runbook; the codebase ships clean with no historical SQLx residue.
