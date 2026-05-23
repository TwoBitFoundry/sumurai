# SimpleFIN provider integration

## Context

Sumurai currently supports two financial-data providers — **Teller** and **Plaid** — behind a `FinancialDataProvider` trait + runtime registry, with `DEFAULT_PROVIDER` selecting the active one. We're adding **SimpleFIN Bridge** as a third option to expand bank coverage with a Bring-Your-Own-Key model that suits the self-hosted ethos.

SimpleFIN is structurally simpler than the others:

- The user picks and links banks **on simplefin.org**.
- They generate a base64-encoded **setup token** there.
- They paste it into Sumurai once. We claim that token for an **access URL** (the URL itself embeds basic-auth credentials).
- We poll `GET /accounts` for both balances and transactions. No link-token, no iframe, no popup. One access URL can return many bank "orgs" at once.

The integration must keep the trait/registry pattern intact so a fourth provider remains trivial to add. The onboarding screen needs a SimpleFIN-specific variant — text input for the setup token (no "Connect" iframe button), and once connected, a success badge showing **N institutions connected** computed from the orgs returned by `/accounts`.

### Decided in conversation

- Each SimpleFIN org → its own `provider_connections` row (mirrors Teller multi-enrollment).
- **Data retention rule: only keep what is implicitly allowed.** An org is implicitly allowed from the moment it first appears in `/accounts` until the user disconnects it. After disconnect it is no longer implicitly allowed: even if SimpleFIN keeps returning that org's connections, accounts, and transactions, we **must drop them at the sync boundary** and persist nothing — no row in `provider_connections`, no `accounts`, no `transactions`, no cached metadata. Enforced via a `simplefin_hidden_orgs` blocklist consulted before any write.

### SimpleFIN protocol facts that shape the design

Sources: <https://www.simplefin.org/protocol.html>, <https://beta-bridge.simplefin.org/info/developers>.

- **Setup token** = base64 of a claim URL. `POST` to it once → access URL `https://user:pass@host/path`. One-time use; reuse returns `403`.
- **Auth on subsequent calls** = HTTP Basic from the embedded creds.
- **`GET /accounts` query params:**
  - `start-date` — epoch, inclusive
  - `end-date` — epoch, exclusive
  - `pending=1` — include pending transactions
  - `balances-only=1` — omit transactions, return balances only
  - `account=<id>` — filter (repeatable)
- **`GET /accounts` response shape:**
  ```json
  {
    "errors": [],
    "connections": [{ "conn_id": "...", "name": "...", "org_id": "...", "org_url": "...", "sfin_url": "..." }],
    "accounts": [{
      "id": "...", "name": "...", "conn_id": "...", "currency": "...",
      "balance": "...", "available-balance": "...", "balance-date": 0,
      "transactions": [{ "id": "...", "posted": 0, "amount": "...", "description": "...", "pending": false, "transacted_at": 0, "extra": {} }]
    }]
  }
  ```
- **Rate limits:** `/accounts` shared quota is **24 requests/day**; transaction windows capped at **90 days**; per-account requests have a separate quota. Existing `TRANSACTIONS_TTL=30m` and `BANK_ACCOUNTS_TTL=2h` fit. We add a 1-hour floor between user-triggered SimpleFIN syncs.
- **Sandbox:** demo setup token at <https://beta-bridge.simplefin.org/info/developers>.
- **Rust client landscape:** `simplefin-bridge` v0.0.1 is stale and unmaintained. Write a thin `reqwest` client to match Plaid/Teller patterns.

---

## How to use this plan (for the implementing agent)

- **Strict TDD.** For every phase: write the failing test first, make it pass with the minimum code, refactor.
- **Boundary-only doubles.** Mock the HTTP boundary (`SimpleFinHttpClient`), the DB (where Plaid/Teller tests already do), and Redis. Do not mock the code under test or its internal collaborators.
- **Tests live in `frontend/tests/**` or `backend/src/tests/**`, never inline.**
- **One phase = one PR-sized commit** with a conventional-commit subject (`feat(simplefin): phase N — <goal>`). Do not roll phases together.
- **Stop and ask** if any acceptance criterion is ambiguous; do not silently relax it. The data-retention rule in particular is not negotiable.

