# Fixed Expenses Feature Plan

## Context

Subscriptions are currently the only recurring-expense concept surfaced in the app. This plan reworks the subscriptions feature into a unified **Fixed Expenses** section that covers all recurring charges — streaming/software subscriptions AND bills (utilities, insurance, loans). The section groups items by cadence (biweekly → monthly → quarterly → yearly), shows only non-empty groups, and adds a category badge ("Subscription" / "Bills") to each card.

**Why:** A user's recurring obligations extend well beyond Netflix and Spotify. ISP bills, insurance premiums, and loan payments follow identical cadence patterns and belong in the same financial view.

**Key decisions:**
- Bills are detected with the same cadence algorithm as subscriptions, but targeting different source categories and a looser amount-variance threshold (35% vs 15%) to tolerate seasonal utility variation.
- Bill detection runs **after** subscription detection; any RENT_AND_UTILITIES transaction already promoted to SUBSCRIPTION is invisible to bill detection.
- The data contract is renamed end-to-end: `SubscriptionSummary` → `FixedExpenseSummary`, `subscriptions` → `fixed_expenses`. A `category: 'subscription' | 'bill'` field is added to the model.
- The specific bill sub-type (utility vs insurance vs loan) is not exposed as a distinct display label — all bill items show "Bills".

---

## Phase 1 — Backend: rename model + extend API contract

**Goal:** Rename the existing subscription model and API field to the fixed-expense naming, add the `category` field, and keep all existing subscription behavior working. No new detection logic yet.

**Tasks:**
- Rename `SubscriptionSummary` → `FixedExpenseSummary` in `backend/src/models/subscription.rs` (or rename file to `fixed_expense.rs`); add `category: String` field; update `mod.rs`
- Update `get_subscription_summary()` → `get_fixed_expense_summary()` in `backend/src/services/repository_service.rs`; populate `category = "subscription"` for all rows (BILL query added in Phase 2)
- In `backend/src/models/budget.rs`: rename `subscriptions: Vec<SubscriptionSummary>` → `fixed_expenses: Vec<FixedExpenseSummary>` on `BudgetsOverviewResponse`
- In `backend/src/main.rs` (budgets overview handler): replace `get_subscription_summary()` call with `get_fixed_expense_summary()`; update `tokio::join!` block
- Update any remaining `SubscriptionSummary` references in `backend/src/models/` and `backend/openapi/`

**Acceptance criteria:**
- [x] `cargo build -p sumurai-backend --locked` passes with no errors
- [x] `GET /api/budgets/overview` response includes `fixed_expenses` array (not `subscriptions`)
- [x] Each item in the array has a `category` field set to `"subscription"`
- [x] All existing subscription detection tests still pass: `cargo test -p sumurai-backend --locked subscription`

**TDD log:**
- All changes compiled clean on first attempt.
- `cargo test -p sumurai-backend --locked subscription` — 29 passed, 0 failed.
- Updated `budgets_overview_api_tests.rs` to use `FixedExpenseSummary`, `expect_get_fixed_expense_summary()`, and assert `v["fixed_expenses"]` with `category` field.

---

## Phase 2 — Backend: bill detection service + BILL category

**Goal:** Add the `BILL` category and a detection service that identifies recurring utility, insurance, and loan payments, then wires detection into the sync and auto-categorization pipelines.

**Tasks:**
- Add `"BILL"` to the system category list in `backend/src/services/categorization/classifier_labels.rs` (no deterministic merchant labeling — detection-only)
- Create `backend/src/services/bill_detection/` with:
  - `mod.rs` — module exports
  - `service.rs` — mirrors `subscription_detection/service.rs` with:
    - `ELIGIBLE_CATEGORIES`: `["RENT_AND_UTILITIES", "LOAN_PAYMENTS", "INSURANCE"]`
    - `ASSIGNED_CATEGORY`: `"BILL"`
    - `AMOUNT_CV_MAX`: `0.35` (vs 0.15 for subscriptions)
    - No exclusion list
    - Reuses `cadence.rs` via `use crate::services::subscription_detection::cadence`
  - `known_merchants.rs` — ISPs (Comcast/Xfinity, AT&T, Verizon, Spectrum, T-Mobile, Google Fi), major insurers (State Farm, Geico, Allstate, Progressive, USAA), common loan servicers
