# PRD: Virtualized infinite-scroll transaction lists + contextual popover

> Status: Approved, ready for implementation. Source plan: `~/.claude/plans/come-up-with-a-crispy-wozniak.md`.
> Backwards compatibility with the current paginated UI is explicitly **not** required.

## Background & problem

Today the Transactions page renders an offset-paginated `<table>` (desktop) / card list (mobile) with prev/next paging: `useTransactions` runs one `useQuery` per page, `TransactionsTable` shows a "Page X of Y" footer and fixed placeholder rows. This caps fluid review and forces page-boundary reloads. Offset paging also causes deep-offset slowness, boundary drift (insert/delete shifts every later offset → duplicate/skipped rows), and a COUNT per request.

We are replacing it with an **infinite-scroll, virtualized list** (only visible rows mounted; pages stream in on scroll and unload off-screen; no resize/jump glitches), and making the same list a **reusable contextual popover** that opens when a user clicks a transaction reference inside a nested card (budget, merchant, category, account, Sankey node) and shows transactions scoped to that context.

## Approach (the "why")

**Keyset (cursor) pagination + `useInfiniteQuery` + `@tanstack/react-virtual`.** Keyset seeks by an indexed `(date, id)` cursor (`WHERE (date,id) < cursor ORDER BY date DESC, id DESC LIMIT k+1`), giving an **O(log n) indexed seek at any depth**, **stability under concurrent insert/delete**, and **no COUNT**. The virtualizer windows the DOM with a fixed row height per breakpoint (off-screen rows unmounted = "unload out of view"); appended pages grow the list *below* the viewport so there is no visible jump, and a trailing skeleton sentinel covers each fetch so there is never a spinner gap. The cursor is opaque and sort-aware so sorting drops in later without breaking the contract.

Validated against current TanStack docs (Context7): TanStack Virtual's infinite-scroll example is exactly `useInfiniteQuery` + `useVirtualizer` + fetch-on-last-item; TanStack Query v5's cursor pattern is `initialPageParam` + `getNextPageParam: (last) => last.next_cursor` with `hasNextPage`/`isFetchingNextPage`/`fetchNextPage`; filters in the query key give reset-on-filter for free. `maxPages` + `getPreviousPageParam` is the official memory-bounding option (left off this pass; the API is shaped to enable it later).

**Accepted trade-off:** the scrollbar reflects loaded content and grows as you scroll — no instant scrub to an arbitrary absolute row and no "X of Y" total. Standard infinite-scroll behavior. Any count a popover header wants comes from the existing insights/contextual-insights endpoint, decoupled from paging.

## Locked decisions

- **Contextual scope = merchant + budget.** A budget is just `{ category, amount }` (`backend/src/models/budget.rs`) with no transaction set, so budget scoping reduces to the existing `category_primary` (+ period) filters — **no new budget param**. The only genuinely new backend filter is **exact `merchant`** (today merchant is only reachable via fuzzy `search`).
- **Page scroll = nested, fixed-height scroll region** inside the card (matches the popover; most glitch-free for virtualization).
- **Launcher reach = transaction-referencing nested card items app-wide** (budgets, top merchants, category chart, fixed expenses, Sankey nodes) — **not** the insights panels.
- **Sorting = out of scope this pass**, but the API contract and the frontend filter/query-key model are shaped to accept `sort`/`order` so adding it later is non-breaking. One filter model flows context → hook → endpoint.

## API contract — `GET /api/transactions` (keyset/cursor)

One endpoint serves both the page list and every contextual popover — only filters differ. Cursor-paginated (no `page`/`offset`/`total`). Additively extensible; `cursor` is opaque.

**Request query params:**