---

## Phase 1 — Backend scaffold: config + registry entry

**Goal:** SimpleFIN exists in the registry and is a valid `DEFAULT_PROVIDER`, with no real HTTP yet. Trait methods are stubbed.

### Tasks

1. Create [backend/src/providers/simplefin_provider.rs](backend/src/providers/simplefin_provider.rs):
   - `pub struct SimpleFinProvider;`
   - `impl FinancialDataProvider`:
     - `provider_name()` returns `"simplefin"`.
     - Other methods return `anyhow::bail!("not yet implemented")`.
2. Register the module in [backend/src/providers/mod.rs](backend/src/providers/mod.rs): `pub mod simplefin_provider;`.
3. In [backend/src/config.rs](backend/src/config.rs): accept `"simplefin"` as a valid `DEFAULT_PROVIDER` value (no required env vars).
4. In [backend/src/main.rs](backend/src/main.rs) (lines ~108-150 and ~231):
   - Register `SimpleFinProvider` in the registry alongside Plaid/Teller.
   - Mirror the Plaid/Teller validation block for `simplefin` — the validation is a no-op since no env vars are required; it just confirms registration succeeded.

### Acceptance

- [x] `cargo test --manifest-path backend/Cargo.toml --locked` is green.
- [x] `cargo check --manifest-path backend/Cargo.toml --locked --all-targets` is green.
- [x] New test in `backend/src/tests/config_tests.rs`: `DEFAULT_PROVIDER=simplefin` parses without error.
- [x] New test in `backend/src/tests/simplefin_provider_tests.rs`: `SimpleFinProvider::new().provider_name() == "simplefin"`.
- [x] Running the backend with `DEFAULT_PROVIDER=simplefin` starts cleanly (manual smoke: `DEFAULT_PROVIDER=simplefin docker compose -f docker-compose.dev.yml up -d --build`).
- [x] `/api/providers/info` includes `"simplefin"` in `available_providers` (`openapi_tests.rs` + handler list).

#### Phase 1 TDD log

- Red: `simplefin_provider_tests`, `config_tests::given_simplefin_provider_env`, `openapi_tests::given_provider_info`.
- Green: `SimpleFinProvider` stub, registry registration, `available_providers` extended.
- Commands: `cargo test --manifest-path backend/Cargo.toml --locked` (339 passed), `cargo check --locked --all-targets`.

---

## Phase 2 — SimpleFIN HTTP client + claim + parse

**Goal:** The provider can claim a setup token, fetch accounts (balances-only and full), and fetch transactions across a date range — all driven through a mockable HTTP boundary. Pure unit-test territory.

### Tasks

1. Create [backend/src/models/simplefin.rs](backend/src/models/simplefin.rs) with the DTOs:
   - `SimpleFinAccountsResponse`, `SimpleFinConnection`, `SimpleFinAccount`, `SimpleFinTransaction`, `SimpleFinError`.
   - Serde-derived; no domain logic.
2. In `simplefin_provider.rs`:
   - Define `pub trait SimpleFinHttpClient: Send + Sync` with methods:
     - `claim(claim_url: &str)`
     - `get_accounts(access_url: &str, params: AccountsQuery)`
   - Implement `RealSimpleFinHttpClient` with `reqwest::Client` (rustls, basic auth extracted from access URL).
3. Implement the provider trait methods:
   - **`exchange_public_token(setup_token)`** — base64-decode → `client.claim()` → return:
     ```rust
     ProviderCredentials {
         provider: "simplefin".to_string(),
         access_token: access_url,
         item_id: format!("simplefin_root_{user_id}"),
         certificate: None,
         private_key: None,
     }
     ```
     Map `403` to a typed `SetupTokenAlreadyClaimed` error variant.
   - **`get_accounts(creds)`** — call `client.get_accounts(url, AccountsQuery { balances_only: true, .. })`. Map each `accounts[]` entry to a domain `Account`, preserving `conn_id` so callers can group.
   - **`get_transactions(creds, start, end)`** — chunk into ≤90-day windows; call `client.get_accounts` per chunk with `pending: true`; flatten transactions into `ProviderTransactionsResult`.
   - **`get_institution_info`** — return a typed `NotApplicableForSimpleFin` error and document why; never invoked on this path.