- Wire `bill_detection::detect_and_assign_for_user()` into `backend/src/services/connection_service.rs` after the existing subscription detection call (same background task pattern)
- Wire into `backend/src/services/auto_categorization/service.rs` after subscription detection call (~line 243)
- Extend `get_fixed_expense_summary()` query in `repository_service.rs` to include `effective_category IN ('SUBSCRIPTION', 'BILL')`; set `category = "bill"` when `effective_category = 'BILL'`
- Add test file `backend/src/tests/bill_detection_tests.rs`:
  - `detector_assigns_bill_for_stable_monthly_utility`
  - `detector_accepts_high_variance_within_35_pct_cv`
  - `detector_rejects_variance_above_35_pct`
  - `detector_skips_transactions_already_categorized_as_subscription`
  - `detector_rejects_sub_threshold_count`
- Register test module in `backend/src/tests/mod.rs`

**Acceptance criteria:**
- [ ] `cargo test -p sumurai-backend --locked bill` — all bill detection tests pass
- [ ] `GET /api/budgets/overview` returns items with `category: "bill"` for detected recurring utilities/insurance/loans
- [ ] Subscription-categorized RENT_AND_UTILITIES transactions do not appear as bills (double-counting check)
- [ ] `cargo test -p sumurai-backend --locked` — full backend test suite green

---

## Phase 3 — OpenAPI regeneration

**Goal:** Regenerate the OpenAPI schema after the model changes from Phases 1–2 are stable.

**Tasks:**
- Run the project's OpenAPI generation command (check `Makefile` or `CONTRIBUTING.md` for the exact command; output targets `backend/openapi/` and `docs/OPENAPI.json`)
- Verify `FixedExpenseSummary` schema appears with `category` field; `SubscriptionSummary` schema is removed; `BudgetsOverviewResponse.fixed_expenses` is present

**Acceptance criteria:**
- [ ] `docs/OPENAPI.json` reflects `fixed_expenses` and `FixedExpenseSummary` with `category`
- [ ] No stale `subscriptions` or `SubscriptionSummary` references remain in the generated schema

---

## Phase 4 — Frontend: types, feature rename, domain logic

**Goal:** Align the frontend data contract and domain layer with the backend changes. Rename the subscriptions feature folder to `fixed-expenses`. Add biweekly to the cadence grouping and make groups conditional.

**Tasks:**
- `frontend/src/types/api.ts`:
  - Rename `SubscriptionSummary` → `FixedExpenseSummary`; add `category: 'subscription' | 'bill'`
  - Rename `BudgetsOverviewResponse.subscriptions` → `fixed_expenses: FixedExpenseSummary[]`
- Rename `frontend/src/features/subscriptions/` → `frontend/src/features/fixed-expenses/`; update all internal imports
- `SubscriptionsSection.tsx` → `FixedExpensesSection.tsx`: title "Fixed Expenses"; keep collapsible + accent pattern
- `SubscriptionList.tsx` → `FixedExpenseList.tsx`: accepts `FixedExpenseSummary[]`; add category badge per card (`"subscription"` → "Subscription", `"bill"` → "Bills")
- `frontend/src/domain/subscriptionCadences.ts` (rename to `fixedExpenseCadences.ts`):
  - Add `"biweekly"` to the cadence order: `[biweekly, monthly, quarterly, annual]`
  - Update `groupByCadence()` to only return cadence groups with ≥ 1 item
- `frontend/src/domain/SubscriptionCalculator.ts` → `FixedExpenseCalculator.ts`:
  - `computeFixedExpenseHeroStats()` replaces `computeSubscriptionHeroStats()`; logic unchanged, operates on `FixedExpenseSummary[]`