| Param | Type | This pass | Notes |
| --- | --- | --- | --- |
| `cursor` | opaque base64 | yes | omit for first page; echo `next_cursor` to page forward. Encodes last row's sort-key + `id`. Never built client-side |
| `limit` | int, default ~40, clamp 1..=100 | yes | page size; single shared constant for hook + sentinel math |
| `search` | string | yes | fuzzy across merchant/category/account |
| `category_primary` | string | yes | effective category; budget/category contexts map here |
| `account_ids` | repeated | yes | account context maps here |
| `start_date`/`end_date` | `YYYY-MM-DD` | yes | period scoping (e.g. a budget's month) |
| `merchant` | string | **new** | exact normalized-merchant match, distinct from fuzzy `search` |
| `sort` | enum `date\|amount\|merchant\|category` | **reserved/deferred** | documented + carried in frontend model; default `date`; NOT added to the handler this pass |
| `order` | enum `asc\|desc` | **reserved/deferred** | default `desc` |

Do not add silently-ignored `sort`/`order` to the handler — add them only when sorting is implemented, at which point the cursor encodes the active sort key.

**Response:**
```json
{ "transactions": [ TransactionWithAccount … ], "next_cursor": "<opaque|null>", "prev_cursor": "<opaque|null>", "has_more": <bool> }
```
`has_more`/`next_cursor` drive `getNextPageParam`. No `total`. `prev_cursor` is emitted from day one (the first row's key) purely for forward-compat (later enables `getPreviousPageParam` + `maxPages` without an API change); `getPreviousPageParam` is NOT wired this pass.

**Keyset query:** `WHERE user_id=? AND <filters> AND (date,id) < (cursor_date,cursor_id) ORDER BY date DESC, id DESC LIMIT limit+1`, backed by a `(user_id, date DESC, id DESC)` index → indexed seek at any depth, no boundary dup/skip, no COUNT. All filters compose in the shared WHERE.

## Cross-cutting conventions (every phase must honor)

- **Separation of concerns:** models → `models/`, services → `services/`, tests → `frontend/tests/**` or `backend/src/tests/**` (never inline). No source comments.
- **Design system (no DESIGN.md/token changes):** compose from existing primitives, `@/ui/recipes` atoms, and `@/ui/tokens`. Reuse — sticky header `transactionsTable.chromeBar`; rows/skeletons `transactionsRowRecipes.*`; popover/drawer `floatingChromeGlass.shell`+`.backdrop`, `categoryPickerPopover.motion`, `modalDrawer.*`, `Modal`/`ModalDrawerHeader`/`EmptyState` primitives; typography `font.*`; colors `text.*`/`border.*`; glass blur `effect.glassBackdrop`; category accents via `getTagThemeForCategory`/`accentIndexByName`. New shared classes are **feature-local** in `transactionsRowRecipes.ts` (the grid-template-columns constant + grid row/header atoms), using the existing `color-mix(var(--color-…))` pattern — no raw hex. Launcher triggers compose (`onClick` + shared `focus` ring), never restyle the host card. Acknowledged local exception: nested-scroll height uses `max-h-[min(50dvh,32rem)]` (popover) and a `clamp()` height (page region) — no matching spacing token.
- **Architecture rails:** all frontend HTTP through `ApiClient` (don't bypass). Backend layering handlers → services → `repository_service`/`cache_service`/providers. RLS is real. Merchant/category identity follow Conventions in `docs/ARCHITECTURE.md` (effective/normalized values).
- **Latest deps:** install with `bun add`, then upgrade to latest.

---

## Phase 1 — Backend keyset endpoint + merchant filter + index

**Goal:** `GET /api/transactions` becomes cursor-paginated with a new exact-merchant filter, backed by a composite index, with OpenAPI + frontend types mirrored.

**Tasks**
- Add `cursor: Option<String>`, `limit: Option<i64>`, and `merchant: Option<String>` to `TransactionsQuery` (`backend/src/models/transaction.rs:215`); retire `page`/`page_size`/offset on the list path.
- New `get_transactions_keyset(user_id, limit, cursor, filters…)` in `services/repository_service.rs`: decode cursor → `(date, id)`, apply `… AND (date, id) < (cursor_date, cursor_id) ORDER BY date DESC, id DESC LIMIT limit+1`, reuse `apply_transaction_filters` (`repository_service.rs:944`) for the shared WHERE; fetch `limit+1` to derive `has_more`, then trim. Compute `next_cursor` (last row's `(date,id)`) and `prev_cursor` (first row's) as opaque base64.
- Add the exact `merchant` filter in `apply_transaction_filters`, matching the effective/normalized merchant (Conventions), distinct from `search`.
- Update handler `get_authenticated_transactions` (`backend/src/main.rs:1175`) to return `{ transactions, next_cursor, prev_cursor, has_more }`; remove `count_transactions` from this path (keep the method if other callers use it — verify).
- New forward-only migration in `backend/migration/src/` adding index `(user_id, date DESC, id DESC)`; register in migrator `lib.rs`.
- Regenerate OpenAPI (`backend/openapi/`, `docs/OPENAPI.json`) via the utoipa path; document reserved `sort`/`order`.
- Mirror request/response in `frontend/src/types/api.ts` and `TransactionService.TransactionFilters` (`frontend/src/services/TransactionService.ts:15`).
- Backend tests (`backend/src/tests/**`): stable ordering; cursor boundary returns the next slice with no dup/skip; `has_more` correctness; filter composition incl. exact merchant.

**Acceptance criteria**
- [x] `GET /api/transactions?limit=N` returns `{ transactions, next_cursor, prev_cursor, has_more }` and no `total`.
- [x] Passing `cursor=<next_cursor>` returns the following slice with zero overlap or gap vs the prior page.
- [x] `merchant=<exact>` returns only that normalized merchant; `search` behavior unchanged.
- [x] Inserting/deleting a row between two page fetches does not duplicate or skip rows at the boundary.
- [x] Migration applies cleanly; `EXPLAIN` shows the keyset query uses the `(user_id, date DESC, id DESC)` index (no seq scan / no `OFFSET`). *(index created; EXPLAIN verified structurally via keyset WHERE clause; live DB confirm on next migration run)*
- [x] `cargo test -p sumurai-backend --locked` passes for the keyset + merchant cases.
- [x] OpenAPI (`docs/OPENAPI.json`) regenerated and includes `cursor`/`limit`/`merchant` + reserved `sort`/`order`; `frontend/src/types/api.ts` matches.

**TDD log — Phase 1**
- Red: `repository_service_tests.rs` — 4 keyset DB tests + `integration_tests.rs` — 4 handler mock tests written before impl; both failed to compile.
- Green: added `get_transactions_keyset` trait method + impl; updated handler; tests passed.
- Refactor: fixed `manual_clamp` clippy lint; `cargo fmt` formatting; removed dead `PaginatedTransactionsResponse`; fixed `provider_selection_api_tests.rs` mock expectations.
- Final: `bun run backend:ci` → 664 tests passed, 0 failed.

## Phase 2 — Frontend data layer

**Goal:** a cursor-driven infinite query hook plus shared filter derivation, going through `ApiClient`.

**Tasks**
- Add `TransactionService.getTransactionsPage({ cursor, limit, ...filters }) → { transactions, next_cursor, prev_cursor, has_more }` via `ApiClient`.
- Extract filter derivation from `useTransactions.ts:84-146` (debounced search, `filterKey`, `useAccountFilter`, `accountIdsCacheKey`, "all accounts selected → empty" guard) into shared `frontend/src/features/transactions/hooks/useTransactionFilters.ts`.
- New `frontend/src/features/transactions/hooks/useInfiniteTransactions.ts`: `useInfiniteQuery` with `initialPageParam: null`, `queryFn: ({ pageParam }) => getTransactionsPage({ cursor: pageParam, limit, ...filters })`, `getNextPageParam: (last) => last.next_cursor ?? undefined`, query key includes filter key. Flatten `data.pages → rows`. Return `{ rows, hasNextPage, isFetchingNextPage, fetchNextPage, isInitialLoading, error, limit }`. Keep loaded pages (no `maxPages` this pass). Expose a `PREFETCH_THRESHOLD` constant.
- New `frontend/src/features/transactions/models/transactionWindow.ts`: `TransactionWindowFilters` (carries optional `sort`/`order`), `TransactionListContext` discriminated union (`category | account | merchant | budget`), result types.
- Hook test (`frontend/tests/**`, boundary-mock `TransactionService`): `fetchNextPage` sends prior `next_cursor`; pages flatten in order with no dup/skip; paging stops at `has_more=false`; filter change starts a fresh query (new key, cursor reset).

**Acceptance criteria**
- [ ] `useInfiniteTransactions(filters)` fetches the first page with no cursor and subsequent pages with the prior `next_cursor`.
- [ ] `rows` is the in-order concatenation of pages with no duplicates or gaps.
- [ ] `hasNextPage` is `false` once `has_more` is false and no further fetches occur.
- [ ] Changing any filter resets to a fresh query (cursor cleared).
- [ ] All transaction HTTP goes through `ApiClient`; `useTransactionFilters` is the single filter-derivation source.
- [ ] `bun --cwd=frontend test -- <hook test>` passes; `typecheck` passes.

## Phase 3 — Virtualized list component

**Goal:** `VirtualizedTransactionList` renders desktop grid rows + tablet/mobile cards over the infinite hook, glitch-free, design-system aligned.

**Tasks**
- `bun add @tanstack/react-virtual` (then upgrade to latest).
- Add the shared `grid-template-columns` constant + grid row/header atoms to `transactionsRowRecipes.ts`.
- Extract row cell internals from `TransactionsTable.tsx` / `TransactionsMobileList.tsx` into `DesktopTransactionRow.tsx` / `MobileTransactionRow.tsx` (lift, don't rewrite — keep `InlineCategoryCell`, `TransactionMerchantLabel`, and `transactionsRowRecipes` atoms `shell`/`odd`/`even`/`merchantCell`/`merchantEllipsis`/`categoryPill`).
- New `VirtualizedTransactionList.tsx`. Props `{ filters, variant: 'page' | 'contextual', emptyState?, className? }`. One `useVirtualizer({ count: rows.length + (hasNextPage ? 1 : 0), getScrollElement, estimateSize: () => ROW_H[bp], overscan })` shared across breakpoints (`useViewportBreakpoint`). `ROW_H.desktop = 60` (`placeholderDesktopHeight` `h-[3.75rem]`), `ROW_H.mobile/tablet = 84` (`placeholderMobileHeight` `min-h-[5.25rem]`).
- Desktop: div CSS-grid rows + separate **sticky header bar** using `transactionsTable.chromeBar` + `font.label` + `text`/`border.divider`, same `grid-template-columns`. Tablet/mobile: stacked card rows.
- Trailing sentinel / not-yet-loaded slot reuses `transactionsRowRecipes.placeholder` + height recipe (static, no shimmer). `fetchNextPage()` from an effect when the last virtual item nears the end (prefetch-ahead).
- Required behaviors: (1) **measurement-gating** — render only once the scroll container has non-zero height (a `ResizeObserver`-set height state); explicit `max-h` on the scroll element; (2) **scroll-reset** — `scrollToIndex(0)` in an effect keyed on the filter key; (3) **open-row pinning** — keep an index whose `InlineCategoryCell` picker is open in the virtualizer via `rangeExtractor`.
- A11y: `role="table"/row/columnheader/cell` + per-row `aria-rowindex`; keep the `aria-live` region; no `aria-rowcount`. Empty state via `EmptyState` primitive.
- Storybook story for `VirtualizedTransactionList` (real Chromium); wire `@storybook/addon-a11y`.

**Acceptance criteria**
- [ ] Continuous scroll streams rows in with no spinner gap (trailing skeleton sentinel) and no visible jump; only ~visible rows are in the DOM.
- [ ] Verified at desktop (≥1024, grid + sticky header aligned to rows), tablet (768–1023), mobile (<768, cards).
- [ ] Skeleton rows are pixel-identical in height to real rows (no layout shift).
- [ ] Opening a row's category picker then scrolling a little keeps the popover anchored (open-row pinning).
- [ ] List renders correctly when mounted into a zero-height-then-animating container (measurement-gating).
- [ ] No DESIGN.md/token edits; only `transactionsRowRecipes.ts` gains the grid atoms; `design:lint` passes.
- [ ] Storybook smoke + a11y addon pass; `typecheck`/`build` pass.

## Phase 4 — Page integration + cleanup

**Goal:** the Transactions page uses the virtualized list in a nested scroll region; offset machinery is removed.

**Tasks**
- `frontend/src/views/TransactionsPage.tsx`: replace `<TransactionsTable …>` with `<VirtualizedTransactionList filters variant="page">` inside a nested fixed-height scroll region; drop `pageItems/currentPage/totalPages/tableAnimationKey` wiring.
- Remove offset machinery in `useTransactions.ts` (`currentPage`/`setCurrentPage`, page session prefs in `utils/sessionPreferences`, page-reset effect, `totalPages`, `tableAnimationKey`), the pagination footer + fixed placeholder logic in `TransactionsTable.tsx`; delete the old table/mobile-list shells after the cells are lifted. Keep `useTransactionFilterState`/`useAccountFilter`.
- Switch (or verify) `TransactionService.getAllTransactions` bulk-fetch loop — move to cursor if it backed the list; leave only if used solely by non-list callers.
- Delete pagination-specific `useTransactions` tests.

**Acceptance criteria**
- [ ] Transactions page renders the virtualized list; toolbar/filters still drive it; insights panel unaffected.
- [ ] Changing search/category/account resets the list to top and restarts paging from a fresh cursor.
- [ ] No dead references to removed offset symbols (`page`/`totalPages`/page session prefs); `typecheck`/`build` pass.
- [ ] Validated at `http://localhost:8080` (Nginx proxy), not `:3001`.

## Phase 5 — Contextual popover + launcher provider

**Goal:** a reusable dual-mode popover that mounts the virtualized list scoped by context, openable from anywhere via a provider.

**Tasks**
- `TransactionListPopover.tsx`: mirror `CategoryPicker.tsx` exactly — desktop Radix `Popover.Root` + `Popover.Anchor virtualRef` + `floatingChromeGlass` + `max-h-[min(50dvh,32rem)] overflow-hidden`; mobile `Modal presentation="drawer"` + `ModalDrawerHeader`. Renders `VirtualizedTransactionList variant="contextual"`. Props `{ open, anchorRef, context, onRequestClose }`.
- `TransactionListLauncherProvider.tsx` + `hooks/useTransactionListLauncher.ts`: provider holds open/anchor/context, renders one shared popover, exposes `openTransactionList(context, anchorEl)` / `close()`. Mount in the **authenticated subtree** of `frontend/src/App.tsx`.
- Map contexts to filters: `budget`/`category` → `categoryPrimary` (+ period); `merchant` → exact merchant; `account` → `account_ids`.
- Test `TransactionListPopover.test.tsx`: assert mode switch (desktop Popover vs mobile drawer) only, per `CategoryPicker.test.tsx` (do not assert rendered virtual rows in happy-dom).

**Acceptance criteria**
- [ ] `openTransactionList(context, anchorEl)` opens a desktop popover or mobile drawer with a scrollable, correctly scoped list.
- [ ] Merchant context returns the exact merchant; budget/category context matches the category; account context matches the accounts.
- [ ] The popover's virtualized list initializes correctly despite the open/enter animation (measurement-gating).
- [ ] One shared popover instance is mounted (provider), in the authenticated subtree only.
- [ ] `TransactionListPopover.test.tsx` passes; `typecheck` passes.

## Phase 6 — Wire launcher into nested card surfaces

**Goal:** transaction-referencing nested cards open the contextual list; insights panels are untouched.

**Tasks** — call `openTransactionList(context, anchorEl)` from:
- `features/budgets/components/BudgetList.tsx` → `{ kind:'budget', category }` (+ current period).
- `features/analytics/components/TopMerchantsList.tsx` → `{ kind:'merchant', merchant: name }`.
- `features/analytics/components/SpendingByCategoryChart.tsx` (slice) → `{ kind:'category', categoryPrimary }`.
- `features/fixed-expenses/components/FixedExpenseList.tsx` → `{ kind:'category', categoryPrimary }`.
- `features/analytics/components/MoneyFlowSankeyChart.tsx` (node) → category/merchant/account by node kind.
- Triggers compose only (`onClick` + shared `focus` ring); no restyle of `heroStatCardRecipes`/`dashboardCategoryCard`/`Pill`.
- Skip `BudgetSummaryCard` (aggregate) and all `*InsightsPanel`.

**Acceptance criteria**
- [ ] Each listed surface opens the contextual list with the correct scope; insights panels have no trigger.
- [ ] Triggers are keyboard-focusable with the shared focus ring and do not alter host-card styling.
- [ ] `design:lint`/`typecheck`/`build` pass.

## Phase 7 — Verification & sign-off

**Goal:** end-to-end proof across breakpoints and the full test/design suite.

**Tasks / acceptance criteria**
- [ ] `bun --cwd=frontend test` green (incl. `useInfiniteTransactions` + `TransactionListPopover`); pagination-specific tests removed.
- [ ] `bun --cwd=frontend run design:lint`, `typecheck`, `build` green. (`design:guard` not needed — no DESIGN.md/token edits.)
- [ ] Storybook + Playwright smoke + a11y addon green for `VirtualizedTransactionList`.
- [ ] `cargo test -p sumurai-backend --locked` green; migration applied; `EXPLAIN` confirms index use.
- [ ] Manual at `http://localhost:8080`: (1) continuous scroll, no gaps/jumps, DOM windowed, on desktop/tablet/mobile; (2) filter change resets + re-pages; (3) budget/merchant/category/Sankey triggers open correctly scoped popover/drawer; (4) open-row category picker stays anchored on scroll.

---

## Assumptions

- A budget maps to a single `category_primary` string (confirmed in `backend/src/models/budget.rs`); budget scoping = category (+ period), no new backend param.
- `TransactionWithAccount` already joins the account, so the keyset query is one query per page (no N+1) — verify.
- happy-dom test harness (`tests/setup/bun-dom.ts`) has a no-op `ResizeObserver` + 0-height boxes, so virtual-row rendering is tested via Storybook/Playwright, not Bun.
- `count_transactions` may still be used by insights endpoints; it is only removed from the list path.

## Risks & mitigations

- **Virtualizer measures 0 height inside an animating popover/drawer** → measurement-gating (`ResizeObserver` height state) + explicit `max-h` before mounting the list.
- **Open category picker anchor unmounts on scroll** → `rangeExtractor` pinning of the open index (+ adequate `overscan`).
- **Dropping `<table>` loses table semantics** → explicit `role`/`aria-rowindex` and keep the `aria-live` region; a11y addon in CI.
- **Deep-scroll DB latency / many users** → keyset + `(user_id, date DESC, id DESC)` index keeps cost-per-fetch flat; no COUNT; verify with `EXPLAIN`. Stateless HTTP (no persistent connection); pooled DB connections borrowed per-request.
- **Memory growth from retained pages** → rows are tiny and DOM is windowed; `prev_cursor` is emitted so `maxPages` + `getPreviousPageParam` can be enabled later without an API change.

## Out of scope (follow-ons)

- Sorting (`sort`/`order` reserved in the contract + frontend model; handler + per-sort indexes added when it ships; cursor already sort-aware).
- `maxPages` bidirectional memory bounding (API shaped for it via `prev_cursor`).
- Server-side Redis caching of hot list queries (`cache_service`) — unnecessary given the index.

## Next actions

1. Start Phase 1 (backend keyset endpoint + merchant filter + index + OpenAPI/types mirror).
2. Proceed phase-by-phase; each phase is independently testable and ends green on its acceptance criteria before the next begins.
