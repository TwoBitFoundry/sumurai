# Contextual Budget Insights & Demystification — Implementation Plan

> Phased build plan for the "Provision the coffers" insight cards. Supersedes the
> PRD draft previously in this file (see git history for the original requirements
> narrative). This document is the execution source of truth.

## Context

The Budgets page (`frontend/src/views/BudgetsPage.tsx`, titled "Provision the coffers")
currently renders three static hero cards — **Days remaining**, **Subscription costs**,
**Overages** — plus a **Budget Summary** card. These top cards do not respond to the
account/month filters in the bottom contextual bar, and the raw numbers read as abstract
to everyday users.

This change replaces the three hero cards with **four filter-aware insight cards** that
recompute as the user changes the account or month filter, and that flip to reveal a
plain-English "Human Question" explaining what each metric answers. The **Budget Summary**
card stays. A scoping decision surfaced during investigation: subscriptions are
currently aggregated by merchant only and carry **no account association** — confirmed as
an implementation miss. Card math that involves subscriptions must become account-aware,
which requires a small backend change.

> Terminology: this product no longer uses the names "Vows" (subscriptions) or
> "Allowances" (budgets) from the original PRD draft. Use **subscriptions** and
> **budgets** throughout.

### Decisions locked with the requester
- **Layout:** the 4 new cards **replace** the 3 hero cards; keep the Budget Summary card below.
- **Subscriptions & accounts:** subscriptions **must** be filterable by account (fix the miss) — add account attribution to subscriptions.
- **Flip motion:** **smooth expand/fade** reusing the existing `AnimatePresence` height+opacity pattern (as in `BankCard` / `CollapsibleSection`) — no 3D rotateY.

### The four cards (front metric → back "Human Question")
1. **Daily Pacing** — `(totalBudgeted − totalSpent) / daysRemaining` → *"How much can I spend every day for the rest of the month without blowing my budget?"*
2. **Safe-To-Spend** — `remaining − Σ(upcoming unpaid subscriptions this month)` → *"How much of my cash is actually mine to spend vs. already spoken for?"*
3. **Exhaustion Projection** — `runoutDate = today + remaining / (totalSpent / currentDayOfMonth)` → *"At my current speed, what day will this budget run dry?"*
4. **Account Burden / Budget Slack** — filtered: account's share of total budget spend `%`; unfiltered: leftover slack → *"How much weight is this account carrying?"* / *"Do I have unassigned slack left?"*

## Key existing code to reuse (do not reinvent)
- `frontend/src/domain/BudgetCalculator.ts` — `computeStats()` already yields `totalBudgeted`, `totalSpent`, `remaining`, `daysRemaining`, `totalDays`. Extend, don't duplicate.
- `frontend/src/domain/subscriptionDates.ts` — `computeSubscriptionNextDueDate(last_charged, cadence, ref)` for subscription due dates. `addMonthsClamped` handles month-end edge cases.
- `frontend/src/domain/SubscriptionCalculator.ts` — monthly-cost summing pattern.
- `frontend/src/components/widgets/HeroStatCard.tsx` — front-of-card visual language (`HeroStatCardProps`, accents, pills, `heroStatCardRecipes`).
- `frontend/src/features/budgets/hooks/useBudgets.ts` — owns the budgets + month-transactions queries and the account filter (`useAccountFilter`); already recomputes `computedBudgets`/`stats` from filtered transactions.
- `frontend/src/components/CollapsibleSection.tsx` / `BankCard.tsx` — the `AnimatePresence` expand/fade recipe (`duration: 0.24, ease: [0.22, 0.61, 0.36, 1]`).
- `framer-motion@^12` is already a dependency.

