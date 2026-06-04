# SimpleFin Demo Seed Data Plan

Attach a permanent "Sumurai Demo Bank" institution to `me@test.com` that contains one account of every type and raw transactions covering every stage of the 14-step merchant normalization pipeline. When a SimpleFin sync is triggered for this institution, the system reads raw descriptions from the DB and re-runs the normalization engine — no HTTP call to the SimpleFin bridge is made.

## Assumptions

- `SEED_DEMO_USER=true` is the existing gate for all demo seeding; this feature reuses it.
- `me@test.com` is already created by `maybe_seed_demo_user` before demo SimpleFin data is seeded.
- All required `DatabaseRepository` write methods already exist (`save_provider_connection`, `upsert_account`, `upsert_transactions_batch`).
- `MerchantNormalizationService` is created internally from `db_repository` + `cache_service`, same pattern as `ConnectionService`.
- No new DB migration is needed — schema already supports everything.
- The demo institution is isolated to SimpleFin by `provider_connections.provider = "simplefin"` and an `item_id` prefix of `simplefin_`. Plaid/Teller sync paths never touch it.

## Risks

- If `upsert_account` returns accounts without the `id` populated, the seed function needs an extra DB round-trip to resolve account UUIDs before building transactions. Verify the return value of `upsert_account`.
- If `get_transactions_for_user` is slow (full table scan), the demo sync path may be noticeably slower than a real sync. Acceptable for dev only.
- Adding normalization to the live `simplefin_connection_service::sync()` path is a correctness fix (it was missing), but it could expose latency in environments where the alias index cache is cold.

---

## Phase 1 — Seed constants and demo data in `seed.rs`

**Goal:** Define the demo org constant and seed the demo institution, accounts, and raw transactions for `me@test.com` at startup.

### Tasks

- Add `pub const SUMURAI_DEMO_ORG_CONN_ID: &str = "sumurai_demo";` to `backend/src/seed.rs`
- Add `pub async fn maybe_seed_demo_simplefin_data(db, cache_service) -> anyhow::Result<()>` guarded by `SEED_DEMO_USER=true`
- Function derives `item_id = format!("simplefin_{user_id}_sumurai_demo")` and exits early if that connection already exists
- Creates a `ProviderConnection` via `db.save_provider_connection`:
  - `provider = "simplefin"`, `institution_name = "Sumurai Demo Bank"`, `institution_id = "sumurai_demo"`, `is_connected = true`
- Seeds 5 accounts via `db.upsert_account`:
  - `Sumurai Checking (1001)` → depository → `sumurai_demo_dep_checking`
  - `Sumurai Savings (2001)` → depository → `sumurai_demo_dep_savings`
  - `Sumurai Credit Card (3001)` → credit → `sumurai_demo_credit`
  - `Sumurai Brokerage IRA (4001)` → investment → `sumurai_demo_investment`
  - `Sumurai Auto Loan (5001)` → loan → `sumurai_demo_loan`
- Seeds 19 transactions via `db.upsert_transactions_batch` with stable `provider_transaction_id`s (`sumurai_demo_txn_01` … `_19`), `original_merchant_name` set to the raw description, and `merchant_name` set to the same raw value (normalized on first sync)

### Transaction set (one per normalization stage)

| ID | Account | Raw description | Stage exercised |
|----|---------|-----------------|-----------------|
| `_01` | checking | `SQ *BLUE BOTTLE COFFEE` | aggregator/processor split |
| `_02` | checking | `PAYROLL DIRECT DEPOSIT SUMURAI INC` | structural label — payroll |
| `_03` | checking | `CHECK # 1042 PAID` | structural label — check |
| `_04` | checking | `ATM WITHDRAWAL 123 MAIN ST` | structural label — ATM |
| `_05` | checking | `ZELLE PAYMENT TO ALEX SMITH` | structural label — transfer/payment |
| `_06` | checking | `NETFLIX.COM 866-579-7172 CA` | URL normalization + early dict alias |
| `_07` | checking | `COSTCO WHSE #573 PORTLAND OR 06/01` | early dict (contains) + geo + trailing tail |
| `_08` | checking | `POS DEBIT STARBUCKS #12345 SEATTLE WA 06/03` | leading prefix strip + geo suffix |
| `_09` | checking | `WALMART SUPERCENTER 4321 06/04` | trailing digit/date + contains alias |
| `_10` | checking | `TARGET STORE #1234 PORTLAND OR` | trailing code + geo + main dict match |
| `_11` | checking | `AMAZON.COM LLC` | corporate suffix strip + alias |
| `_12` | checking | `AMZN MKTP US*1A2B3C4D` | aggregator split + contains alias |
| `_13` | checking | `SHELL OIL 59401234 DEBIT PURCHASE` | trailing noise + contains alias |
| `_14` | checking | `UBER* TRIPS HELP.UBER.COM CA` | aggregator split + URL suffix + geo |
| `_15` | checking | `RANDOMCO MERCHANT PORTLAND OR 12345` | no alias → title-case fallback |
| `_16` | credit | `WHOLEFDS MKT #10452 PORTLAND OR` | contains alias (Whole Foods) + geo |
| `_17` | savings | `ONLINE TRANSFER TO CHECKING` | structural label — transfer |
| `_18` | investment | `DIVIDEND REINVESTMENT VANGUARD` | title-case fallback |
| `_19` | loan | `AUTOPAY LOAN PAYMENT` | structural label — payment |

### Acceptance criteria

