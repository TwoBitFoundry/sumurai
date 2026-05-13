# Paginated Sync + Server-Side Transaction Pagination

## Context

The app now syncs 5 years of transactions on first connect. The current provider implementations make a single API call (no pagination), so large datasets are silently truncated. DB writes are one-record-at-a-time (5000 upserts = slow). The transactions view has a hard-coded `LIMIT 1000` with no offset and loads all records into the browser, which breaks under 5 years of data. This plan fixes all three layers: provider fetch, DB write, and read/display.

**UX target:** Fast foreground sync with a loading spinner. No background/polling needed — just make it fast via batch writes and efficient provider calls.

---

## Assumptions & Risks

- Plaid `/transactions/get` returns `total_transactions` in the JSON body and supports `count` (max 500) + `offset` pagination.
- Teller `/accounts/{id}/transactions` supports `count` and `from_id` query params; returns results in reverse-chronological order (most recent first).
- The `ON CONFLICT (provider_transaction_id)` unique index already exists — no schema change needed for Phase 1.
- A 5-year first sync may involve 3000–5000 transactions across 3 accounts: ~10 Plaid calls + 10 batch DB writes ≈ 5–10 seconds total.
- No job queue or streaming infrastructure exists; sync is synchronous within the HTTP request.

---

## Phase 1: Batch DB Writes

**Goal:** Replace N individual upserts with chunked batch upserts.

### Files
- `backend/src/services/repository_service.rs` — add to trait + impl
- `backend/src/services/connection_service.rs` — replace upsert loop

### repository_service.rs

