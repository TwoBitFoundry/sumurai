# Rework Transactions Page Insights with SQL Aggregation

## Context

The four HeroStatCards at the top of the Transactions page (`Total shown`, `Average size`, `Largest size`, `Recurring`) are computed client-side in a `useMemo` over the `transactions` array returned by `useTransactions`. Since paginated transactions shipped (default `pageSize: 8` on this page), that array only contains the current page, so every metric is wrong:

- `Total shown` counts up to 8 items
- `Average size` averages over 8 transactions
- `Largest size` is the largest *on the current page*, not overall
- `Recurring` (`merchant count >= 3`) is structurally impossible in an 8-row page

Fix: move aggregation into Postgres behind a new endpoint scoped to the same filters as the transactions list. The five dashboard `/api/analytics/*` endpoints are **out of scope** — this is only for the transactions page header.

## Design

- **New endpoint**: `GET /api/transactions/insights` — same query params as `/api/transactions` (search, account_ids, start_date, end_date, category_primary), minus pagination.
- **Aggregation in SQL, single query**: one CTE-based query so the WHERE clause is defined once, only one round trip and one pool connection per request, and the planner can share the filtered scan across all aggregations.
- **Indexing**: rely on the existing composite indexes (see Index strategy below) — no new indexes or materialized views in this change.
- **Auth + filter scoping is identical to the list endpoint**: reuse `AuthorizedQuery<TransactionsQuery>` so user/account scoping and date parsing match exactly — divergence here is the most likely source of subtle bugs.
- **No frontend logic changes** beyond replacing the broken `useMemo` with a query hook. Card layout, copy, and formatters stay the same.

### Response shape

```rust
struct TransactionsInsightsResponse {
    total_count: i64,
    total_spent: f64,           // sum of ABS(amount)
    average_amount: f64,
    largest: Option<LargestTransaction>,   // None when total_count == 0
    recurring_count: i64,        // merchants with >= 3 occurrences (full set)
    recurring_merchants: Vec<String>,      // top 3 by count
    top_categories: Vec<String>,           // top 2 by count, formatted client-side
}
struct LargestTransaction { amount: f64, merchant: String }
```

### Full query

Parameters bind 1:1 with the existing list endpoint so the filter behavior cannot drift:

| `$` | Type | Meaning |
| --- | --- | --- |
| `$1` | `Uuid` | `user_id` (required) |
| `$2` | `Option<&str>` | search term, applied to merchant/name/category like the list query |
| `$3` | `Option<&[Uuid]>` | authorized `account_ids` |
| `$4` | `Option<NaiveDate>` | start date inclusive |
| `$5` | `Option<NaiveDate>` | end date inclusive |
| `$6` | `Option<&str>` | exact `category_primary` |