## Architectural constraints found during investigation
- **Account ids:** `useAccountFilter` selects on `account.id` (internal UUID). The frontend `Transaction` type exposes only `provider_account_id`, **not** the internal `account_id`. Account filtering of transactions is therefore done **server-side** today (`TransactionService.getTransactions({ accountIds })`). Keep that pattern — do not attempt client-side transaction filtering by account.
- **Card 4 denominator:** the filtered "Account Weight %" needs *total spend across all accounts*, but the existing month-transactions query is already account-filtered. Add one **always-unfiltered** month-transactions query, used solely for that denominator.
- **Subscriptions:** backend aggregates by `normalized_merchant`/`merchant_name` only (`repository_service.rs::get_subscription_summary`). Transactions carry `account_id: Option<Uuid>`. Add distinct `account_ids` per subscription so the frontend can filter subscriptions by `selectedAccountIds` **client-side** (instant, no extra round-trip).
- **"Budget Slack":** there is no top-level budget pool entity in the model. Define unfiltered Card 4 slack pragmatically as `max(0, remaining − upcomingSubscriptionsTotal)` and document that a true "unassigned pool" needs an income/total-budget concept that is out of scope.

---

## Phase 1 — Backend: account-attributed subscriptions

**Goal:** Each `SubscriptionSummary` carries the distinct accounts it was charged on, so the frontend can filter subscriptions by account.

**Tasks**
- `backend/src/models/subscription.rs` — add `pub account_ids: Vec<Uuid>` to `SubscriptionSummary` (with `ToSchema` annotation).
- `backend/src/services/repository_service.rs` (`get_subscription_summary`, ~L2762–2844) — while grouping each merchant's transactions, collect the distinct non-null `account_id`s and set `account_ids` on the summary.
- Regenerate OpenAPI (`backend/openapi/`, `docs/OPENAPI.json`) per CLAUDE.md's "adding a feature" flow.
- Mirror the type in `frontend/src/types/api.ts`: `SubscriptionSummary.account_ids: string[]`.
- Update backend tests in `backend/src/tests/budgets_overview_api_tests.rs` to assert account attribution; update any frontend fixtures/tests asserting the subscription shape (`frontend/tests/services/BudgetService.test.ts`, subscription stories/fixtures).

**Acceptance criteria**
- [x] `/budgets/overview` returns each subscription with a populated `account_ids` array.
- [x] A subscription charged on two accounts lists both ids; single-account subscriptions list one.
- [x] OpenAPI spec + `frontend/src/types/api.ts` reflect the new field; `cargo test -p sumurai-backend` and existing frontend type-checks pass.

**TDD log**
- Added `account_ids: Vec<Uuid>` to `SubscriptionSummary`; struct literal breakage was the red state.
- Updated `get_subscription_summary` to collect distinct non-null `account_id`s per merchant group.
- Backend test extended to assert two-account fixture round-trips; `cargo test` 632/632 pass.
- Regenerated `docs/OPENAPI.json` via `regenerate_openapi_artifacts` — `account_ids` now in required + properties.
- Mirrored field in `frontend/src/types/api.ts`; updated 7 test/fixture files; frontend typecheck clean; 31/31 frontend tests pass.

---

## Phase 2 — Insight math (pure domain)

**Goal:** A single, fully unit-tested calculator that turns budget stats + subscriptions + filter context into the four card values. No UI, no React.

**Tasks**
- Add `frontend/src/domain/BudgetInsightsCalculator.ts` exporting a `computeBudgetInsights(input)` returning a typed `BudgetInsights` object with the four metrics plus their supporting figures (e.g. `dailyPacing`, `safeToSpend`, `upcomingSubscriptionsTotal`, `runoutDate | null`, `accountWeightPct | null`, `budgetSlack`, and a `hasActivity` flag for the zero-transaction fallback).
- Inputs: `stats: BudgetStats`, `subscriptions: SubscriptionSummary[]` (already account-filtered by the hook), `month: Date`, `referenceDate: Date`, `isAccountFiltered: boolean`, `filteredBudgetSpend: number`, `totalBudgetSpend: number` (Card 4 denominator).
- Reuse `computeSubscriptionNextDueDate` for upcoming-subscription detection: a subscription counts if its next due date falls within `[referenceDate, monthEnd]`; sum `monthly_cost`.
- Guard every division: `daysRemaining === 0`, `currentDayOfMonth === 0`, zero burn ⇒ `runoutDate = null`; viewing a non-current month ⇒ projection cards degrade gracefully.
- Tests in `frontend/tests/domain/BudgetInsightsCalculator.test.ts`: per-card happy path, zero-spend, zero-budget, over-budget, month-end subscription clamping, filtered vs unfiltered Card 4, non-current-month.

