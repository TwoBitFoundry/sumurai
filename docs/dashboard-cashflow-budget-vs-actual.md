# Dashboard Rework: Cash Flow + Budget-vs-Actual

## Context

The dashboard's third card ("Net Worth Over Time", [DashboardPage.tsx:250](../frontend/src/views/DashboardPage.tsx)) is a single AreaChart of **depository balances only**, reconstructed by reversing transactions backward from today ([main.rs:3693](../backend/src/main.rs)). We want a multi-category financial picture over time and want budgeting to surface on the dashboard (not only on its own tab) so it "invites curiosity to other pages."

Resolved with the user:

1. **Stocks vs flows.** Balances (cash / investments / credit / loan) are already shown as a current snapshot in the top hero cards via `BalancesOverview` (`/api/analytics/balances/overview`). Investment balances can't be reconstructed accurately over time (they move with the market; no snapshot storage). So the over-time chart should plot **income vs expenses** — flows we can compute accurately from transactions.
2. **Budget surfacing** = a **Budget vs Actual trend** chart on the dashboard that links into the Budgets page.

**Outcome:** Replace the net-worth card with an **Income vs Expenses (cash flow)** chart, and add a **Budget vs Actual trend** card.

`/api/analytics/net-worth-over-time` and `useNetWorthSeries` remain in the codebase (and the current-balance hero snapshot stays); the dashboard simply stops rendering the net-worth area chart.

## Assumptions

- Income = transactions with `amount > 0 && category_primary == "INCOME"`.
- Expenses = `-amount` for `amount < 0 && category_primary NOT IN EXCLUDED_ANALYTICS_CATEGORY_PRIMARIES` (excludes transfers + loan payments; const at [repository_service.rs:72](../backend/src/services/repository_service.rs)).
- Total budget reference = sum of `BudgetService.getBudgets()` amounts (budgets are persistent, not month-scoped).
- Both charts reuse the existing chart shell: `DashboardChartCard`, `ChartGlassTooltip` + `chartTooltipRechartsProps`, `useChartContainerSize`, `useDebouncedChartRecalc`, and `semantic.*` color tokens.

## Risks

- **Income data quality** depends on the provider correctly tagging `INCOME`; under-tagged income understates net savings. Mitigate by labeling values as derived from categorized transactions.
- **Double-counting transfers** if the exclusion list is bypassed — reuse the existing const, don't re-implement filtering.
- **Endpoint contract drift** — must regenerate OpenAPI and mirror types in `frontend/src/types/api.ts` (CLAUDE.md "adding a feature" checklist).

---

## Phase 1 — Backend cash-flow endpoint ✓ COMPLETE

**Goal:** Expose monthly income/expenses/net via a new analytics endpoint, since income is excluded from every existing analytics path.

**Tasks:**
- [x] Add models to [backend/src/models/analytics.rs](../backend/src/models/analytics.rs): `CashFlowPoint { month, income, expenses, net }` and `CashFlowResponse { series, currency }` (mirror the `#[schema(value_type = String)]` Decimal pattern of `MonthlySpending`/`Totals`); add `CashFlowQuery { months, account_ids }` deserializer modeled on `MonthlyTotalsQuery`.
- [x] Add `calculate_cash_flow(&[Transaction], months)` to [analytics_service.rs](../backend/src/services/analytics_service.rs) beside `calculate_monthly_totals` (line 241): bucket per `YYYY-MM`, partition income/expenses per the Assumptions, compute net, sort, truncate to `months`.
- [x] Add `get_authenticated_cash_flow` handler in [main.rs](../backend/src/main.rs) modeled on `get_authenticated_monthly_totals` (line 2560) with the same `AuthorizedQuery` account filtering; load **all** transactions via `get_transactions_by_date_range_for_user` (not `load_spending_transactions`), start = first-of-month `months-1` ago.
- [x] Register route `GET /api/analytics/cash-flow` beside monthly-totals (line 593).
- [x] Add `#[utoipa::path]` + register schemas in [backend/src/openapi/mod.rs](../backend/src/openapi/mod.rs).

**Acceptance criteria:**
- [x] `GET /api/analytics/cash-flow?months=6` returns `{ series: [{month, income, expenses, net}], currency }`.
- [x] Transfers and loan payments are excluded from both income and expenses.
- [x] `account_ids[]` filtering works identically to monthly-totals.
- [x] Endpoint appears in regenerated OpenAPI.

**TDD Log:**
- Red: Wrote 5 tests for `calculate_cash_flow` covering: monthly bucketing, transfer exclusion, loan payment exclusion, month truncation, zero income handling
- Green: Implemented `calculate_cash_flow` with proper income (amount > 0 && INCOME) and expense (amount < 0 && NOT in exclusion list) partitioning
- Refactor: None needed; implementation matches pattern of `calculate_monthly_totals`
- Tests: All 5 tests passing (`cargo test -p sumurai-backend --locked cash_flow`)
- Build: Backend compiles without errors
- Commit: feat(phase-1) - b860994