```sql
WITH filtered AS (
    SELECT
        t.amount,
        COALESCE(NULLIF(t.merchant_name, ''), t.name) AS merchant,
        t.category_primary
    FROM transactions t
    WHERE t.user_id = $1
      AND ($2::text IS NULL OR (
            t.merchant_name   ILIKE '%' || $2 || '%'
         OR t.name            ILIKE '%' || $2 || '%'
         OR t.category_primary ILIKE '%' || $2 || '%'
      ))
      AND ($3::uuid[] IS NULL OR t.account_id = ANY($3))
      AND ($4::date IS NULL OR t.date >= $4)
      AND ($5::date IS NULL OR t.date <= $5)
      AND ($6::text IS NULL OR t.category_primary = $6)
),
aggregates AS (
    SELECT
        COUNT(*)                              AS total_count,
        COALESCE(SUM(ABS(amount)), 0)::float8 AS total_spent,
        COALESCE(AVG(ABS(amount)), 0)::float8 AS average_amount
    FROM filtered
),
largest AS (
    SELECT amount::float8 AS amount, merchant
    FROM filtered
    WHERE merchant IS NOT NULL
    ORDER BY ABS(amount) DESC
    LIMIT 1
),
merchant_counts AS (
    SELECT merchant, COUNT(*) AS c
    FROM filtered
    WHERE merchant IS NOT NULL
    GROUP BY merchant
    HAVING COUNT(*) >= 3
),
recurring AS (
    SELECT
        COUNT(*)::bigint AS recurring_count,
        COALESCE(
            (ARRAY_AGG(merchant ORDER BY c DESC, merchant))[1:3],
            ARRAY[]::text[]
        )                AS recurring_merchants
    FROM merchant_counts
),
top_categories AS (
    SELECT COALESCE(ARRAY_AGG(category_primary ORDER BY c DESC, category_primary), ARRAY[]::text[]) AS categories
    FROM (
        SELECT category_primary, COUNT(*) AS c
        FROM filtered
        WHERE category_primary IS NOT NULL
        GROUP BY category_primary
        ORDER BY c DESC, category_primary
        LIMIT 2
    ) tc
)
SELECT
    a.total_count,
    a.total_spent,
    a.average_amount,
    l.amount       AS largest_amount,
    l.merchant     AS largest_merchant,
    r.recurring_count,
    r.recurring_merchants,
    tc.categories  AS top_categories
FROM aggregates a
LEFT JOIN largest l        ON true
LEFT JOIN recurring r      ON true
LEFT JOIN top_categories tc ON true;
```

Notes:

- The actual `search` predicate must match whatever the existing list query does — copy it from `get_transactions_paginated`. The ILIKE union above is the most likely shape but verify before locking it in.
- Secondary `ORDER BY merchant` / `ORDER BY category_primary` in the `ARRAY_AGG` calls breaks ties deterministically so two equally-recurring merchants don't shuffle between requests.
- `recurring_count` counts *all* qualifying merchants; `recurring_merchants` only names the top 3. The CTE separates these intentionally so the count isn't capped.
- `largest_amount` / `largest_merchant` are NULL when the filtered set is empty. Decode `LargestTransaction` as `None` in that case.
- Cast aggregates to `float8` explicitly to match `f64` decoding in sqlx; `total_count` and `recurring_count` stay `bigint`/`i64`.

### Index strategy

No new indexes. The existing `(user_id, date)` and `(user_id, category_primary)` composite indexes from migration 006 already cover this query's filters. Materialized/indexed views don't fit because the endpoint accepts arbitrary date ranges, account filters, and free-text search — pre-aggregation can't satisfy dynamic filters.

## Critical files

- [backend/src/main.rs](backend/src/main.rs) — handler + route registration + utoipa annotation (model on `get_authenticated_transactions` around line 986)
- [backend/src/services/repository_service.rs](backend/src/services/repository_service.rs) — new repository method; reuse the filter-SQL pattern already used by `get_transactions_paginated` / `count_transactions`
- [backend/src/models/transaction.rs](backend/src/models/transaction.rs) — new response types alongside `PaginatedTransactionsResponse`
- [frontend/src/views/TransactionsPage.tsx](frontend/src/views/TransactionsPage.tsx) — replace the `useMemo` stats block (lines ~33–89)
- [frontend/src/services/TransactionService.ts](frontend/src/services/TransactionService.ts) — new fetcher
- [frontend/src/features/transactions/hooks/useTransactions.ts](frontend/src/features/transactions/hooks/useTransactions.ts) — reference for the filter inputs the new hook must mirror

---

## Phase 1 — Backend: repository aggregation

Add the response types and a single repository method that runs the CTE query against the existing transactions table. Reuse whatever filter helper / WHERE-builder is already shared between `get_transactions_paginated` and `count_transactions` so list and insights can never drift.