- [x] `cargo build -p sumurai-backend --locked` passes after changes to `seed.rs`
- [x] Starting the dev stack with `SEED_DEMO_USER=true` logs `"Demo SimpleFin data seeded for me@test.com"` (verified via mock: `seeds_connection_five_accounts_and_nineteen_transactions`)
- [x] Running startup a second time logs `"Demo SimpleFin data already present, skipping"` (idempotent) (verified via mock: `skips_when_demo_connection_already_exists`)
- [x] DB has a `provider_connections` row with `institution_name = 'Sumurai Demo Bank'` and `provider = 'simplefin'` (verified via mock: `save_provider_connection` called once)
- [x] DB has 5 accounts with the expected `provider_account_id` values (verified via mock: `upsert_account` called 5 times)
- [x] DB has 19 transactions with `original_merchant_name` matching the raw descriptions above (verified via mock: batch length == 19, raw desc in both fields)

### TDD log

- Tests: `seed_simplefin_tests` — 4 boundary tests using `MockDatabaseRepository` + `MockCacheService`
- `skips_when_demo_user_not_found` — gate: missing user → no DB writes
- `skips_when_demo_connection_already_exists` — idempotency: item_id already in connections → no save
- `seeds_connection_five_accounts_and_nineteen_transactions` — happy path: correct call counts
- `transaction_original_merchant_names_match_raw_descriptions` — data invariant: raw desc in both fields, stable IDs
- All 556 tests pass; 0 regressions

---

## Phase 2 — Demo sync interception and normalization wiring in `simplefin_connection_service.rs`

**Goal:** When sync is triggered for the demo institution, skip the SimpleFin HTTP bridge and instead re-run the normalization engine on the DB-stored raw descriptions. Also fix the missing normalization call on the live sync path.

### Tasks

- Add `merchant_normalization_service: Arc<MerchantNormalizationService>` field to `SimpleFinConnectionService`
- Construct it inside `SimpleFinConnectionService::new()`:
  ```rust
  let merchant_normalization_service = Arc::new(MerchantNormalizationService::new(
      db_repository.clone(),
      cache_service.clone(),
  ));
  ```
- In `sync()`, after `conn_id` is extracted and the hidden-org check passes, insert:
  ```rust
  if conn_id == crate::seed::SUMURAI_DEMO_ORG_CONN_ID {
      return self.sync_demo_institution(params, connection, sync_timestamp).await;
  }
  ```
- Implement `sync_demo_institution(&self, params, connection, sync_timestamp)`:
  1. Load accounts for user filtered to this connection's `id`
  2. Load all transactions for user filtered to those account IDs
  3. Reset each transaction's `merchant_name` to its `original_merchant_name` (raw input)
  4. Call `self.merchant_normalization_service.normalize_batch(&mut transactions)` (log warn on error)
  5. Call `self.db_repository.upsert_transactions_batch(&transactions, params.user_id)`
  6. Add transactions to cache via `self.cache_service.add_transaction`
  7. Return `SyncTransactionsResponse` with populated `SyncMetadata` (transaction/account counts, timestamps)
- Fix live sync path: insert the `normalize_batch` call on `valid_transactions` before `upsert_transactions_batch` in the existing `sync()` method

### Acceptance criteria

- [x] `cargo build -p sumurai-backend --locked` passes
- [x] `cargo test -p sumurai-backend --locked` passes — 559 pass, 0 fail
- [x] Triggering sync for "Sumurai Demo Bank" produces no outbound HTTP to `simplefin.org` (verified via mock: `demo_sync_intercepts_without_provider_credentials` — no credential resolver set up, test passes)
- [x] After sync, `merchant_name` is re-derived from `original_merchant_name` and is not the stale value (verified via mock: `demo_sync_resets_merchant_name_to_original_before_normalizing`)
- [x] After sync, `original_merchant_name` is preserved unchanged (verified via mock: same test)
- [x] Demo sync only processes transactions belonging to the demo institution's accounts (verified via mock: `demo_sync_only_processes_accounts_for_this_connection`)
- [x] Live SimpleFin sync (non-demo institution) now also normalizes merchant names — `normalize_batch` inserted before `upsert_transactions_batch` on live path; `get_active_merchant_aliases` mock added to `build_simplefin_sync_service_with_categorizer_and_accounts`, all 559 tests pass

### TDD log

- Tests: `simplefin_demo_sync_tests` — 3 boundary tests using `MockDatabaseRepository` + `MockCacheService`
- `demo_sync_intercepts_without_provider_credentials` — gate: conn_id matches demo constant, no credential lookup, 19 txns returned
- `demo_sync_resets_merchant_name_to_original_before_normalizing` — invariant: stale merchant_name is overwritten from original before normalization, original preserved
- `demo_sync_only_processes_accounts_for_this_connection` — isolation: only transactions for the demo connection's accounts are processed
- Existing `build_simplefin_sync_service_with_categorizer_and_accounts` updated with `get_active_merchant_aliases` mock for live-path normalization
- All 559 backend tests pass; 0 regressions

---

## Phase 3 — Wire startup call in `main.rs`

**Goal:** Ensure `maybe_seed_demo_simplefin_data` is called at server startup so dev environments get demo data without manual steps.

### Tasks

- In `backend/src/main.rs`, locate the `maybe_seed_demo_user` call
- Immediately after it, add:
  ```rust
  crate::seed::maybe_seed_demo_simplefin_data(&db_repository, &cache_service).await?;
  ```

### Acceptance criteria

- [ ] `cargo build -p sumurai-backend --locked` passes
- [ ] Fresh dev DB with `SEED_DEMO_USER=true`: "Sumurai Demo Bank" appears in the UI under SimpleFin institutions after first boot
- [ ] No demo data appears when `SEED_DEMO_USER` is absent or `false`
- [ ] Connecting Teller or Plaid on `me@test.com` does not add or interfere with the demo SimpleFin institution