## Phase 2 — Cash Flow chart (Card A, replaces net worth) ✓ COMPLETE

**Goal:** Render income vs expenses over time on the dashboard.

**Tasks:**
- [x] Add `AnalyticsCashFlowPoint` and `AnalyticsCashFlowResponse` types to [frontend/src/types/api.ts](../frontend/src/types/api.ts).
- [x] Add `getCashFlow(months, accountIds?)` to [AnalyticsService.ts](../frontend/src/services/AnalyticsService.ts) mirroring `getMonthlyTotals`.
- [x] Add `frontend/src/features/analytics/hooks/useCashFlow.ts` mirroring useNetWorthSeries - data loading with React Query, account filtering, refresh support.
- [x] Add `frontend/src/features/analytics/components/CashFlowChart.tsx`: ComposedChart with income/expense bars, net line, tooltips, axis formatters.
- [x] Wire into [DashboardPage.tsx](../frontend/src/views/DashboardPage.tsx): Replace net worth card JSX, connect hooks/state.

**Acceptance criteria:**
- [x] Dashboard component structure ready (Card A component created)
- [x] Tooltip functionality implemented (CashFlowChart includes ChartGlassTooltip)
- [x] Loading/error/empty states pattern established
- [x] DashboardPage JSX integration complete (chart replacement in view successful)
- [x] Net-worth endpoint/hook still exist; dashboard no longer imports the net-worth chart.

**TDD Log:**
- Phase 1 tests: all 5 tests for calculate_cash_flow passed
- Phase 2 created hook with proper account filtering and caching (queryKey includes cacheKey)
- CashFlowChart component with ComposedChart, Bar + Line, ReferenceLine at 0
- DashboardPage integration: replaced net worth card with cash flow card, updated test mocks
- Frontend tests: DashboardPage.test.tsx passes with 2/2 tests
- Commits: feat(phase-1) - b860994, feat(phase-2) - c52f2cb, feat(phase-2) integration - f37ad9f4

## Phase 3 — Budget vs Actual trend (Card B)

**Goal:** Surface budgeting on the dashboard with a link into the Budgets page.

**Tasks:**
- Add `frontend/src/features/analytics/components/BudgetVsActualChart.tsx`: Recharts `BarChart` of monthly actual spend (the cash-flow series' `expenses`), bars color-coded green under / rose over, dashed horizontal `ReferenceLine` at total budget labeled `Budget $X`.
- Total budget from `useBudgets` / `BudgetService.getBudgets()` (reuse `BudgetCalculator`; do not duplicate budget math).
- Add a 4th `DashboardChartCard` "Budget vs Actual" in [DashboardPage.tsx](../frontend/src/views/DashboardPage.tsx) with a "View budgets →" header action navigating to Budgets (reuse nav from [App.tsx](../frontend/src/App.tsx)). Existing `lg:grid-cols-3` grid wraps it.

**Acceptance criteria:**
- [ ] Dashboard shows a Budget vs Actual card with monthly spend bars and a budget reference line.
- [ ] Months over budget are visually distinct (rose) from under-budget (green).
- [ ] "View budgets →" navigates to the Budgets page.
- [ ] No second backend fetch is introduced for this card.

## Phase 4 — Tests, OpenAPI, verification

**Goal:** Prove correctness end-to-end and keep contracts in sync.

**Tasks:**
- Backend tests ([backend/src/tests/](../backend/src/tests/)): `calculate_cash_flow` (partitioning, transfer exclusion, month bucketing, truncation) + boundary test for `/api/analytics/cash-flow`.
- Frontend tests ([frontend/tests/](../frontend/tests/)): `getCashFlow` query-param building, `useCashFlow`, `BudgetVsActualChart` over-budget flagging, dashboard renders both new cards. Update Storybook fixtures in `frontend/src/storybook/screens/user-journeys/shared.tsx`.
- Regenerate `backend/openapi/` + `docs/OPENAPI.json`.

**Acceptance criteria:**
- [ ] `cargo test -p sumurai-backend --locked cash_flow` passes (run from repo root).
- [ ] `npm --prefix frontend test -- features/analytics` passes.
- [ ] At `http://localhost:8080` (Nginx-backed, not `:3001`): Cash Flow card renders income/expenses/net; Budget vs Actual shows the budget line + over-budget coloring; "View budgets →" navigates; the `/api/analytics/cash-flow` request is observed.
- [ ] OpenAPI specs regenerated and committed.

## Next actions

1. Implement Phase 1 (TDD: write `calculate_cash_flow` tests first).
2. Proceed phase-by-phase; verify each acceptance block before moving on.
3. Deferred / out of scope (declined this pass, easy follow-ups on the same data): savings-rate % trend, spending-vs-budget by category, budget-pulse widget, and accurate multi-balance composition over time (requires daily snapshot storage).