4. Mirror the mockable shape used by [backend/src/providers/teller_provider.rs](backend/src/providers/teller_provider.rs) (lines 91-126).

### Acceptance

All new tests in `backend/src/tests/simplefin_provider_tests.rs`, using a `mockall`-generated `MockSimpleFinHttpClient`:

- [x] Claim happy path: setup token → access URL → credentials with `provider == "simplefin"`, `access_token` is the access URL, `certificate`/`private_key` are `None`.
- [x] Claim `403` (token already consumed) → returns the typed error variant, not a generic anyhow.
- [x] `get_accounts` parses the fixture JSON into the right number of accounts with `conn_id` preserved.
- [x] `get_transactions` over a 200-day range issues **three** `client.get_accounts` calls with non-overlapping 90/90/20-day windows and merges results.
- [x] `get_institution_info` returns the typed `NotApplicableForSimpleFin` error.
- [x] No test makes a real network call.

#### Phase 2 TDD log

- Red: claim, get_accounts, get_transactions chunking, get_institution_info tests in `simplefin_provider_tests.rs`.
- Green: `models/simplefin.rs`, `SimpleFinHttpClient` + `RealSimpleFinHttpClient`, full `FinancialDataProvider` impl; `Account.provider_conn_id` for org grouping.
- Commands: `cargo test --manifest-path backend/Cargo.toml --locked` (345 passed).

---

## Phase 3 — Migration + repository for `simplefin_hidden_orgs`

**Goal:** The blocklist table exists with RLS isolation; the repository can list and insert rows.

### Tasks

1. New migration `backend/migrations/027_simplefin_hidden_orgs.sql` (plan originally numbered 024; `024` is `user_custom_categories` in this repo):

   ```sql
   CREATE TABLE simplefin_hidden_orgs (
       user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       org_conn_id TEXT        NOT NULL,
       hidden_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       PRIMARY KEY (user_id, org_conn_id)
   );

   ALTER TABLE simplefin_hidden_orgs ENABLE ROW LEVEL SECURITY;

   CREATE POLICY simplefin_hidden_orgs_isolation ON simplefin_hidden_orgs
       USING      (user_id::text = current_setting('app.current_user_id', true))
       WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

   CREATE INDEX idx_simplefin_hidden_orgs_user ON simplefin_hidden_orgs(user_id);
   ```

2. In [backend/src/services/repository_service.rs](backend/src/services/repository_service.rs), add:
   - `list_simplefin_hidden_orgs(user_id) -> Result<HashSet<String>>`
   - `insert_simplefin_hidden_org(user_id, conn_id) -> Result<()>` — idempotent via `ON CONFLICT DO NOTHING`.

### Acceptance

Tests in `backend/src/tests/migration_tests.rs` and `backend/src/tests/repository_service_tests.rs`:

- [x] Migration applies cleanly to a fresh DB **and** to a DB already migrated through `023_*` (integration tests apply `027` when `DATABASE_URL` is set).
- [x] RLS isolation: user A inserting their `conn_id` is invisible to user B (mirrors existing RLS tests).
- [x] `insert_simplefin_hidden_org` is idempotent (calling twice with the same args is a no-op, returns `Ok`).
- [x] `list_simplefin_hidden_orgs` returns the inserted set; empty set for a fresh user.

#### Phase 3 TDD log

- Red: migration idempotency + repository list/insert/RLS tests (skip without `DATABASE_URL`).
- Green: `027_simplefin_hidden_orgs.sql`, `list_simplefin_hidden_orgs`, `insert_simplefin_hidden_org`.
- Commands: `cargo test --manifest-path backend/Cargo.toml --locked` (350 passed).

---

## Phase 4 — Connection service: claim → multi-org persist

**Goal:** `/api/providers/connect` for `simplefin` claims the setup token, persists one `provider_connections` row per org returned by `/accounts`, and persists their accounts — **respecting the blocklist from the very first sync**.

### Tasks

