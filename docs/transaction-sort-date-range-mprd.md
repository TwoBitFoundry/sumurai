# Transaction Sort & Date Range Filter — MPRD

## Goal

Add column sorting to the desktop transaction table and a contextual sort + date-range filter panel to the mobile/tablet view. Preferences persist in session (not in the database).

## Assumptions & Key Facts

- Backend `amount` is `rust_decimal::Decimal`; `date` is `NaiveDate`; `normalized_merchant` is `Option<String>`.
- Effective category = `COALESCE(o.category_name, t.category_primary)` — already an expression in `repository_service.rs` (`effective_category_expr()` / `sql_effective_category_expr()`).
- Current cursor is `base64("date:id")` — will be generalized.
- Cursor-based keyset pagination: WHERE clause must be rewritten per sort field; ORDER BY must match.
- `sort` and `order` fields already exist in `TransactionWindowFilters` but are unused end-to-end.
- `startDate`/`endDate` already exist in `TransactionWindowFilters` and flow through `useTransactionFilters` and the backend — no backend changes needed for date range.
- Session storage pattern: `sessionPreferences.ts`, `SESSION_KEYS` map, typed getter/setter pairs.
- Mobile chrome lives in `AuthenticatedApp.tsx` inside a `BottomContextualBar`; search bar is `TransactionsSearchBar`.
- Desktop column headers are static `<div role="columnheader">` elements in `VirtualizedTransactionList.tsx`.
- Multi-sort: desktop sets primary sort; secondary "then by" set via mobile panel, shared state.
- Desktop column click: toggle asc ↔ desc on the same column; click different column → new primary.
- Sortable columns: Date, Merchant, Amount, Category. Account is filter-only.

## Risks

- Cursor generalization is the highest-risk backend change — carefully test with paginated results for all four sort fields.
- `normalized_merchant` can be NULL — use `COALESCE(normalized_merchant, merchant_name, '')` for sort and cursor.
- Decimal amounts need to encode as a fixed-width or string-safe format in the cursor (use `to_string()` for Decimal, which is exact).
- `effective_category_expr()` returns a `sea_orm::sea_query::SimpleExpr` — it can't be used directly as a column reference for ORDER BY in SeaORM; use `Expr::cust(sql_effective_category_expr())` for ordering.
- The `get_transactions_keyset` trait method signature change will require updating the mock/stub implementations used in tests.

---

## Phase 1 — Session + Filter State

**Goal**: Extend frontend session preferences and filter state to hold sort and date-range values.

### Tasks
- Add four session keys to `SESSION_KEYS` in `frontend/src/utils/sessionPreferences.ts`:
  - `sumurai.ui.transactionsSort` — JSON `{ field: SortField, order: SortOrder }`
  - `sumurai.ui.transactionsSort2` — JSON `{ field: SortField, order: SortOrder } | null`
  - `sumurai.ui.transactionsStartDate` — ISO date string or absent
  - `sumurai.ui.transactionsEndDate` — ISO date string or absent
- Add typed getter/setter functions for each key following the existing `getSession*`/`setSession*` pattern
- Export `SortField = 'date' | 'amount' | 'merchant' | 'category'` and `SortOrder = 'asc' | 'desc'` from `frontend/src/features/transactions/models/transactionWindow.ts` (replace the current inline union literals in `TransactionWindowFilters`)
- Add `sort2` and `order2` fields to `TransactionWindowFilters` in `transactionWindow.ts`
- Extend `useTransactionFilterState` (`frontend/src/features/transactions/hooks/useTransactionFilterState.ts`) with:
  - `sort: { field: SortField; order: SortOrder } | null` + `setSort`
  - `sort2: { field: SortField; order: SortOrder } | null` + `setSort2`
  - `startDate: string | null` + `setStartDate`
  - `endDate: string | null` + `setEndDate`
  - Each setter reads/writes the corresponding session key

