# Sankey "Money Flow" Dashboard View — Phased Implementation Plan

## Context

We are adding a **Sankey "money flow"** diagram to the dashboard `stats` slot (the `PageLayout`
`stats` slot rendered by [DashboardPage.tsx](../frontend/src/views/DashboardPage.tsx)), alongside the
existing `BalancesOverview` (recharts balances bar chart). The two render as a **single-slide-at-a-time
carousel** (desktop only). The Sankey visualizes, **purely from transaction data**, how money flows
through a central **Expenses** node — without ever knowing the user's salary.

This plan was re-verified against the current code (drift pass). Three things changed materially from
the first draft:

1. **Income source.** The cash-flow path does **not** use an unfiltered transaction loader. It uses
   `get_monthly_cash_flow_aggregates_for_user(start, end, account_ids)` — a DB aggregate that already
   account-filters and already computes income (`amount > 0 && category_primary != "TRANSFER_IN"`) and
   expenses (`amount < 0 && NOT IN EXCLUDED_ANALYTICS_CATEGORY_PRIMARIES`). Reuse it; the original
   "add an all-transactions-by-range method" task is obsolete.
2. **Flow conservation / debt model.** A Sankey balances inflow == outflow at every node. The original
   `Income → pool` topology breaks when income ≠ expenses. We model the gap explicitly: when spending
   exceeds income the difference is **debt/drawdown**; when income exceeds spending the remainder is
   **surplus**. Coverage ("income covers X% of expenses") is read directly off link widths.
3. **No YTD.** The shared timeline picker is rolling windows (1M/2M/3M/6M/1Y/5Y); a calendar
   year-to-date concept does not fit it. The Sankey simply follows the existing picker + account filter.
   No changes to `dateRanges.ts` / `DateRangePillSlider` / `sessionPreferences.ts`, and the dashboard
   default range is unchanged.

### Locked decisions

- **Topology (center node = `Expenses`):** `[Income, Debt?] → Expenses → category nodes`.
  - `Income → Expenses` value = `min(income, expenses)` (the covered portion).
  - **Deficit** (expenses > income): add `Debt → Expenses` for `expenses − income`.
  - **Surplus** (income > expenses): add `Income → Surplus` for `income − expenses`.
  - `Expenses → category` per spending bucket; `Σ buckets == expenses` (pool conserves).
  - Both deficit-source and surplus-sink are shown. Gap node labels are **"Debt"** (source) and
    **"Surplus"** (sink) — single strings, easy to change.
- **Account scope:** exclude **Loan** and **Investments** accounts (classified via
  `map_account_to_balance_category`). A small note on the card states this. Still respects the user's
  account-filter selection (effective scope = selection ∩ not-loan/investment).
- **Range/account:** follows the existing shared timeline picker + `useAccountFilter` — no new range
  concept, no default change.
- **Carousel:** `embla-carousel-react` (chevrons + dot indicators), **desktop-only** (`lg`). Mobile/
  tablet keep `BalancesOverview` only. (Zero-dep `translateX`+index is the fallback if we want to avoid
  the dependency.)
- **Sankey lib:** recharts built-in `Sankey` (repo is on `recharts ^3.8.1`).
- **Coloring:** strictly design tokens. Income → `colors.semantic.cash`; Expenses (pool) →
  `colors.semantic.netWorth`; deficit/surplus → semantic expense/positive tokens; categories →
  `getTagThemeForCategory(name, accentIndexByName).ringHex` (same as the donut). No hardcoded hex.
- **Design-system + Storybook:** compose only from `ui/primitives` + `ui/recipes` + tokens — no one-off
  Tailwind colors. Every new component (`MoneyFlowSankeyChart`, `DashboardStatsCarousel`) ships
  co-located `*.stories.tsx` rendering the **real component** with shared fixtures, following the
  existing pattern ([SpendingByCategoryChart.stories.tsx](../frontend/src/features/analytics/components/SpendingByCategoryChart.stories.tsx)):
  `@storybook/nextjs-vite` `Meta`/`StoryObj`, `tags: ['autodocs', 'test']`, `play` smoke assertions via
  `storybook/test`, and the `addon-a11y` check. Stories run under the preview theme decorators so token
  coloring is exercised in both light and dark.