Add `upsert_transactions_batch` to `DatabaseRepository` trait and `PostgresRepository` impl. Uses `sqlx::QueryBuilder::push_values` to build a single multi-row `INSERT ... ON CONFLICT` statement. Max 500 rows per call (13 cols × 500 = 6500 params, under PostgreSQL's 65535 limit).

```rust
async fn upsert_transactions_batch(
    &self,
    transactions: &[Transaction],
    user_id: &Uuid,
) -> Result<()> {
    if transactions.is_empty() { return Ok(()); }
    let mut tx = self.pool.begin().await?;
    sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
        .bind(user_id.to_string()).execute(&mut *tx).await?;
    let mut qb = sqlx::QueryBuilder::new(
        "INSERT INTO transactions (id, account_id, user_id, provider_transaction_id, amount, date, \
         merchant_name, category_primary, category_detailed, category_confidence, \
         payment_channel, pending, created_at) "
    );
    qb.push_values(transactions, |mut b, t| {
        b.push_bind(t.id).push_bind(t.account_id).push_bind(t.user_id)
         .push_bind(&t.provider_transaction_id).push_bind(t.amount).push_bind(t.date)
         .push_bind(&t.merchant_name).push_bind(&t.category_primary)
         .push_bind(&t.category_detailed).push_bind(&t.category_confidence)
         .push_bind(&t.payment_channel).push_bind(t.pending)
         .push_bind(t.created_at.unwrap_or_else(chrono::Utc::now));
    });
    qb.push(" ON CONFLICT (provider_transaction_id) DO UPDATE SET \
             amount = EXCLUDED.amount, merchant_name = EXCLUDED.merchant_name, \
             pending = EXCLUDED.pending");
    qb.build().execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(())
}
```

### connection_service.rs

Replace the per-transaction `upsert_transaction()` loop (lines 494–526, and the matching Teller path) with:

```rust
let valid: Vec<&Transaction> = transactions.iter()
    .filter(|t| !t.account_id.is_nil())
    .collect();
for chunk in valid.chunks(500) {
    self.db_repository.upsert_transactions_batch(chunk, params.user_id).await?;
}
for t in &valid {
    let _ = self.cache_service.add_transaction(params.jwt_id, t).await;
}
```

### Acceptance Criteria
- [x] `cargo test` passes with no regressions
- [x] New test: 600 transactions inserted in two chunks; all 600 in DB, no duplicates on re-insert
- [x] Method is on the `DbRepository` trait (mockable)

### Notes
- Added a batch repository write method and switched both sync paths to chunked persistence and cache writes.

### TDD Log
- `cargo test --manifest-path backend/Cargo.toml --locked connection_service_tests`
- `cargo test --manifest-path backend/Cargo.toml --locked repository_service_tests`
- `cargo fmt --manifest-path backend/Cargo.toml --all --check`
- `cargo check --manifest-path backend/Cargo.toml --locked --all-targets`
- `cargo clippy --manifest-path backend/Cargo.toml --locked --all-targets --no-deps -- -D warnings`
- `cargo test --manifest-path backend/Cargo.toml --locked`

---

## Phase 2: Provider Pagination

**Goal:** Fetch all pages from Plaid and Teller. No trait changes — callers still receive `Vec<Transaction>`.

### Files
- `backend/src/services/plaid_service.rs`
- `backend/src/providers/teller_provider.rs`

### plaid_service.rs — offset loop

```rust
// after initial fetch succeeds, check total:
let total = data["total_transactions"].as_u64().unwrap_or(0) as usize;
let mut offset = transactions.len();
while offset < total {
    // POST with "count": 500, "offset": offset
    // extend transactions vec
    // offset += new_batch.len();
    // break if new_batch is empty (safety guard)
}
```

### teller_provider.rs — from_id cursor per account

```rust
let page_size = 100usize;
let mut from_id: Option<String> = None;
loop {
    // GET /accounts/{id}/transactions?count=100[&from_id={id}]
    // extend with items where date in [start_date, end_date]
    // early-exit: Teller is reverse-chron — stop if oldest item < start_date OR batch < page_size
    from_id = batch.last().and_then(|t| t["id"].as_str()).map(String::from);
}
```

### Acceptance Criteria
- [ ] `cargo test` passes
- [ ] Plaid: mock returning `total_transactions: 1100` causes exactly 3 HTTP calls (offsets 0, 500, 1000)
- [ ] Teller: pages of 100 then 40 → 3 calls, all items returned
- [ ] Teller early-exit: batch entirely before `start_date` → stops after 1 call

---

## Phase 3: Client Timezone for First Sync

**Goal:** Anchor the 5-year lookback on the user's local calendar date, not UTC midnight.

### Files
- Wherever `SyncTransactionsRequest` is defined (find in codebase)
- `backend/src/services/sync_service.rs`
- `backend/src/services/connection_service.rs`
- Frontend: sync trigger component/service

### Changes

`SyncTransactionsRequest` — add field:
```rust
pub client_date: Option<String>, // "YYYY-MM-DD" in user's local timezone
```

`sync_service.rs` — add `reference_date` param:
```rust
pub fn calculate_sync_date_range_static(
    last_sync_at: Option<DateTime<Utc>>,
    reference_date: Option<NaiveDate>,
) -> (NaiveDate, NaiveDate) {
    let end_date = reference_date.unwrap_or_else(|| Utc::now().date_naive());
    // rest unchanged
}
```

Frontend sync call:
```ts
client_date: new Date().toLocaleDateString('en-CA') // "YYYY-MM-DD" in local time
```

### Acceptance Criteria
- [ ] `cargo test` passes — update all existing call sites in tests to pass `None`
- [ ] New test: `reference_date = 2025-06-15`, `last_sync_at = None` → `start_date == 2020-06-15`
- [ ] DevTools network tab shows `client_date` in sync request body

---

## Phase 4: Server-Side Transactions API Pagination (Backend)

**Goal:** Replace hard-coded `LIMIT 1000` with parameterized pagination. Prerequisite for Phase 5.

### Files
- `backend/migrations/<timestamp>_add_transactions_user_date_index.sql` (new)
- `backend/src/services/repository_service.rs`
- `backend/src/models/transaction.rs`
- `backend/src/main.rs`

### Migration

No schema changes needed. Add a performance index only:

```sql
-- up
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_date
    ON transactions (user_id, date DESC);

-- down
DROP INDEX IF EXISTS idx_transactions_user_date;
```

### New DB methods (trait + impl)

```rust
async fn get_transactions_paginated(
    &self,
    user_id: &Uuid,
    limit: i64,
    offset: i64,
    search: Option<&str>,
    account_ids: Option<&[Uuid]>,
    start_date: Option<NaiveDate>,
    end_date: Option<NaiveDate>,
    category_primary: Option<&str>,
) -> Result<Vec<TransactionWithAccount>>;

async fn count_transactions(
    &self,
    user_id: &Uuid,
    search: Option<&str>,
    account_ids: Option<&[Uuid]>,
    start_date: Option<NaiveDate>,
    end_date: Option<NaiveDate>,
    category_primary: Option<&str>,
) -> Result<i64>;

async fn get_distinct_transaction_categories(&self, user_id: &Uuid) -> Result<Vec<String>>;
```

Use `sqlx::QueryBuilder` for optional WHERE fragments. End paginated query with `ORDER BY t.date DESC, t.created_at DESC LIMIT $n OFFSET $m`.

### New response model — transaction.rs

```rust
pub struct PaginatedTransactionsResponse {
    pub transactions: Vec<TransactionWithAccount>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}
```

### Endpoint updates — main.rs

Expand `TransactionsQuery`:
```rust
pub struct TransactionsQuery {
    pub search: Option<String>,
    pub account_ids: Option<Vec<String>>,
    pub page: Option<i64>,                // default 1
    pub page_size: Option<i64>,           // default 50, clamp to max 200
    pub start_date: Option<String>,       // YYYY-MM-DD
    pub end_date: Option<String>,         // YYYY-MM-DD
    pub category_primary: Option<String>,
}
```

Handler: call `get_transactions_paginated` + `count_transactions` via `tokio::join!`, return `Json<PaginatedTransactionsResponse>`.

Add new route **before** the `/api/transactions` catch-all:
```
GET /api/transactions/categories → Json<Vec<String>>
```

### Acceptance Criteria
- [ ] `cargo test` passes
- [ ] Migration runs without table locks
- [ ] `?page=1&page_size=10` returns 10 items + correct `total`
- [ ] `?page=2&page_size=10` returns the next 10
- [ ] `?search=coffee` filters server-side
- [ ] `?category_primary=FOOD_AND_DRINK` filters server-side
- [ ] `/categories` returns deduplicated sorted list
- [ ] `page_size > 200` is clamped, not a 5xx

---

## Phase 5: Frontend Transactions Pagination

**Goal:** Replace client-side in-memory slicing with server-driven pagination. Depends on Phase 4.

### Files
- `frontend/src/services/TransactionService.ts`
- `frontend/src/features/transactions/hooks/useTransactions.ts`

### TransactionService.ts

- Accept `page`, `page_size` alongside existing filter params
- Return `{ transactions: Transaction[], total: number, page: number, page_size: number }`
- Add `getTransactionCategories(): Promise<string[]>` calling `GET /api/transactions/categories`

### useTransactions.ts

```ts
// Remove client-side slicing:
// filtered.slice(start, start + pageSize)

// Add server fetch per page:
const fetchPage = useCallback(async (page: number) => {
    const result = await TransactionService.getTransactions({ page, page_size, search, category, ... });
    setTransactions(result.transactions);
    setTotal(result.total);
    setCurrentPage(result.page);
}, [page_size, search, category, ...]);

// On filter change: reset page to 1 and re-fetch
// On mount: fetch categories once from /api/transactions/categories
```

Expose `{ transactions, total, totalPages, currentPage, setCurrentPage, categories, loading }`.
Keep `TransactionsTable` pagination controls unchanged — they already accept `currentPage`, `totalPages`, and navigation callbacks.

### Acceptance Criteria
- [ ] DevTools shows only `page_size` items per response (not all records)
- [ ] Search box triggers server request (not client filter)
- [ ] Category dropdown refetches from server
- [ ] Prev/next buttons fire new requests with updated `page`
- [ ] Category dropdown populated from `/api/transactions/categories` on mount
- [ ] Users with 3000+ transactions can reach all via pagination (no `LIMIT 1000` cap)

---

## Files Modified Summary

| File | Phase | Change |
|------|-------|--------|
| `backend/src/services/repository_service.rs` | 1, 4 | Batch upsert; paginated query, count, categories |
| `backend/src/services/connection_service.rs` | 1 | Replace per-upsert loop with batch chunks |
| `backend/src/services/plaid_service.rs` | 2 | Offset pagination loop |
| `backend/src/providers/teller_provider.rs` | 2 | from_id cursor loop per account |
| `backend/src/services/sync_service.rs` | 3 | Add `reference_date` param |
| `backend/src/models/transaction.rs` | 4 | Add `PaginatedTransactionsResponse` |
| `backend/src/main.rs` | 4 | Expand `TransactionsQuery`, update handler, add categories route |
| `frontend/src/services/TransactionService.ts` | 5 | Pagination params, categories method |
| `frontend/src/features/transactions/hooks/useTransactions.ts` | 5 | Server-side fetch, remove client slicing |
| `backend/src/tests/sync_service_tests.rs` | 3 | Update `calculate_sync_date_range` call sites |
| `backend/src/tests/bank_level_sync_tests.rs` | 3 | Update call sites |
| `backend/migrations/<ts>_add_transactions_user_date_index.sql` | 4 | Composite index |
