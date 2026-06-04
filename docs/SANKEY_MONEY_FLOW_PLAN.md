# Sankey "Money Flow" Dashboard View — Phased Implementation Plan

## Context

The dashboard header (`PageLayout` `stats` slot, rendered by
[DashboardPage.tsx](../frontend/src/views/DashboardPage.tsx)) currently shows `BalancesOverview` —
a recharts bar chart of account balances by institution. We are adding a **Sankey "money flow"
diagram** that visualizes where money goes: an optional **Income** layer flowing into a central
pool, then out to expense **categories**, constrained by the existing timeline picker and account
filter.

The two views become a **single-graph-at-a-time carousel** in the `stats` slot:

- **Page 1 (default): Sankey** money-flow
- **Page 2: Balances** (today's `BalancesOverview`, unchanged)

This needs a **new analytics endpoint** for Sankey node/link data plus a **new frontend chart +
carousel shell**. No salary/paycheck breakdown — income is a single aggregated node.

### Locked decisions

- **Income layer:** single `Income` node → central `Available` pool node → expense category nodes.
  Constrained by selected **account filter** + **timeline range**. No income-by-category, no salary
  breakdown.
- **Mobile/tablet:** unchanged — `BalancesOverview` only. Carousel + Sankey render **only at the
  `lg` desktop breakpoint**.
- **Carousel UX:** prev/next chevrons + clickable dot indicators, powered by **Embla**
  (`embla-carousel-react`).
- **Sankey chart lib:** recharts built-in `Sankey` (already on `recharts ^3.5.0`).
- **Coloring:** strictly from design tokens — Income/pool via `colors.semantic.*`, categories via
  the shared `categoryAccents` `ringHex` mapping (identical to the dashboard donut). No hardcoded
  hex.

## Assumptions

- `recharts ^3.5.0` exposes a working `Sankey` (confirmed via Context7: `SankeyData = {nodes,
  links}`, custom `node`/`link` render props, `nodePadding`/`nodeWidth`/`iterations`).
- The cash-flow handler already loads an unfiltered transaction set (including income) for a date
  range + account filter; the Sankey handler reuses that source for the income total.
- `DateRangeQuery { start_date, end_date, account_ids }` covers the Sankey request — no new query
  struct.
- Frontend API types are mirrored manually (repo does not auto-generate from OpenAPI).

## Risks

- **Income exclusion upstream:** `get_spending_transactions_by_date_range_for_user` filters out
  `EXCLUDED_ANALYTICS_CATEGORY_PRIMARIES` (incl. `INCOME`) at the query level
  ([repository_service.rs:~1504](../backend/src/services/repository_service.rs)). The income total
  MUST come from a non-spending-filtered loader, or income will silently be zero. Mitigation: trace
  `get_authenticated_cash_flow` and reuse its loader; add an all-transactions-by-range repo method
  only if none exists.
- **Sankey density / overflow** at narrow desktop widths with many categories — cap or group small
  buckets if the layout breaks.
- **Color drift** between Sankey and donut if category→accent resolution diverges. Mitigation: both
  must resolve via `getTagThemeForCategory(name, accentIndexByName).ringHex`.
- **Cache staleness** if TTL/key collides with existing analytics keys. Use a distinct `sankey`
  operation segment.

---

## Phase 1 — Backend Sankey endpoint

**Goal:** Serve `{ nodes, links, currency }` for the date range + account filter, reusing existing
aggregation, behind auth + cache.

**Tasks:**

- Add `SankeyNode`, `SankeyLink`, `SankeyResponse` to
  [backend/src/models/analytics.rs](../backend/src/models/analytics.rs) (Decimal fields use
  `#[schema(value_type = String)]`). Reuse `DateRangeQuery` from
  [models/query.rs](../backend/src/models/query.rs).
- Add `build_sankey(...)` to
  [backend/src/services/analytics_service.rs](../backend/src/services/analytics_service.rs):
  - Expenses: call existing `group_by_category_with_date_range(...)`; each bucket → category node +
    `pool → category` link; drop zero/negative buckets.
  - Income: sum `amount` where `amount > 0 && category_primary != "TRANSFER_IN"` (same predicate as
    `calculate_cash_flow`, analytics_service.rs:~308). If income > 0, emit `Income` node + `Income →
    pool` link.
  - Pool node value = total expenses; label `"Spending"` when no income, `"Available"` with income.
  - Links reference node **ids** (frontend resolves to indices).
- Trace `get_authenticated_cash_flow` in [backend/src/main.rs](../backend/src/main.rs) for its
  unfiltered transaction loader; reuse it for income, and the spending-filtered loader for expenses.
  Add an all-transactions-by-range method to repository_service.rs only if none exists (respect
  `with_tenant`/RLS + account filtering).
- Add `get_authenticated_sankey(State, AuthContext, AuthorizedQuery<DateRangeQuery>) ->
  Result<Json<SankeyResponse>, StatusCode>`, modeled on `get_authenticated_balances_overview`
  (main.rs:~3579): cache-check → load → `build_sankey` → cache-set → `Json`.
- Register `.route("/api/analytics/sankey", get(get_authenticated_sankey))` (main.rs:~576–608).
- Cache: reuse `generate_cache_key_with_account_filter`, key `{jwt_id}_sankey_{start}_{end}` + filter
  hash; TTL = transactions TTL (1800s). If a new TTL constant is added, update the Caching section of
  [docs/ARCHITECTURE.md](ARCHITECTURE.md).
- Add `#[utoipa::path(...)]`; register handler + 3 schemas in
  [backend/src/openapi/mod.rs](../backend/src/openapi/mod.rs). Regenerate `backend/openapi/` +
  [docs/OPENAPI.json](OPENAPI.json).
- Tests in [backend/src/tests/](../backend/src/tests/) (never inline): expenses-only (no Income
  node), income-present (`Income → pool → categories`, link sums correct), empty-range (empty
  nodes/links).

**Acceptance criteria:**

- [ ] `GET /api/analytics/sankey?start_date=…&end_date=…` (authed) returns `{nodes, links,
  currency}`.
- [ ] Income node + `Income → pool` link appear only when income > 0 in range.
- [ ] Expense category link values equal `group_by_category_with_date_range` totals.
- [ ] Account filter + date range both narrow the result.
- [ ] Response cached with a `sankey`-scoped key; TTL applied.
- [ ] OpenAPI spec regenerated and includes the new path + schemas.
- [ ] `cargo test -p sumurai-backend --locked sankey` passes.

---

## Phase 2 — Frontend data layer (types, service, hook)

**Goal:** Fetch Sankey data through the standard `ApiClient` → service → hook path, keyed by date
range + account filter.

**Tasks:**

- Mirror `SankeyNode`, `SankeyLink`, `SankeyResponse` in
  [frontend/src/types/api.ts](../frontend/src/types/api.ts).
- Add `getSankey(startDate?, endDate?, accountIds?): Promise<SankeyResponse>` to
  [frontend/src/services/AnalyticsService.ts](../frontend/src/services/AnalyticsService.ts) (same
  pattern as `getCategorySpendingByDateRange`).
- Add `frontend/src/features/analytics/hooks/useSankey.ts` modeled on `useAnalytics`: compute
  `{start,end}` via `computeDateRange` ([utils/dateRanges.ts](../frontend/src/utils/dateRanges.ts)),
  account ids from `useAccountFilter`, react-query with `keepPreviousData`, cache key including date
  range + account ids. Returns `{ loading, refreshing, error, data }`.

**Acceptance criteria:**

- [ ] `AnalyticsService.getSankey` calls `/api/analytics/sankey` via `ApiClient` (auth/refresh not
  bypassed).
- [ ] `useSankey(dateRange)` refetches when date range or account filter changes; keeps previous
  data during refetch.
- [ ] Hook test (mocked `AnalyticsService`) passes under `frontend/tests/`.

---

## Phase 3 — Sankey chart component (token-driven coloring)

**Goal:** Render the money-flow Sankey with recharts, colored entirely from design tokens, matching
the dashboard donut.

**Tasks:**

- Add adapter to
  [frontend/src/features/analytics/adapters/chartData.ts](../frontend/src/features/analytics/adapters/chartData.ts)
  (next to `categoriesToDonut`): map `SankeyResponse` (id-referenced links) → recharts shape (links
  reference node **indices**; build an id→index map).
- Add `frontend/src/features/analytics/components/MoneyFlowSankeyChart.tsx`: recharts `<Sankey
  data={{nodes, links}} node={<CustomNode/>} link={<CustomLink/>} …>` with `<Tooltip>` wired to
  `ChartGlassTooltip` (`chartTooltipRechartsProps`).
- Coloring from `useTheme()` only (no hardcoded hex):
  - Income node + `Income → pool` link → `colors.semantic.cash`.
  - Pool node → `colors.semantic.netWorth`.
  - Category nodes + `pool → category` links → `getTagThemeForCategory(name,
    accentIndexByName).ringHex` ([utils/categories.ts](../frontend/src/utils/categories.ts) +
    `categoryAccents` in [ui/tokens.ts](../frontend/src/ui/tokens.ts)); `accentIndexByName` from
    `useCategories()`.
  - Chrome from `colors.chart.*`; links use token color + opacity (mirror CashFlow gradient
    approach).
- Add a `sankeyChart` recipe block to [frontend/src/ui/recipes.ts](../frontend/src/ui/recipes.ts)
  (alongside `chartTooltip`/`dashboardCategoryCard`) for node-label/container/legend chrome, using
  the token-backed CSS-var class pattern. If a genuinely new hue is needed, add the token to
  [DESIGN.md](../DESIGN.md) and run `design:guard` — never hand-edit generated exports or inline a
  hex.
- Responsive sizing via `useChartContainerSize`; smooth updates via `useDebouncedChartRecalc`;
  `EmptyState` when no nodes.
- Adapter unit test in `frontend/tests/**`: income present / absent → correct index-based links.

**Acceptance criteria:**

- [ ] Sankey renders `Income → pool → categories` (or `pool → categories` when no income).
- [ ] A given expense category is the **same color** in the Sankey and the "Spending over time"
  donut.
- [ ] Toggling light/dark mode shifts all node/link colors via tokens (no hardcoded hex remains).
- [ ] No one-off Tailwind color classes in the component; chrome comes from the `sankeyChart` recipe.
- [ ] Adapter test passes.

---

## Phase 4 — Carousel shell + dashboard wiring

**Goal:** Swap the `stats` slot to a desktop-only Embla carousel (Sankey first, Balances second);
keep mobile unchanged.

**Tasks:**

- Install dep: `bun --cwd=frontend add embla-carousel-react`, then upgrade to latest with
  built-in tooling (per global CLAUDE.md).
- Add `frontend/src/components/DashboardStatsCarousel.tsx`:
  - Props `{ dateRange }`; `const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false })`.
  - Slide 0 → `<MoneyFlowSankeyChart dateRange={dateRange} />`; slide 1 → `<BalancesOverview />`
    (unchanged).
  - Co-located helper hooks `usePrevNextButtons(emblaApi)` + `useDotButton(emblaApi)` for chevron
    buttons (lucide `ChevronLeft`/`ChevronRight`) + dot indicators reflecting `selectedIndex`. Style
    via `ui/recipes` + `ui/primitives` (`Button`, `cn`); `aria-label`s per slide.
  - Desktop-only: wrap carousel in `hidden lg:block`; render plain `<BalancesOverview />` inside
    `lg:hidden`.
  - Minimal Embla viewport/container CSS via Tailwind (`overflow-hidden`, flex container,
    `flex-[0_0_100%]` slides).
- Wire into [DashboardPage.tsx](../frontend/src/views/DashboardPage.tsx): replace
  `stats={<BalancesOverview />}` (line ~103) with `stats={<DashboardStatsCarousel
  dateRange={dateRange} />}`.
- Tests in `frontend/tests/**`: defaults to Sankey, next/dot switches to Balances, desktop-only
  gating.

**Acceptance criteria:**

- [ ] `embla-carousel-react` added at latest version.
- [ ] Desktop dashboard shows **Sankey by default**; chevron/dot navigates to **Balances** and back.
- [ ] Carousel hidden below `lg`; mobile/tablet show **Balances only** (today's behavior).
- [ ] Carousel is keyboard accessible with per-slide `aria-label`s.
- [ ] Carousel/gating test passes.

---

## Phase 5 — End-to-end verification

**Goal:** Prove the full flow in the running app.

**Tasks:**

- Backend: `cargo test -p sumurai-backend --locked sankey`; run backend and `curl`
  `/api/analytics/sankey` (authed) to confirm shape and conditional income.
- Frontend unit: `bun --cwd=frontend test -- MoneyFlowSankey` and carousel/adapter tests.
- Visual via preview MCP at `http://localhost:8080` (Nginx proxy — **not** `:3001`):
  - Dashboard stats slot shows Sankey by default at desktop width (`preview_snapshot` /
    `preview_screenshot`).
  - Chevron/dot switches to Balances and back.
  - Token check: category colors match the donut; light/dark toggle shifts colors.
  - Change timeline pill + account filter → Sankey refetches; `preview_network` shows the
    `/api/analytics/sankey` call with correct `start_date`/`end_date`/`account_ids`.
  - `preview_resize` to mobile → carousel hidden, Balances only.

**Acceptance criteria:**

- [ ] All backend + frontend tests green.
- [ ] Preview confirms default Sankey, navigation, timeline/account constraint, token-consistent
  colors, and mobile fallback.

---

## Next actions

1. Hand this plan to the implementing agent (e.g. `phase-implementer`), starting at **Phase 1**.
2. Implement phases sequentially; do not start a phase until the prior phase's acceptance criteria
   pass.
3. Keep tests in `backend/src/tests/**` and `frontend/tests/**` (never inline).

## Out of scope

- Salary / income-by-source breakdown.
- Carousel on mobile/tablet.
- Adding a new charting dependency (reuse recharts' built-in `Sankey`).