1. In [backend/src/services/connection_service.rs](backend/src/services/connection_service.rs), add `pub async fn connect_simplefin_provider(user_id, jwt_id, req: &ProviderConnectRequest)` that:
   1. Calls `provider.exchange_public_token(req.access_token)` to claim.
   2. Stores the access URL **once** via `db.store_provider_credentials_for_user(user_id, format!("simplefin_root_{user_id}"), encrypted_access_url)`, replacing any existing row (re-claim is idempotent).
   3. Calls `provider.get_accounts(creds)` (balances-only).
   4. Loads `simplefin_hidden_orgs` for `user_id`.
   5. For each org in `connections[]` **not** in the blocklist, upserts a `provider_connections` row with:
      - `item_id = format!("simplefin_{conn_id}")`
      - `institution_id = org.org_id`
      - `institution_name = org.name`
   6. **Skips blocklisted orgs entirely** — does not write the row, its accounts, or its cached metadata.
   7. For each non-blocklisted org, upserts its accounts linked to that row.
   8. Returns `ProviderConnectResponse { connection_id, institution_name: format!("SimpleFIN ({N} institutions)") }` where `N` is the number of rows actually written.
2. Add `pub async fn load_simplefin_access_url(user_id) -> Result<ProviderCredentials>` — fetches and decrypts the `simplefin_root_{user_id}` row. Used by the sync path because per-row credential lookup doesn't work for SimpleFIN (all rows share one URL).
3. In [backend/src/main.rs](backend/src/main.rs) at line 2311 (the connect handler): extend the guard to accept `"simplefin"` and route to `connect_simplefin_provider()`. Reuse the existing `TellerConnectError → ApiErrorResponse` mapping pattern; add `SimpleFinConnectError` with parallel variants.

### Acceptance

Tests in `backend/src/tests/simplefin_service_tests.rs` (or extend `connection_service_tests.rs`):

- [x] Claim with a 3-org fixture writes exactly **3** `provider_connections` rows + their accounts.
- [x] Re-claim with the same setup token replaces the access URL credential and does **not** duplicate rows.
- [x] **Claim with a 3-org fixture where one `conn_id` is pre-inserted in `simplefin_hidden_orgs` writes exactly 2 rows; the third org's accounts are not in the `accounts` table.**
- [x] Handler integration test: `POST /api/providers/connect` with `provider: "simplefin"` → `200`; with `provider: "unknown"` → `400`.

#### Phase 4 TDD log

- Red: `simplefin_service_tests` connect, re-claim, blocklist, load credentials, handler routes.
- Green: `connect_simplefin_provider`, `load_simplefin_access_url`, `fetch_balances_snapshot` trait method, handler routing.
- Commands: `cargo test --manifest-path backend/Cargo.toml --locked` (355 passed).

---

## Phase 5 — Sync service: credential branch + blocklist enforcement + sync floor

**Goal:** SimpleFIN syncs use the shared access URL, enforce the blocklist at every write boundary, and respect a 1-hour manual-sync floor.

### Tasks

In [backend/src/services/sync_service.rs](backend/src/services/sync_service.rs):

1. In `sync_bank_connection_transactions`, branch on the row's provider: if `simplefin`, call `connection_service.load_simplefin_access_url(user_id)` instead of looking up creds by row `item_id`.
2. **Single chokepoint:** load `simplefin_hidden_orgs` once per sync; filter `connections[]`, `accounts[]`, and `transactions[]` against it **before** any DB write or cache set. No other write path may bypass this filter.
3. Add a per-user manual-sync floor: Redis key `simplefin:sync-floor:{user_id}` with TTL `3600`. If present, return a typed "rate-limited locally" result (handler maps to `429` with `Retry-After`).

### Acceptance

Tests in `backend/src/tests/simplefin_service_tests.rs` (extended) and `cache_service_tests.rs`:

- [x] Re-sync where the fixture response still contains a blocklisted org: **zero new rows** in `provider_connections`, `accounts`, or `transactions` for that `conn_id`; cache contains no entries keyed on that `conn_id`. Assert by direct DB + Redis inspection after the call.
- [x] Re-sync for a non-blocklisted org persists transactions normally (covered by existing sync tests unchanged + connect path account upsert tests).
- [x] Two manual syncs within 3600s: the second returns the rate-limited result; the Redis floor key was set on the first.
- [x] Non-SimpleFIN providers (`teller`, `plaid`) are unaffected by the new branch — existing sync tests still pass unchanged.