### Acceptance Criteria
- [ ] `getSessionTransactionsSort()` returns null on fresh session, then the saved value after `setSessionTransactionsSort({ field: 'amount', order: 'desc' })`
- [ ] Same for sort2, startDate, endDate
- [ ] `useTransactionFilterState` initialises all four from session on mount
- [ ] `TransactionFilterControl` type reflects the new fields
- [ ] Existing `search` and `selectedCategory` session behaviour is unchanged
- [ ] `bun --cwd=frontend test` passes

---

## Phase 2 — Filter Wiring (Frontend → Backend)

**Goal**: Thread sort and date-range values all the way from filter state to the API request, without any backend changes yet.

### Tasks
- `useTransactionFilters` (`frontend/src/features/transactions/hooks/useTransactionFilters.ts`):
  - Add `sort`, `order`, `sort2`, `order2` to `resolvedFilters` (no debounce — apply immediately)
  - Add them to the `filterKey` string (append `sort|order|sort2|order2` segments)
  - `startDate` and `endDate` are already in `resolvedFilters`; verify they also appear in `filterKey`
- `TransactionService.getTransactionsPage` / `buildTransactionFiltersParams` (`frontend/src/services/TransactionService.ts`):
  - Append `sort`, `order` when present
  - Append `sort2`, `order2` when present
- `TransactionsPage` (`frontend/src/views/TransactionsPage.tsx`):
  - Destructure `sort`, `order`, `sort2`, `order2`, `startDate`, `endDate` from `filterControl`
  - Include them in the `filters` object passed to `VirtualizedTransactionList`
  - Also pass `startDate`/`endDate` to `useTransactionsContextualInsights` (replace current `dateRange: undefined`)

### Acceptance Criteria
- [ ] Network request for transactions includes `sort=amount&order=desc` query params when those are set in state
- [ ] Network request includes `sort2=date&order2=desc` when secondary sort is set
- [ ] Network request includes `start_date=...&end_date=...` when date range is set
- [ ] Changing sort state triggers a fresh fetch (filterKey changed)
- [ ] `bun --cwd=frontend test` passes

---

## Phase 3 — Backend Sort Implementation

**Goal**: Implement sort-aware keyset cursor pagination in the Rust backend for all four sort fields.

### Tasks

#### `backend/src/main.rs`
- Add `sort: Option<String>` and `order: Option<String>` to the transactions query struct (replace the current "reserved" stub)
- Add `sort2: Option<String>` and `order2: Option<String>`
- Define `TransactionSortField` enum (`Date`, `Amount`, `Merchant`, `Category`) and `SortOrder` enum (`Asc`, `Desc`) — place in a new `models/sort.rs` or inline in main handler
- Parse from query params (unknown values fall back to `Date`/`Desc`)
- Pass the parsed enums to `repository_service.get_transactions_keyset`

#### `backend/src/services/repository_service.rs` — trait
- Update `get_transactions_keyset` signature to accept `sort_field: TransactionSortField`, `sort_order: SortOrder`, `sort2_field: Option<TransactionSortField>`, `sort2_order: Option<SortOrder>`

#### `backend/src/services/repository_service.rs` — impl

