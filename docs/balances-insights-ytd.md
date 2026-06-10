# Balances Insights YTD

Add income YTD and expenses YTD to the Net header of `BalancesInsightsPanel` on the dashboard.

## Context

`BalancesInsightsPanel` was recently introduced as a violet-accented collapsible panel that replaces the five static `HeroStatCard` tiles. It shows **Net** always-visible in the header with Cash, Investments, Credit, and Loans in a collapsible body.

The `/api/analytics/cash-flow` endpoint already returns per-month `{ income, expenses, net }` data. YTD totals are the sum of those fields across all months in the current calendar year — no backend changes are required.

## Assumptions

- "YTD" means January 1 of the current calendar year through the most recent completed month in the cash flow series.
- 12 months of cash flow data is sufficient to cover a full YTD window; the existing `useCashFlow(12)` call in `DashboardPage` is identical to what we need.
- TanStack Query deduplicates the `['analytics', 'cash-flow', 12, ...]` query, so calling `useCashFlow(12)` inside `BalancesOverview` adds no extra network request when the dashboard is mounted.
- Income is rendered in success color, expenses in danger color — matching existing cash flow chart conventions.

## Risks

- If the user has no transactions in the current year the values will both be `$0.00`, which is still valid.
- Account filter context must be respected — `useCashFlow` already reads from `useAccountFilter` so filtered views will be consistent.

---

## Phase 1 — Pure utility and data layer

**Goal:** Expose a tested, pure `computeYtdTotals` function and wire the YTD data into `BalancesInsightsPanel`'s prop contract.

**Tasks**

- Add `computeYtdTotals(series: AnalyticsCashFlowPoint[], year: number): { incomeYtd: number; expensesYtd: number }` to `frontend/src/services/AnalyticsService.ts`.
- Add `incomeYtd?: number` and `expensesYtd?: number` to `BalancesInsightsPanelProps` in `frontend/src/features/analytics/components/BalancesInsightsPanel.tsx`.

**Acceptance criteria**

- [ ] `computeYtdTotals` sums `income` and `expenses` only for months whose `month` string starts with `"${year}-"`.
- [ ] Months outside the target year are excluded from the sum.
- [ ] An empty series returns `{ incomeYtd: 0, expensesYtd: 0 }`.
- [ ] `BalancesInsightsPanelProps` accepts `incomeYtd` and `expensesYtd` as optional numbers.
- [ ] TypeScript passes with `npm --prefix frontend run typecheck`.

---

## Phase 2 — Render YTD in the Net header

**Goal:** Display income YTD and expenses YTD inside the Net header row of `BalancesInsightsPanel` when data is available.

**Tasks**

- In `BalancesInsightsPanel`, render a secondary row below the Net amount (and above the chevron) when both `incomeYtd` and `expensesYtd` are provided.
- Use `uiTypographyRecipes.caption` for sizing and `semanticTextRecipes.subtle` as the label style.
- Use `uiStatusRecipes.success.text` for the income value and `uiStatusRecipes.danger.text` for the expenses value.
- Render amounts with `fmtUSD`.
- Keep the layout consistent with the existing `grid-cols-[auto_1fr_auto]` header structure — place the two values in the center column or span as a sub-row beneath it.

**Acceptance criteria**

- [ ] When both props are provided, the header shows income and expenses YTD values.
- [ ] When props are omitted, the header renders identically to the current state.
- [ ] Income value uses success text color; expenses value uses danger text color.
- [ ] Labels ("income ytd" / "expenses ytd") use caption + subtle styling.
- [ ] TypeScript passes.

---

## Phase 3 — Wire into BalancesOverview

**Goal:** Fetch cash flow data inside `BalancesOverview` and pass computed YTD values to `BalancesInsightsPanel`.

**Tasks**

- In `frontend/src/components/BalancesOverview.tsx`, call `useCashFlow(12)` from `frontend/src/features/analytics/hooks/useCashFlow.ts`.
- Call `computeYtdTotals(series, new Date().getFullYear())` with the resulting series.
- Pass `incomeYtd` and `expensesYtd` to `BalancesInsightsPanel`.

**Acceptance criteria**

- [ ] `BalancesOverview` computes and passes `incomeYtd` / `expensesYtd` to `BalancesInsightsPanel`.
- [ ] No additional network requests are made when `DashboardPage` already mounts (TanStack Query cache hit).
- [ ] TypeScript passes.
- [ ] `npm --prefix frontend run build` succeeds.

---

## Phase 4 — Tests

**Goal:** Cover the new utility and the updated component with boundary tests.

**Tasks**

- Create `frontend/tests/services/AnalyticsService.ytd.test.ts` with unit tests for `computeYtdTotals`:
  - sums only current-year months
  - excludes prior-year months
  - handles empty series
  - handles partial year (months 1–6 only)
- Update `frontend/tests/features/analytics/components/BalancesInsightsPanel.test.tsx`:
  - renders income and expenses YTD when props are provided
  - omits the secondary row when props are absent
  - income value has success color class, expenses has danger color class

**Acceptance criteria**

- [ ] All new tests pass with `npm --prefix frontend test`.
- [ ] No existing tests are broken.
- [ ] `npm --prefix frontend run typecheck` passes.