**Acceptance criteria**
- [x] Repository method returns aggregates derived purely in SQL — no row-level loading or in-Rust aggregation.
- [x] Filter handling (user_id, account_ids, date range, search, category_primary) is bit-for-bit identical to the existing list/count queries; if a filter helper doesn't exist yet, extract one and have all three callers use it.
- [x] Empty-result case returns zeros and `largest: None` without erroring.
- [x] `cargo check` passes.

TDD log

- Added repository coverage for filtered insights, recurring threshold handling, user isolation, and empty results.
- Ran `cargo test --manifest-path backend/Cargo.toml repository_service_tests`.
- Ran `cargo check --manifest-path backend/Cargo.toml`.

## Phase 2 — Backend: handler, route, tests

Add the handler in `main.rs` modeled on `get_authenticated_transactions`, wire the route, and register it in the utoipa OpenAPI macro. Use the same `AuthorizedQuery<TransactionsQuery>` extractor (page/page_size fields ignored). Add boundary tests per the `sumurai-testing-policy` skill — test through the HTTP/handler boundary, not by calling the service directly.

**Acceptance criteria**
- [x] `GET /api/transactions/insights` returns 200 with the documented shape for an authenticated user.
- [x] Same auth/account-scoping behavior as the list endpoint (401 unauth, 403 cross-user account filter, 400 invalid date range).
- [x] Tests cover: mixed positive/negative amounts produce correct totals; recurring threshold of `>= 3` works at the boundary (a merchant with exactly 2 is excluded, exactly 3 is included); another user's transactions are excluded; date/category/account filters pass through; empty result returns zeros and null largest.
- [x] OpenAPI schema includes the new endpoint and types.
- [x] `cargo test` passes.

TDD log

- Added handler-level integration coverage for success, empty result, 401, 403, and invalid date range cases.
- Ran `cargo test --manifest-path backend/Cargo.toml integration_tests`.
- Ran `cargo check --manifest-path backend/Cargo.toml`.

## Phase 3 — Frontend: hook + page wiring

Add the response type, a service method, a React Query hook (`useTransactionsInsights`) keyed by the same filter inputs as `useTransactions` but without `currentPage` / `pageSize`, and swap the `useMemo` in `TransactionsPage.tsx` for the hook. Keep card markup and formatters as-is.

**Acceptance criteria**
- [ ] The four HeroStatCards render from the new endpoint's response; the `useMemo` block is deleted.
- [ ] Insights and the transactions list are independent React Query queries — paging the table does not refetch insights, and changing a filter refetches both.
- [ ] The hook's query key includes every filter input that affects results (search, selected category, account IDs, date range) and excludes pagination state.
- [ ] Cards show a loading state independently of the table; an insights error does not break table rendering.
- [ ] Type checking + frontend test suite pass.

## Phase 4 — End-to-end verification

Run the app and exercise the page against real data; this is the gate that proves pagination no longer corrupts the metrics.

**Acceptance criteria**
- [ ] With a user that has >8 transactions: `Total shown` equals the table's `totalItems` footer.
- [ ] Paging the table leaves all four stat cards unchanged (verify via Network tab: insights endpoint does not refire on page change).
- [ ] `Largest size` shows a transaction not present on the current page when one exists.
- [ ] `Recurring` reflects merchants with 3+ occurrences across the *full filtered set*, not the current page.
- [ ] Changing date range / category / search updates both the table and the cards consistently.
- [ ] New endpoint visible and accurate in the OpenAPI / Swagger docs.

---

## Handoff notes for the implementing agent

- Don't introduce new abstractions beyond extracting the shared filter helper if it doesn't already exist — list, count, and insights are the only callers.
- Don't touch the `/api/analytics/*` endpoints or `analytics_service.rs`; they have separate (legitimate) problems but are not in this scope.
- Don't expand the metric set — the four cards on the page are the contract. Adding "income vs spending", "week-over-week", etc. is a follow-up if the user asks.
- If the existing list/count queries don't have a shared filter helper, creating one is in scope for Phase 1 and the list/count callers should be updated to use it in the same change.