#### Phase 5 TDD log

- Red: blocklisted sync, sync floor, transaction filter unit tests in `simplefin_service_tests.rs`.
- Green: `sync_simplefin_connection`, `filter_simplefin_transactions_for_connection`, `ProviderSyncError::RateLimited`, handler `429` + `Retry-After`.
- Commands: `cargo test --manifest-path backend/Cargo.toml --locked` (358 passed).

---

## Phase 6 — Provider-aware disconnect

**Goal:** Disconnecting a SimpleFIN row inserts the org into the blocklist atomically with row + cascade deletion.

### Tasks

In [backend/src/services/connection_service.rs](backend/src/services/connection_service.rs):

1. In the disconnect path, detect rows whose `item_id` starts with `simplefin_` (and is **not** `simplefin_root_`).
2. Parse `conn_id` from the suffix.
3. In the **same transaction** as the row + accounts + transactions cascade delete, `INSERT INTO simplefin_hidden_orgs (...) ON CONFLICT DO NOTHING`.
4. Invalidate any Redis cache entries scoped to that `conn_id`.

### Acceptance

Tests in `backend/src/tests/simplefin_service_tests.rs`:

- [x] Disconnect a SimpleFIN row → blocklist contains its `conn_id`; row + accounts + transactions for that `conn_id` are gone; the access URL credential row remains so other orgs still sync.
- [x] Disconnect is atomic: if the cascade delete fails, the blocklist insert is rolled back (induce failure with a test hook).
- [x] Disconnect a Teller row → no entry written to `simplefin_hidden_orgs` (the new branch is provider-scoped).
- [x] After disconnect, the next sync (Phase 5 logic) still writes **zero** rows for the disconnected org — closes the loop.

#### Phase 6 TDD log

- Red: disconnect blocklist, atomic failure, teller isolation, post-disconnect sync tests.
- Green: `disconnect_simplefin_org` repository transaction, `disconnect_owned_connection` SimpleFIN branch skips credential delete.
- Commands: `cargo test --manifest-path backend/Cargo.toml --locked simplefin_service` (13 passed).

---

## Phase 7 — Frontend types + `SimpleFinService`

**Goal:** Frontend has a typed `SimpleFinService` that hits the existing endpoints; types compile and round-trip in Jest.

### Tasks

1. In [frontend/src/types/api.ts](frontend/src/types/api.ts):
   - Extend `type FinancialProvider = 'plaid' | 'teller' | 'simplefin'`.
   - Update any exhaustive switches the compiler flags.
2. Create [frontend/src/services/SimpleFinService.ts](frontend/src/services/SimpleFinService.ts), mirroring [PlaidService.ts](frontend/src/services/PlaidService.ts):
   - `submitSetupToken(token)` → `ApiClient.post('/api/providers/connect', { provider: 'simplefin', access_token: token, enrollment_id: '' })`
   - `getStatus()` → filter `/api/providers/status` to `simplefin`
   - `syncTransactions(connectionId?)` → `/api/providers/sync-transactions`
   - `disconnect(connectionId)` → `/api/providers/disconnect`

### Acceptance

Tests in `frontend/tests/services/SimpleFinService.test.ts`:

- [x] Mirror [PlaidService.test.ts](frontend/tests/services/PlaidService.test.ts) using `jest.spyOn(ApiClient, ...)`.
- [x] `submitSetupToken('abc')` → `ApiClient.post` called with `'/providers/connect'` and `{ provider: 'simplefin', access_token: 'abc', enrollment_id: '' }`.
- [x] `getStatus`, `syncTransactions`, `disconnect` each call the expected endpoint with the expected payload.
- [x] `npm --prefix frontend run typecheck` is green; exhaustive switches over `FinancialProvider` updated.

#### Phase 7 TDD log

- Red: `SimpleFinService.test.ts` against missing service/types.
- Green: `SimpleFinService.ts`, `FinancialProvider` + `ProviderConnectResponse`, minimal provider card/connect content, `SyncProvider` + registry stub.
- Commands: `npm --prefix frontend test -- tests/services/SimpleFinService.test.ts`, `npm --prefix frontend run typecheck`.

