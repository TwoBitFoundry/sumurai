# Fixed Expenses Feature Plan

## Context

Subscriptions are currently the only recurring-expense concept surfaced in the app. This plan reworks the subscriptions feature into a unified **Fixed Expenses** section that covers all recurring charges — streaming/software subscriptions AND bills (utilities, insurance, loans).

**Why:** A user's recurring obligations extend well beyond Netflix and Spotify. ISP bills, insurance premiums, and loan payments belong in the same financial view.

**Mental model:**

Auto-categorization is the normalizing layer for all transaction sources (Plaid, Teller, SimpleFin, custom imports). Every transaction ends up with the correct category before Fixed Expenses runs. This means:

- **Bills** are transactions already carrying RENT_AND_UTILITIES, LOAN_PAYMENTS, or INSURANCE as their effective category. No detection service needed — the category is the signal.
- **Subscriptions** carry the custom SUBSCRIPTION category populated by our subscription detection service (Plaid has no native subscription category).
- **Cadence classification** is used only for display grouping (biweekly → monthly → quarterly → yearly). It does not determine whether something is a fixed expense — the category does.

Note: RENT_AND_UTILITIES is stored as `category_primary = 'RENT_AND_UTILITIES'` but displayed as "Bills" in the UI.

**Key decisions:**
- `get_fixed_expense_summary()` queries `effective_category IN ('SUBSCRIPTION', 'RENT_AND_UTILITIES', 'LOAN_PAYMENTS', 'INSURANCE')` — one query, two display categories.
- `category: "subscription"` for SUBSCRIPTION items; `category: "bill"` for everything else.
- Subscription-promoted RENT_AND_UTILITIES transactions (where subscription detection set `category_primary = 'SUBSCRIPTION'`) naturally fall under SUBSCRIPTION, not bills — no special exclusion logic needed.
- No bill detection service. No CV gate. No category mutation for bills.
- The data contract is renamed end-to-end: `SubscriptionSummary` → `FixedExpenseSummary`, `subscriptions` → `fixed_expenses`.

---

## Phase 1 — Backend: rename model + extend API contract ✅

**Goal:** Rename the existing subscription model and API field to the fixed-expense naming, add the `category` field, and keep all existing subscription behavior working. No new query logic yet.

**Tasks:**
- Rename `SubscriptionSummary` → `FixedExpenseSummary` in `backend/src/models/subscription.rs`; add `category: String` field; update `mod.rs`
- Update `get_subscription_summary()` → `get_fixed_expense_summary()` in `backend/src/services/repository_service.rs`; populate `category = "subscription"` for all rows (bill categories added in Phase 2)
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

## Phase 2 — Backend: extend summary to include bill categories

**Goal:** Extend `get_fixed_expense_summary()` to pull in transactions from RENT_AND_UTILITIES, LOAN_PAYMENTS, and INSURANCE alongside SUBSCRIPTION transactions. Auto-categorization already ensures all sources have the correct category — no detection service is needed.

This phase also cleans up the partially-implemented bill detection service that was started and abandoned during development.

**Cleanup tasks (revert mid-session work):**
- Remove any remaining references to `bill_detection` module from `connection_service.rs` and `auto_categorization/service.rs`
- Remove `get_transactions_for_bill_detection` from `repository_service.rs` trait and impl
- Remove `expect_get_transactions_for_bill_detection()` calls from `auto_categorization_service_tests.rs`

**Implementation tasks:**
- In `repository_service.rs`, rewrite `get_fixed_expense_summary()`:
  - Single query: `effective_category IN ('SUBSCRIPTION', 'RENT_AND_UTILITIES', 'LOAN_PAYMENTS', 'INSURANCE')`
  - Group by `normalized_merchant` (fall back to `merchant_name`)
  - Classify cadence per group using existing `classify_cadence()` from subscription_detection
  - Set `category: "subscription"` when effective_category is SUBSCRIPTION; `category: "bill"` for all others
- Update `budgets_overview_api_tests.rs` to assert bill-category items appear with `category: "bill"`

**Acceptance criteria:**
- [x] `cargo build -p sumurai-backend --locked` passes with no errors
- [x] `GET /api/budgets/overview` returns items with `category: "bill"` for RENT_AND_UTILITIES / LOAN_PAYMENTS / INSURANCE transactions
- [x] SUBSCRIPTION transactions still return with `category: "subscription"`
- [x] No references to `bill_detection` remain anywhere in the backend
- [x] `cargo test -p sumurai-backend --locked` — full backend test suite green

**TDD log:**
- Removed `bill_detection` service (directory, trait method, impl, all test mock expectations).
- Rewrote `get_fixed_expense_summary()`: single query on `effective_category IN ('SUBSCRIPTION', 'RENT_AND_UTILITIES', 'LOAN_PAYMENTS', 'INSURANCE')`; groups by normalized_merchant; classifies cadence for display; sets `category` from `category_primary`.
- `cargo test -p sumurai-backend --locked` — 643 passed, 0 failed.

---

## Phase 3 — OpenAPI regeneration

**Goal:** Regenerate the OpenAPI schema after the model changes from Phases 1–2 are stable.

**Tasks:**
- Run the project's OpenAPI generation command (check `CONTRIBUTING.md` for the exact command; output targets `backend/openapi/` and `docs/OPENAPI.json`)
- Verify `FixedExpenseSummary` schema appears with `category` field; `SubscriptionSummary` schema is removed; `BudgetsOverviewResponse.fixed_expenses` is present

**Acceptance criteria:**
- [x] `docs/OPENAPI.json` reflects `fixed_expenses` and `FixedExpenseSummary` with `category`
- [x] No stale `subscriptions` or `SubscriptionSummary` references remain in the generated schema

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
- [x] `npm --prefix frontend run build` (or `tsc --noEmit`) passes with no type errors
- [x] No remaining imports from `features/subscriptions/` or `domain/SubscriptionCalculator` in production source
- [x] `SubscriptionSummary` re-exported as alias in `types/api.ts` for test shim backward compat; no direct usages in production source

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
- [x] `npm --prefix frontend test -- fixed-expenses` — all tests pass
- [x] `npm --prefix frontend test` — full frontend test suite green (1028 pass, 0 fail)
- [x] Storybook stories updated with "Fixed Costs" and new fixture including bill items
- [ ] Dev server at `http://localhost:8080` → Budgets page shows Fixed Expenses section with cadence groups, category badges, and "Fixed Costs" insight tile

---

## Risks

- **Single-occurrence bills:** A transaction with only one occurrence has no inter-transaction gaps, so cadence classification defaults to monthly. This is acceptable — the item is a real fixed expense by its category alone.
- **API contract break:** Renaming `subscriptions` → `fixed_expenses` is a breaking change to any client consuming the current API. Verify no other consumers (mobile, partner integrations) depend on the current field name before deploying Phase 1. (Phase 1 is already committed.)