**Acceptance criteria**
- [x] Each formula matches the PRD math and is covered by boundary unit tests.
- [x] No `NaN`/`Infinity` escapes; division-by-zero paths return defined fallback values.
- [x] Calculator is pure (no React/DOM/`Date.now` inside — `referenceDate` is injected).

**TDD log**
- Wrote `frontend/tests/domain/BudgetInsightsCalculator.test.ts` first (22 tests covering all four cards, zero-spend/zero-budget/over-budget, non-current-month projection, filtered vs unfiltered Card 4, hasActivity).
- Confirmed red (module-not-found error).
- Implemented `frontend/src/domain/BudgetInsightsCalculator.ts` using `computeSubscriptionNextDueDate` for upcoming detection, injected `referenceDate`, and clamped all division guards.
- 22/22 tests green; frontend typecheck clean.

---

## Phase 3 — Flip insight card UI + panel

**Goal:** Presentational components: one card that expand/fades between a metric front and a "Human Question" back, and a panel that lays out the four and owns flip state.

**Tasks**
- Add `frontend/src/features/budgets/components/BudgetInsightCard.tsx`: front renders in the `HeroStatCard` visual language (accent, icon, value/suffix, optional pills); back renders the question + a one-line "how to act" using the `AnimatePresence` height+opacity recipe from `CollapsibleSection`/`BankCard`. Whole card is a `button`/toggle with `aria-expanded`; click flips. Accept a `flipped` prop + `onToggle` so the panel owns state (state-preservation requirement).
- Add `frontend/src/features/budgets/components/BudgetInsightsPanel.tsx`: renders the four cards in the existing `grid-cols-2 lg:grid-cols-3`-style layout, maps `BudgetInsights` → card props, owns `flipped` state as `Record<cardId, boolean>`, and resets all cards to front via `useEffect` keyed on `month` + `selectedAccountIds` (PRD: filter change resets flips). Renders the zero-activity fallback copy (*"No budget activity recorded on this account for {Month} yet."*) when `hasActivity` is false.
- Storybook + interaction tests in `frontend/tests/features/budgets/components/`: front renders metric; clicking flips to the question; changing a filter-key prop resets to front; zero-activity fallback renders. Follow the `BankCard.stories.tsx` `play`-test pattern.

**Acceptance criteria**
- [x] Clicking a card smoothly reveals its question; clicking again returns to the metric.
- [x] A flipped card stays flipped until re-clicked or until the filter key changes (which resets all).
- [x] Zero-activity fallback copy renders when there is no budget activity for the active filter.
- [x] Components compose `HeroStatCard`/tokens/recipes — no one-off styling outside the design system.

**TDD log**
- Wrote `BudgetInsightCard.test.tsx` (6 tests) and `BudgetInsightsPanel.test.tsx` (7 tests) first; confirmed red.
- Implemented `BudgetInsightCard.tsx` using AnimatePresence mode="wait" for opacity cross-fade between front and back; card is a `button` with `aria-expanded`.
- Implemented `BudgetInsightsPanel.tsx` owning `Record<string,boolean>` flip state; `useEffect` on `[month, filterKey]` resets all. Card 4 swaps title/value/question based on `isAccountFiltered`.
- Added Storybook stories with `play` interaction tests for both components.
- 13/13 new tests + 21/21 total budgets-component tests green; typecheck clean.

---

## Phase 4 — Data wiring & page integration

**Goal:** Feed the panel from `useBudgets`, add the Card 4 denominator query, and replace the three hero cards on the page.