---

## Phase 8 — Frontend hook + connection strategy

**Goal:** `useSimpleFinFlow` returns the same shape as `usePlaidLinkFlow`, exposing `submitSetupToken`. Onboarding strategy mirrors Teller's.

### Tasks

1. Create [frontend/src/features/simplefin/hooks/useSimpleFinFlow.ts](frontend/src/features/simplefin/hooks/useSimpleFinFlow.ts):
   - Return `UsePlaidLinkFlowResult`-shaped object so callers don't special-case.
   - `connect()` is a no-op.
   - `plaidLinkMount` is `null`.
   - Expose `submitSetupToken(token)` that calls `SimpleFinService.submitSetupToken` then `syncAll()`.
2. Create [frontend/src/hooks/financialConnection/useSimpleFinConnectionStrategy.ts](frontend/src/hooks/financialConnection/useSimpleFinConnectionStrategy.ts) mirroring [useTellerConnectionStrategy.ts](frontend/src/hooks/financialConnection/useTellerConnectionStrategy.ts); dispatch `connectionActions.patch(...)` on success.

### Acceptance

Tests in `frontend/tests/features/simplefin/hooks/useSimpleFinFlow.test.tsx`:

- [x] `submitSetupToken('abc')` → service called → on success, `syncAll` is called → `connections` state is repopulated.
- [x] Error path: service rejection sets `error` and leaves `connections` unchanged.
- [x] Hook test for `useSimpleFinConnectionStrategy` mirrors the Teller equivalent.

#### Phase 8 TDD log

- Red: `useSimpleFinFlow.test.tsx`, `useSimpleFinConnectionStrategy.test.tsx`.
- Green: `useSimpleFinFlow`, `useSimpleFinConnectionStrategy`, registry wiring in `connectionProviders`.
- Commands: `npm --prefix frontend test -- tests/features/simplefin/hooks/useSimpleFinFlow.test.tsx tests/hooks/useSimpleFinConnectionStrategy.test.tsx`, `npm --prefix frontend run typecheck`.

---

## Phase 9 — Onboarding UX: setup-token input + N-institutions success state

**Goal:** `ConnectAccountStep` renders a setup-token text input for SimpleFIN when unconnected, and the existing success badge with `"{N} institution(s) connected"` when connected.

### Tasks

1. In [frontend/src/utils/providerCards.ts](frontend/src/utils/providerCards.ts): add a `simplefin` entry.
   - Title: `"SimpleFIN"`
   - Badge: `"Bring your own token"`
   - Description + logo + highlights (works with many banks, no third-party UI in Sumurai, you control the connection at simplefin.org).
2. In [frontend/src/components/onboarding/ConnectAccountStep.tsx](frontend/src/components/onboarding/ConnectAccountStep.tsx):
   - When provider is `simplefin` and `!isConnected`: render an inline form with `<input type="password" placeholder="Paste your SimpleFIN setup token">` + submit, replacing the "Connect with X" button. Help text + link to <https://beta-bridge.simplefin.org/info/developers>.
   - When `isConnected`: pass `institutionName = "{N} institution(s) connected"` (computed from `connections.length` in the parent) so the existing `✓ Connected to {institutionName}` rendering (lines 286–329) Just Works.
3. Add a Storybook story file for `ConnectAccountStep` covering:
   - SimpleFIN unconnected (input visible)
   - SimpleFIN connecting (submit disabled)
   - SimpleFIN connected (badge with count)
   - SimpleFIN error (validation message)

### Acceptance

- [ ] `npm --prefix frontend run test:storybook` renders the four SimpleFIN states without error.
- [ ] `npm --prefix frontend run design:guard` is green (no raw styling, no new tokens needed).
- [ ] `npm --prefix frontend run typecheck` and `lint` are green.
- [ ] Manual smoke at <http://localhost:8080> (per `docs/ARCHITECTURE.md`): paste the demo token from <https://beta-bridge.simplefin.org/info/developers> and see the success badge populate with the org count.

---

## Phase 10 — Docs + end-to-end verification

**Goal:** Docs reflect SimpleFIN as a first-class provider; the data-retention rule is verified end-to-end with real network traffic against the SimpleFIN beta-bridge.