### Conservation math (per selected window, after account scoping)

```
I = income            = Σ aggregate.income from get_monthly_cash_flow_aggregates_for_user
E = total expenses    = Σ category buckets (== aggregate expenses; same exclusions)
covered = min(I, E)
deficit = max(0, E - I)     surplus = max(0, I - E)
coverage_ratio = E > 0 ? covered / E : null

Links:
  Income → Expenses            : covered            (omit if I == 0)
  Debt → Expenses              : deficit            (only if deficit > 0)
  Income → Surplus             : surplus            (only if surplus > 0)
  Expenses → <category>        : bucket value       (for each non-zero bucket)
```

Income-node total = covered + surplus = I. Expenses inflow = covered + deficit = E = Expenses outflow.
Everything reconciles because category buckets and cash-flow expenses exclude the **same** primaries
(`INCOME, LOAN_PAYMENTS, TRANSFER_IN, TRANSFER_OUT, BANK_FEES`). Note: loan *repayments* are excluded
by that convention, so debt paydown is not a category bucket — call this out in the card note/docs.

---

## Phase 1 — Backend Sankey endpoint

**Goal:** Serve `{ nodes, links, currency, summary }` for the date range + account filter (minus loan/
investment), reconciled and cached, behind auth.

**Tasks:**

- Models in [backend/src/models/analytics.rs](../backend/src/models/analytics.rs):
  - `SankeyNode { id: String, label: String, kind: SankeyNodeKind }` where `kind ∈ {Income, Expenses,
    Category, Deficit, Surplus}`.
  - `SankeyLink { source: String, target: String, value: Decimal }` (`#[schema(value_type = String)]`
    on `Decimal`). Links reference node **ids**; frontend resolves to indices.
  - `SankeySummary { income, expenses, covered, deficit, surplus, coverage_ratio: Option<Decimal> }`
    (Decimals as `String` in schema) — drives the "income covers X%" headline.
  - `SankeyResponse { nodes, links, currency, summary }`.
  - Reuse `DateRangeQuery` (has `start_date`, `end_date`, `account_ids`, `exclude_account_ids`).
- `build_sankey(...)` in [analytics_service.rs](../backend/src/services/analytics_service.rs):
  - Inputs: income total `I`, category buckets (`Vec<CategorySpending>`, already scoped), currency.
  - Compute `E`, covered/deficit/surplus, emit nodes/links per the math above; drop zero/negative
    buckets; sort categories descending for stable layout. Return `SankeyResponse`.
  - Keep it pure (no I/O) so it is unit-testable.
- Handler `get_authenticated_sankey(State, AuthContext, AuthorizedQuery<DateRangeQuery>)` in
  [main.rs](../backend/src/main.rs), modeled on `get_authenticated_category_spending` +
  `get_authenticated_cash_flow`:
  1. Parse `start_date`/`end_date`.
  2. Build **allowed account set**: load `get_accounts_for_user`, classify each via
     `AnalyticsService::map_account_to_balance_category`, keep ids that are **not** `Loan`/`Investments`;
     intersect with `authorized_account_ids` when present. If empty → return empty Sankey.
  3. **Income:** `get_monthly_cash_flow_aggregates_for_user(start, end, Some(allowed))`, sum
     `aggregate.income`.
  4. **Categories:** `analytics_service.load_spending_transactions(...)` →
     `transactions.retain(|t| allowed.contains(&t.account_id))` →
     `group_by_category_with_date_range(...)`.
  5. `build_sankey(...)` → cache-set → `Json`.
  - Cache: `format!("{}_sankey_{}_{}", jwt_id, start, end)` + `generate_cache_key_with_account_filter`
    over the allowed set; TTL = `TRANSACTIONS_TTL` (1800s,
    [cache_service.rs](../backend/src/services/cache_service.rs)). No new TTL constant.