- `frontend/src/features/budgets/hooks/useBudgets.ts`:
  - Rename `subscriptions` / `filteredSubscriptions` → `fixedExpenses` / `filteredFixedExpenses`
- `frontend/src/views/BudgetsPage.tsx`:
  - Replace `<SubscriptionsSection>` with `<FixedExpensesSection fixedExpenses={filteredFixedExpenses} />`
- `frontend/src/features/budgets/components/BudgetInsightsPanel.tsx`:
  - Rename "Sub Costs" insight tile → "Fixed Costs"
  - Use `FixedExpenseCalculator.computeFixedExpenseHeroStats()`

**Acceptance criteria:**
- [ ] `npm --prefix frontend run build` (or `tsc --noEmit`) passes with no type errors
- [ ] No remaining imports from `features/subscriptions/` or `domain/SubscriptionCalculator`
- [ ] `SubscriptionSummary` type has no usages in frontend source

---

## Phase 5 — Frontend: tests and fixtures

**Goal:** Update all frontend tests and fixtures to match the renamed types, new `category` field, and updated component names. Add bill examples to fixtures.

**Tasks:**
- Rename `frontend/src/storybook/fixtures/subscriptions.ts` → `fixed-expenses.ts`:
  - Rename exported array; add `category: 'subscription'` to existing subscription entries
  - Add 2–3 bill entries (e.g., Comcast, State Farm, car loan) with `category: 'bill'`
- `frontend/src/storybook/screens/user-journeys/BudgetsJourney.stories.tsx`:
  - Update mock `/budgets/overview` response to use `fixed_expenses` field with mixed subscription + bill items
- Rename test directory `frontend/tests/features/subscriptions/` → `frontend/tests/features/fixed-expenses/`; update component imports and type references throughout
- Add category badge assertions to `FixedExpensesSection.test.tsx` and `FixedExpenseList.test.tsx`
- `frontend/tests/domain/FixedExpenseCalculator.test.ts` (rename from `SubscriptionCalculator.test.ts`):
  - Verify `computeFixedExpenseHeroStats` handles mixed subscription + bill items
- `frontend/tests/domain/fixedExpenseCadences.test.ts` (rename from `subscriptionCadences.test.ts`):
  - Add test: biweekly group appears when items exist, absent when empty
  - Confirm other cadence groups are conditional (absent when empty)

**Acceptance criteria:**
- [ ] `npm --prefix frontend test -- fixed-expenses` — all tests pass
- [ ] `npm --prefix frontend test` — full frontend test suite green
- [ ] Storybook stories render Fixed Expenses section with "Subscription" and "Bills" badges visible
- [ ] Dev server at `http://localhost:8080` → Budgets page shows Fixed Expenses section with cadence groups, category badges, and "Fixed Costs" insight tile

---

## Assumptions

- The backend cadence algorithm already detects biweekly recurrence; it just needs to be included in the frontend cadence order constant.
- `category_primary` (original Plaid category) is available on the transaction row alongside `effective_category`, but Phase 2 does not need to inspect it since all BILL items share one display label.
- Subscription detection tests do not need substantive changes — only import path updates if `SubscriptionSummary` is referenced there.

## Risks

- **RENT_AND_UTILITIES overlap**: Subscription detection already includes RENT_AND_UTILITIES as an eligible category (e.g., a streaming service miscategorized by Plaid). The run-order dependency (subscriptions first, bills second) handles this, but it's worth confirming the eligible-category filter in the subscription detection service excludes already-overridden transactions.
- **CV threshold for bills**: 35% is a judgment call. A seasonal utility with very high summer/winter swing might still exceed this. Monitor false negatives in testing.
- **API contract break**: Renaming `subscriptions` → `fixed_expenses` is a breaking change to any client consuming the current API. Verify no other consumers (mobile, partner integrations) depend on the current field name before deploying Phase 1.