### Tasks

1. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — extend the Provider Flow section: note that SimpleFIN uses one access URL across many `provider_connections` rows, and that `simplefin_hidden_orgs` enforces the "only keep what is implicitly allowed" rule.
2. [README.md](README.md) — add SimpleFIN to the provider list with a short Quick Start pointing to <https://bridge.simplefin.org/>.
3. [CONTRIBUTING.md](CONTRIBUTING.md) — env-var section: SimpleFIN needs none; sandbox section: demo setup token URL.
4. [.env.example](.env.example) — add a comment-only line: `# SIMPLEFIN: no keys required; user pastes a setup token in the UI`. **Do not read or write `.env`.**

### Acceptance

- [ ] `npm run backend:ci && npm run frontend:ci` is green.
- [ ] `DEFAULT_PROVIDER=simplefin docker compose -f docker-compose.dev.yml up -d --build` starts cleanly.
- [ ] Register `me@test.com` / `Test1234!`; choose SimpleFIN in onboarding.
- [ ] Grab the demo token from <https://beta-bridge.simplefin.org/info/developers>; paste; submit succeeds.
- [ ] Success badge shows the org count from the demo response; accounts appear in the accounts list.
- [ ] Trigger a manual sync; transactions populate.
- [ ] A second immediate manual sync is debounced (`429` with `Retry-After`).
- [ ] Disconnect one org from the accounts page; trigger a fresh sync; the disconnected org and its data **do not** reappear (verify with `psql` against `simplefin_hidden_orgs`, `provider_connections`, `accounts`, `transactions`).
- [ ] Re-claim with a fresh demo token; previously-hidden org stays hidden.
- [ ] Switch `DEFAULT_PROVIDER` back to `teller`; the provider-mismatch flow in `App.tsx` surfaces correctly.

---

## Out of scope

Track as separate follow-ups; do **not** implement here.

- UI affordance to "un-hide" a previously disconnected SimpleFIN org (Settings page + endpoint to delete from `simplefin_hidden_orgs`).
- Webhooks / push (SimpleFIN doesn't offer them).

---

## Critical files reference

### New files

| File | Phases |
| --- | --- |
| `backend/src/providers/simplefin_provider.rs` | P1, P2 |
| `backend/src/models/simplefin.rs` | P2 |
| `backend/migrations/024_simplefin_hidden_orgs.sql` | P3 |
| `backend/src/tests/simplefin_provider_tests.rs` | P1, P2 |
| `backend/src/tests/simplefin_service_tests.rs` | P4, P5, P6 |
| `frontend/src/services/SimpleFinService.ts` | P7 |
| `frontend/src/features/simplefin/hooks/useSimpleFinFlow.ts` | P8 |
| `frontend/src/hooks/financialConnection/useSimpleFinConnectionStrategy.ts` | P8 |
| `frontend/tests/services/SimpleFinService.test.ts` | P7 |
| `frontend/tests/features/simplefin/hooks/useSimpleFinFlow.test.tsx` | P8 |

### Modified files

| File | Phases | Change |
| --- | --- | --- |
| `backend/src/main.rs` | P1, P4 | Registry + validation; handler guard |
| `backend/src/config.rs` | P1 | Accept `simplefin` |
| `backend/src/providers/mod.rs` | P1 | Module declaration |
| `backend/src/services/connection_service.rs` | P4, P5, P6 | `connect_simplefin_provider`, cred loader, disconnect branch |
| `backend/src/services/sync_service.rs` | P5 | Cred branch + blocklist filter + sync floor |
| `backend/src/services/repository_service.rs` | P3 | `list`/`insert_simplefin_hidden_orgs` |
| `backend/src/tests/{config,migration,repository_service,openapi}_tests.rs` | per phase | Extended |
| `frontend/src/types/api.ts` | P7 | Union extension |
| `frontend/src/components/onboarding/ConnectAccountStep.tsx` | P9 | Setup-token input + N-institutions label |
| `frontend/src/utils/providerCards.ts` | P9 | `simplefin` card config |
| `docs/ARCHITECTURE.md`, `README.md`, `CONTRIBUTING.md`, `.env.example` | P10 | Docs |