- Route `.route("/api/analytics/sankey", get(get_authenticated_sankey))` near the other analytics
  routes in [main.rs](../backend/src/main.rs).
- `#[utoipa::path(...)]` + register handler & schemas in
  [backend/src/openapi/mod.rs](../backend/src/openapi/mod.rs); regenerate `backend/openapi/` +
  [docs/OPENAPI.json](OPENAPI.json).
- Tests in [backend/src/tests/](../backend/src/tests/) (boundary-only, never inline):
  - `build_sankey` unit cases: income > expenses (Income→Expenses + Income→Surplus, sums balance);
    expenses > income (Income→Expenses + Debt→Expenses); income == 0 (Debt→Expenses only); no spending
    (empty/empty); coverage_ratio correctness.
  - Handler/repo-boundary: loan/investment accounts excluded; account filter + date range narrow the
    result; `Σ category links == summary.expenses`.

**Acceptance criteria:**

- [x] `GET /api/analytics/sankey?start_date=…&end_date=…[&account_ids=…]` (authed) returns
  `{nodes, links, currency, summary}`.
- [x] Pool conserves: Expenses inflow == outflow; Income-node total == income.
- [x] Deficit node appears iff `expenses > income`; Surplus node iff `income > expenses`.
- [x] Loan & investment accounts excluded; remaining account filter + date range both narrow results.
- [x] `Σ Expenses→category link values == summary.expenses == group_by_category total`.
- [x] Response cached with a `sankey`-scoped key at 1800s TTL.
- [x] OpenAPI regenerated with the new path + schemas.
- [x] `cargo test -p sumurai-backend --locked sankey` passes.

**TDD log**

- Red: added pure Sankey builder tests for surplus, debt, zero/zero, and zero-income cases, plus an
  authenticated endpoint test covering account scoping and cache writes.
- Green: implemented Sankey models, `AnalyticsService::build_sankey`, the authenticated handler, and
  OpenAPI registration.
- Verify: `cargo test -p sumurai-backend --locked sankey -- --nocapture` and
  `cargo test -p sumurai-backend --locked openapi_tests -- --nocapture` both passed after
  `cargo fmt --all`; `cargo test -p sumurai-backend --locked regenerate_openapi_artifacts -- --ignored
  --nocapture` regenerated `docs/OPENAPI.json`.

---

## Phase 2 — Frontend data layer (types, service, hook)

**Goal:** Fetch Sankey data via `ApiClient` → service → hook, keyed by date range + account filter.

**Tasks:**

- Mirror `SankeyNode`, `SankeyNodeKind`, `SankeyLink`, `SankeySummary`, `SankeyResponse` in
  [frontend/src/types/api.ts](../frontend/src/types/api.ts).
- `AnalyticsService.getSankey(startDate?, endDate?, accountIds?): Promise<SankeyResponse>` in
  [frontend/src/services/AnalyticsService.ts](../frontend/src/services/AnalyticsService.ts) — mirror
  `getCategorySpendingByDateRange` (goes through `ApiClient`; do not bypass auth/refresh).
- `frontend/src/features/analytics/hooks/useSankey.ts`, modeled on `useAnalytics`: `computeDateRange`
  for `{start,end}`, account ids + `accountIdsCacheKey` from `useAccountFilter`, react-query with
  `placeholderData: keepPreviousData`, key `['sankey', range, cacheKey]`. Returns
  `{ loading, refreshing, error, data }`.

**Acceptance criteria:**

- [ ] `getSankey` calls `/api/analytics/sankey` through `ApiClient`.
- [ ] `useSankey(range)` refetches on date-range/account-filter change; keeps previous data during
  refetch.
- [ ] Hook test (mocked `AnalyticsService`) under `frontend/tests/**` passes.

---

## Phase 3 — Sankey chart component (token-driven, Expenses-centered)

**Goal:** Render the money-flow Sankey with recharts, colored entirely from tokens, matching the donut.

**Tasks:**