**Tasks**
- Extend `useBudgets` (`frontend/src/features/budgets/hooks/useBudgets.ts`):
  - Filter `subscriptions` client-side by `selectedAccountIds` (using new `account_ids`) when an account filter is active; expose both the filtered list and an `isAccountFiltered` flag. Subscriptions whose `account_ids` is empty (null transaction `account_id`) drop out when any account filter is active.
  - Add an **always-unfiltered** month-transactions query (all accounts, same `range`) and compute `totalBudgetSpend` across budgeted categories from it via `BudgetCalculator.calculateSpent`; compute `filteredBudgetSpend` from the existing (filtered) transactions. Expose both for Card 4.
  - Expose `selectedAccountIds` (or a derived filter key) so the panel can reset flips.
  - Reuse `accountIdsCacheKey`/existing query-key conventions; gate the unfiltered query the same way (`enabled` on accounts loaded + budgets success).
- In `BudgetsPage.tsx`: build `BudgetInsights` via `computeBudgetInsights(...)` (memoized like the current `stats`/`subscriptionHeroStats`), replace the three `HeroStatCard`s in `heroStats` with `<BudgetInsightsPanel … />`, and **keep** `<BudgetSummaryCard />` below it. Remove now-unused `SubscriptionCostsMetric`/overage-pill wiring only if nothing else references it.
- Update `frontend/tests/views/BudgetsPage.test.tsx` for the new card set and filter behavior.

**Acceptance criteria**
- [x] The page shows the four insight cards (Budget Summary card retained); old three hero cards are gone.
- [x] Changing the month or account filter recomputes all four cards and resets any flipped cards to front.
- [x] Account-filtered Card 4 shows a correct weight `%` (filtered spend ÷ all-account spend); unfiltered shows slack.
- [x] Safe-To-Spend subtracts only subscriptions attributed to the selected account when filtered.

**TDD log**
- Extended `useBudgets` with `filteredSubscriptions`, `isAccountFiltered`, `totalBudgetSpend`, `filterKey`, and an always-unfiltered month-transactions query for Card 4 denominator.
- Fixed `useBudgets.test.tsx` subscription-filter test to use 2 accounts so `isAllAccountsSelected` is correctly `false` when one is selected.
- Updated `BudgetsPage.tsx`: replaced 3 `HeroStatCard`s with `BudgetInsightsPanel`; removed `SubscriptionCalculator`/overage-pill/`HeroPill`/`fmtUSD`/`formatCategoryName` unused imports.
- Updated `BudgetsPage.test.tsx`: new card titles asserted; ordering test overrides `computedBudgets: []` so empty state renders as locator.
- 948 frontend tests pass, lint + typecheck clean.

---

## Risks & assumptions
- **No income/budget-pool concept exists.** Unfiltered Card 4 "Budget Slack" is defined as `max(0, remaining − upcomingSubscriptionsTotal)`. A literal "unassigned pool" metric is out of scope (needs an income/total-budget concept).
- **Extra query cost.** The unfiltered month-transactions query is additive; it shares `range` and React Query caching, so when no account filter is active it overlaps the primary query and stays cheap. Confirm it isn't double-fetching in the all-accounts case (reuse the same query key when `isAllAccountsSelected`).
- **Subscription account attribution accuracy** depends on transactions having non-null `account_id`; older/imported transactions with null account ids will simply not contribute to any account filter (documented behavior).
- **Out of scope (premium tier):** predictive/non-linear forecasting, merchant hazard alerts, auto-balancing — unchanged from the PRD.

## Verification (end-to-end)
1. Backend: `cargo test -p sumurai-backend --locked budgets_overview` then confirm `account_ids` in a live `/budgets/overview` response.
2. Domain: `npm --prefix frontend test -- tests/domain/BudgetInsightsCalculator.test.ts`.
3. Components: `npm --prefix frontend test -- tests/features/budgets/components/BudgetInsightCard.test.tsx` and the panel test; `bun test:storybook` for the interaction plays.
4. Page: `npm --prefix frontend test -- tests/views/BudgetsPage.test.tsx`.
5. Manual at **`http://localhost:8080`** (Nginx-backed, per CLAUDE.md — not `:3001`): open Budgets, confirm four cards; flip each to its question; change month and an account filter and confirm cards recompute and flips reset; select an account with no budget activity and confirm the fallback copy. Capture a screenshot via the preview tools as proof.