**Cursor encoding** — replace `format!("{}:{}", date, id)` with `format!("{}|{}|{}|{}", f1_val, f2_val_or_empty, id, sort_field_tag)`:
- Date: `f1_val = date.to_string()` (`YYYY-MM-DD`)
- Amount: `f1_val = amount.to_string()` (Decimal's `Display` is exact, e.g. `"-117.74"`)
- Merchant: `f1_val = normalized_merchant.unwrap_or_default()` (COALESCE to `""`)
- Category: `f1_val = effective_category` (the resolved string value)
- `f2_val_or_empty`: same logic for secondary sort field, or `""` if none
- Append `sort_field_tag` (e.g. `"date"`, `"amount"`) so the decoder knows how to parse `f1_val`

**Cursor decoding** — parse the new format; fall back gracefully to the legacy `date:id` format for clients that sent an old-style cursor (detect by checking if segments split on `|` yields 4 vs 2 parts)

**Keyset WHERE clause** — replace the hardcoded `Date.lt / Date.eq` block with a helper `build_keyset_filter(field, order, primary_val, secondary_field, secondary_val, id)` that returns a SeaORM `Condition`:
```
For desc primary:
  (col1 < val1) OR (col1 = val1 AND col2 < val2) OR (col1 = val1 AND col2 = val2 AND id < cursor_id)
For asc primary: flip lt/gt
```
- Amount column: `transactions::Column::Amount`
- Merchant column: use raw SQL expression `COALESCE(t.normalized_merchant, t.merchant_name, '')`
- Category column: use `Expr::cust(sql_effective_category_expr())`
- Date column: existing `transactions::Column::Date`
- ID tiebreaker: `transactions::Column::Id` (UUID, lexicographic order matches insertion order for stable pagination)

**ORDER BY** — build dynamically:
```rust
match (sort_field, sort_order) {
    (Amount, Asc)  => q.order_by_asc(transactions::Column::Amount),
    (Amount, Desc) => q.order_by_desc(transactions::Column::Amount),
    (Merchant, Asc)  => q.order_by_asc_expr(coalesce_merchant_expr()),
    ...
    (Date, Desc) => q.order_by_desc(transactions::Column::Date),  // existing
    ...
}
// then secondary sort field if set
// always append .order_by_desc(transactions::Column::Id) as final tiebreaker
```

**Cursor value extraction from result rows** — after fetching, get `f1_val` from the last row for `next_cursor`:
- Date: `last.date.to_string()`
- Amount: `last.amount.to_string()`
- Merchant: `last.normalized_merchant.clone().unwrap_or_default()`
- Category: `last.category_primary.clone()` (already resolved to effective category in the SELECT)

#### Update test stubs
- Any mock `RepositoryService` in `backend/src/tests/` that implements the trait must be updated to match the new `get_transactions_keyset` signature (add default params, propagate or ignore)

### Acceptance Criteria
- [ ] `GET /transactions?sort=date&order=asc` returns transactions in ascending date order across page boundaries
- [ ] `GET /transactions?sort=amount&order=desc` returns largest transactions first, stable across pages
- [ ] `GET /transactions?sort=merchant&order=asc` returns alphabetical by merchant, NULLs last
- [ ] `GET /transactions?sort=category&order=asc` uses effective category (override wins over stored)
- [ ] `GET /transactions?sort=amount&order=desc&sort2=date&order2=desc` applies secondary sort
- [ ] Sending an old-style `date:id` cursor with the new backend doesn't panic (graceful fallback)
- [ ] `cargo test -p sumurai-backend --locked` passes

---

## Phase 4 — UI: Desktop Headers + Mobile Panel

**Goal**: Wire sort state to the desktop column headers and build the mobile sort/date-range panel.

### Tasks

#### Desktop column headers (`frontend/src/features/transactions/components/VirtualizedTransactionList.tsx`)
- Add props: `sort: { field: SortField; order: SortOrder } | null`, `onSort: (field: SortField, order: SortOrder) => void`
- Extract a local `SortableColumnHeader` component (file-local, not exported):
  - Renders label + `ArrowUp` or `ArrowDown` from lucide
  - When inactive: arrow is hidden or rendered in `uiTextRecipes.subtle`
  - When active: arrow visible in accent color, direction matches current order
  - Click: if this column is already active → toggle order; if not → call `onSort(field, 'desc')` (default to desc on first click)
- Replace static `<div role="columnheader">` for Date, Merchant, Amount, Category with `<SortableColumnHeader>`; Account header stays static
- `TransactionsPage.tsx`: destructure `sort`, `setSort` from `filterControl`; create `handleSort(field, order)` that calls `setSort({ field, order })`; pass `sort` and `onSort` down

#### Mobile sort/filter panel (`frontend/src/features/transactions/components/TransactionSortFilterPanel.tsx`)
New component. Positioned as a popover anchored above the floating chrome bar (follow `HeaderAccountFilter` pattern: `createPortal` to `document.body`, fixed position calculated from a trigger ref).

Contents:
```
Sort
  [ Date | Merchant | Amount | Category ]  [ ↑ | ↓ ]   ← primary row

Then by  (disabled until primary chosen)
  [ Date | Merchant | Amount | Category ]  [ ↑ | ↓ ]   ← secondary row
  [Clear secondary]

Date Range
  From: [____] — To: [____]   [Clear]
```
- Pill-button groups for field selection (only one active per row); direction toggles asc/desc
- `<input type="date">` for From/To, styled with `Input` component `variant="floatingChrome"` or `variant="default"` depending on design context
- All changes are immediately applied to parent state (controlled) — no "Apply" button needed
- "Clear all" resets sort, sort2, startDate, endDate

#### Mobile trigger (`frontend/src/components/AuthenticatedApp.tsx`)
- Add `[isFilterPanelOpen, setIsFilterPanelOpen]` state
- In the transactions `BottomContextualBar` children slot, render `TransactionsSearchBar` + a `SlidersHorizontal` icon button (lucide) to its right
- Badge the icon with a filled dot when any of `sort`, `sort2`, `startDate`, `endDate` is set (indicate active filters)
- Render `TransactionSortFilterPanel` when `isFilterPanelOpen` is true, passing filterControl fields

### Acceptance Criteria
- [ ] Clicking "Date" desktop header once → `sort=date&order=desc` in network request, down-arrow visible
- [ ] Clicking "Date" again → `order=asc`, up-arrow visible; clicking again → back to `order=desc`
- [ ] Clicking "Amount" header when Date is active → primary switches to amount, secondary unaffected
- [ ] Sort state survives tab navigation and returns on returning to Transactions tab
- [ ] Mobile: sliders icon appears to the right of the search bar
- [ ] Mobile panel opens on tap, shows all controls
- [ ] Choosing "Amount ↓" → list re-fetches with `sort=amount&order=desc`
- [ ] Adding "Then by Date ↓" → request adds `sort2=date&order2=desc`
- [ ] From/To date inputs add `start_date`/`end_date` to the request
- [ ] Badge dot appears on sliders icon when any sort/date filter is active
- [ ] `bun --cwd=frontend test` passes

---

## File Map

| File | Change |
|------|--------|
| `frontend/src/utils/sessionPreferences.ts` | Add 4 session keys + getters/setters |
| `frontend/src/features/transactions/models/transactionWindow.ts` | Export `SortField`, `SortOrder`; add `sort2`/`order2` fields |
| `frontend/src/features/transactions/hooks/useTransactionFilterState.ts` | Add sort, sort2, startDate, endDate state + session persistence |
| `frontend/src/features/transactions/hooks/useTransactionFilters.ts` | Add sort/order/sort2/order2 to resolvedFilters + filterKey |
| `frontend/src/services/TransactionService.ts` | Append sort params in `buildTransactionFiltersParams` |
| `frontend/src/views/TransactionsPage.tsx` | Pass sort + date range to list + insights |
| `frontend/src/features/transactions/components/VirtualizedTransactionList.tsx` | Sortable column headers |
| `frontend/src/features/transactions/components/TransactionSortFilterPanel.tsx` | New — mobile sort + date range panel |
| `frontend/src/components/AuthenticatedApp.tsx` | Add sliders button + panel to transactions chrome |
| `backend/src/main.rs` | Parse sort/order/sort2/order2 params, pass to keyset fn |
| `backend/src/services/repository_service.rs` | Generalise cursor encoding/decoding; dynamic ORDER BY + WHERE |
| `backend/src/tests/*.rs` | Update mock trait impls for new keyset signature |