- Adapter in [chartData.ts](../frontend/src/features/analytics/adapters/chartData.ts) (next to
  `categoriesToDonut`): `SankeyResponse` (id-referenced links) → recharts `{nodes, links}` (links
  reference node **indices**; build an id→index map). Preserve `kind` for coloring.
- `frontend/src/features/analytics/components/MoneyFlowSankeyChart.tsx`: `<Sankey data={{nodes,links}}
  node={<CustomNode/>} link={<CustomLink/>} nodePadding nodeWidth iterations>` with `<Tooltip>` wired
  to `ChartGlassTooltip` (`chartTooltipRechartsProps`). Header line surfaces `summary.coverage_ratio`
  ("Income covers 72% of expenses" / "Income exceeds expenses by …"). Footnote: "Investment & loan
  accounts excluded."
- Coloring via `useTheme()` only:
  - `Income` node/link → `colors.semantic.cash`.
  - `Expenses` node → `colors.semantic.netWorth`.
  - `Deficit` ("Debt") → semantic expense/danger token; `Surplus` → semantic positive/savings token
    (resolve exact names from [ui/tokens.ts](../frontend/src/ui/tokens.ts); mirror `CashFlowChart`'s
    income/expense colors).
  - `Category` nodes/links → `getTagThemeForCategory(name, accentIndexByName).ringHex`;
    `accentIndexByName` from `useCategories()`.
  - Chrome from `colors.chart.*`; links = token color + opacity (mirror CashFlow gradient approach).
- Add a `sankeyChart` recipe block to [frontend/src/ui/recipes.ts](../frontend/src/ui/recipes.ts) for
  node-label/container/footnote chrome (token-backed CSS-var classes). If a genuinely new hue is
  needed, add it to [DESIGN.md](../DESIGN.md) and run `design:guard`.
- Responsive via `useChartContainerSize`; smooth updates via `useDebouncedChartRecalc`; `EmptyState`
  when no category nodes.
- Adapter unit test in `frontend/tests/**`: deficit / surplus / income-absent → correct index links +
  kinds.
- **Storybook fixtures + stories (real component):**
  - Add `sampleSankey*` fixtures to
    [src/storybook/fixtures/analytics.ts](../frontend/src/storybook/fixtures/analytics.ts): `Deficit`
    (expenses > income), `Surplus` (income > expenses), `NoIncome`, `Empty`.
  - Co-locate `MoneyFlowSankeyChart.stories.tsx` mirroring `SpendingByCategoryChart.stories.tsx`:
    `Meta`/`StoryObj` from `@storybook/nextjs-vite`, sized decorator, `tags: ['autodocs', 'test']`, one
    story per fixture. `play` smoke assertions (`storybook/test`): coverage headline text, "investment
    & loan excluded" footnote, presence/absence of Debt vs Surplus node labels, `EmptyState` for the
    empty fixture.

**Acceptance criteria:**

- [ ] Renders `Income → Expenses → categories`, with deficit/surplus nodes per the data.
- [ ] A given category is the **same color** in the Sankey and the spending donut.
- [ ] Light/dark toggle shifts every node/link color via tokens (no hardcoded hex).
- [ ] Coverage headline + "investment & loan excluded" footnote present.
- [ ] No one-off color classes; chrome from `sankeyChart` recipe. Adapter test passes.
- [ ] Stories (Deficit/Surplus/NoIncome/Empty) render the real component and pass `test:storybook`
  (`play` + a11y).

---

## Phase 4 — Carousel shell + dashboard wiring

**Goal:** Swap the `stats` slot to a desktop-only Embla carousel (Sankey first, Balances second);
mobile unchanged.

**Tasks:**

- `bun --cwd=frontend add embla-carousel-react`, then upgrade to latest (per global CLAUDE.md).
- `frontend/src/components/DashboardStatsCarousel.tsx`:
  - Props `{ dateRange }`; `useEmblaCarousel({ loop: false })`.
  - Slide 0 → `<MoneyFlowSankeyChart dateRange={dateRange} />`; slide 1 → `<BalancesOverview />`
    ([BalancesOverview.tsx](../frontend/src/components/BalancesOverview.tsx), unchanged, no props).
  - Co-located `usePrevNextButtons` + `useDotButton` for chevrons (lucide `ChevronLeft/Right`) + dots
    reflecting `selectedIndex`. Style via `ui/recipes` + `ui/primitives` (`Button`, `cn`); per-slide
    `aria-label`s.
  - Desktop-only: carousel in `hidden lg:block`; plain `<BalancesOverview />` in `lg:hidden`.
  - Minimal Embla viewport/container CSS (`overflow-hidden`, flex container, `flex-[0_0_100%]` slides).
- Wire into [DashboardPage.tsx](../frontend/src/views/DashboardPage.tsx): replace
  `stats={<BalancesOverview />}` with `stats={<DashboardStatsCarousel dateRange={dateRange} />}`
  (`dateRange` already a prop to `DashboardPage`).
- Tests in `frontend/tests/**`: defaults to Sankey, next/dot switches to Balances, desktop-only gating.
- **Storybook story (real components):** co-locate `DashboardStatsCarousel.stories.tsx` rendering the
  real carousel with the real `MoneyFlowSankeyChart` (fixture-backed) + `BalancesOverview`,
  `tags: ['autodocs', 'test']`. `play`: asserts Sankey visible by default, chevron/dot navigates to
  Balances and back. Reuse the existing `DashboardScreenSlice`/fixtures so the slice-level story shows
  the carousel in dashboard context.

**Acceptance criteria:**

- [ ] `embla-carousel-react` added at latest version.
- [ ] Desktop shows **Sankey by default**; chevron/dot navigates to **Balances** and back.
- [ ] Carousel hidden below `lg`; mobile/tablet show **Balances only**.
- [ ] Keyboard accessible with per-slide `aria-label`s. Carousel test passes.
- [ ] Carousel story renders real components and passes `test:storybook`.

---

## Phase 5 — End-to-end verification

- Backend: `cargo test -p sumurai-backend --locked sankey`; run backend and `curl`
  `/api/analytics/sankey` (authed) — confirm shape, conservation, conditional deficit/surplus, loan/
  investment exclusion.
- Frontend: `bun --cwd=frontend test -- MoneyFlowSankey` + carousel/adapter tests.
- Storybook: `bun --cwd=frontend run test:storybook` (Vitest `play` + a11y over the new stories), then
  the Playwright runtime smoke `bun --cwd=frontend run test:storybook-runtime` if touched screens are
  in its scope.
- Visual via preview MCP at `http://localhost:8080` (Nginx — **not** `:3001`):
  - Dashboard stats slot shows Sankey by default at desktop width.
  - Chevron/dot switches to Balances and back.
  - Category colors match the donut; light/dark toggle shifts colors.
  - Change timeline pill + account filter → Sankey refetches; `preview_network` shows
    `/api/analytics/sankey` with correct `start_date`/`end_date`/`account_ids`.
  - Construct a window where expenses > income (deficit node + coverage %) and one where income >
    expenses (surplus node).
  - `preview_resize` to mobile → carousel hidden, Balances only.

**Acceptance criteria:**

- [ ] All backend + frontend tests green.
- [ ] Preview confirms default Sankey, navigation, deficit/surplus rendering, coverage headline,
  loan/investment exclusion note, timeline/account constraint, token-consistent colors, mobile
  fallback.

---

## Next actions

1. Implement phases sequentially (e.g. via `phase-implementer`); do not start a phase until the prior
   phase's acceptance criteria pass.
2. Keep tests in `backend/src/tests/**` and `frontend/tests/**` (never inline); stories co-located.

## Out of scope

- Salary / income-by-source breakdown (income stays a single transaction-derived node).
- A calendar year-to-date range (picker stays rolling-window; no new range key).
- Distinguishing savings-drawdown from new borrowing in the deficit node (transaction data can't; the
  uncovered shortfall is labeled simply "Debt").
- Carousel on mobile/tablet; a new charting dependency (reuse recharts' built-in `Sankey`).
