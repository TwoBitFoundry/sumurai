# Subscriptions as a First-Class Category — Phased Plan

## Summary

Make recurring payments (Netflix, Spotify, gym, SaaS) a first-class concept by modeling **"subscription" as a real system category** rather than a parallel data model. A layered, provider-agnostic detector auto-assigns the category as a background pass after categorization; subscriptions then surface in a dedicated top-level **Subscriptions** view alongside Budgets, while inheriting the category picker, filter, donut, and override machinery for free.

Today the only notion of "recurring" is a crude in-SQL heuristic (merchant appears ≥3 times) at [repository_service.rs:1406](../backend/src/services/repository_service.rs) surfaced as a "Reoccurring" stat card at [TransactionsPage.tsx:151](../frontend/src/views/TransactionsPage.tsx). It has no cadence/amount/merchant intelligence and is replaced by this work.

## Core design

Two writers, both targeting `category_primary = "SUBSCRIPTION"`. `SUBSCRIPTION` is a new peer category sitting alongside `ENTERTAINMENT`, `GENERAL_SERVICES`, etc. — it does not replace any existing category.

- **Layer 1 — master list (instant, global).** A high-priority rule in the existing `deterministic_label()` cascade ([classifier_labels.rs:87](../backend/src/services/categorization/classifier_labels.rs)) matching known brands. The classifier input is `[debit] merchant_name`; extract the merchant portion and compare against `normalize_merchant_for_match()` ([merchant_name.rs](../backend/src/utils/merchant_name.rs)) applied to each master-list entry. Classifies even the first charge; gas/utility/transport rules already precede it so they're excluded by ordering.
- **Layer 2 — cadence + amount heuristic (per-user, background).** Looks at transactions already sitting in eligible categories (`ENTERTAINMENT`, `GENERAL_SERVICES`, `GENERAL_MERCHANDISE`, `RENT_AND_UTILITIES`, `PERSONAL_CARE`) and promotes them to `SUBSCRIPTION` when they form a stable recurring pattern. Groups by `normalized_merchant` (the DB column, populated on every sync/import as part of this plan), detects regular cadence + stable amounts, batch-updates matching transaction ids.

**Merchant normalization context.** The 14-stage `MerchantNormalizationService.normalize_batch()` ([merchant_normalization/service.rs](../backend/src/services/merchant_normalization/service.rs)) runs for every provider sync. For SimpleFin/OFX/CSV, `original_merchant_name` carries the raw bank string and the full pipeline does real cleanup. For Teller and Plaid, `original_merchant_name` is `None` — those providers supply pre-enriched names — so the pipeline processes an already-clean `merchant_name` and has minimal effect. In all cases `merchant_name` after sync is the reliable display field for matching and grouping.

User overrides always win because `effective_category = COALESCE(override, category_primary)` ([repository_service.rs:550](../backend/src/services/repository_service.rs)) — false positives self-correct via the existing inline re-categorization flow.

## Assumptions

- Subscriptions are **outflows** (amount < 0); income/transfers are excluded.
- **Cadence scan scope:** `ENTERTAINMENT`, `GENERAL_SERVICES`, `GENERAL_MERCHANDISE`, `RENT_AND_UTILITIES`, `PERSONAL_CARE`. Only transactions already in one of these categories are eligible for Layer 2 promotion. Master-list brands (Layer 1) classify as `SUBSCRIPTION` regardless of their existing category.
- Detection re-runs after every sync over a rolling **18-month** window — no separate per-user persistence table needed.
- Frontend `api.ts` types are hand-maintained and mirrored from the regenerated OpenAPI spec (no codegen).
- Tests are boundary-only and live in existing test folders, never inline (per repo testing policy).

## Risks

- **Override JOIN is currently silently broken.** `auto_categorize_filter` and the transaction read query already JOIN on `transactions.normalized_merchant`, but that column is always `NULL`, so overridden merchants are never excluded from auto-categorization today. Populating the column in Phase 2 fixes this but means the fix has real behavioral impact — verify existing override behavior in tests before and after.
- **False positives** in the cadence layer (e.g. a frequent coffee shop slipping through scope). Mitigated by category scoping, the exclusion list, amount-stability (CV) gate, and user override. Tune thresholds as consts.
- **Adding a system category** ripples into anything enumerating `SYSTEM_CATEGORY_SLUGS` (charts, budgets, pills). Verify no hardcoded category counts/maps break.
- **Background spawn after sync** must not block the request or panic the runtime; fire-and-forget with error logging, matching the auto-categorize pattern.
- **OpenAPI / type drift** between backend model and `frontend/src/types/api.ts` if regeneration is skipped.

---

## Phase 1 — SUBSCRIPTION system category + classifier wiring

**Goal:** Introduce `SUBSCRIPTION` as a real system category and make known-brand merchants classify into it instantly during normal categorization.

**Tasks:**
- Add `"SUBSCRIPTION"` to `SYSTEM_CATEGORY_SLUGS` and `("SUBSCRIPTION", "Subscriptions")` to `SYSTEM_CATEGORY_LABELS` in [category_descriptors.rs](../backend/src/services/categorization/category_descriptors.rs).
- In `pfc_primary_for_classifier_label()` ([classifier_labels.rs:31](../backend/src/services/categorization/classifier_labels.rs)), change the `"Subscription"` arm to return `"SUBSCRIPTION"` instead of `"ENTERTAINMENT"`. `ENTERTAINMENT` is unchanged and continues to exist as its own category.
- Create `backend/src/services/subscription_detection/known_merchants.rs` with a const master list (Netflix, Hulu, Disney+, Max, Paramount+, Peacock, Spotify, Apple/iCloud, YouTube Premium, Amazon Prime, Xbox/Game Pass, PlayStation Plus, Nintendo, Adobe, Dropbox, Audible, NYT, Patreon, …).
- Add a high-priority master-list rule to `deterministic_label()` (before the existing `subscription`/`monthly`/`saas` keyword branch) returning `"Subscription"` when `normalize_merchant_for_match()` applied to the merchant portion of the classifier input matches a known-merchant entry.

**Acceptance criteria:**
- [x] `SUBSCRIPTION` appears in `SYSTEM_CATEGORY_SLUGS` and resolves a display label via `system_category_display_label`.
- [x] A transaction from a master-list brand classifies as `SUBSCRIPTION` on its first occurrence.
- [x] The `"Subscription"` classifier label maps to `SUBSCRIPTION`; `ENTERTAINMENT` still resolves correctly for non-subscription entertainment transactions.
- [x] Existing classifier tests still pass; new tests cover master-list hits and the updated arm.

## Phase 2 — `normalized_merchant` as single source of truth + detection service + repository methods

**Goal:** Establish `transactions.normalized_merchant` as the one canonical key for all merchant-based logic (category overrides, subscription detection), fix the currently-broken override JOIN, then build the per-user cadence/amount detector.

**Background.** `transaction_category_overrides` already stores a `normalized_merchant` key and the read-side JOIN (`auto_categorize_filter`, `get_transaction_by_id_for_user`) already matches on `transactions.normalized_merchant = transaction_category_overrides.normalized_merchant`. However, `transactions.normalized_merchant` is never written, so the JOIN is silently always-null and overridden transactions are never correctly excluded from auto-categorization. Additionally, `category_management_service` recomputes `normalize_merchant_for_match(merchant_name)` on the fly when writing an override, creating a second normalization path that can drift. Both problems are fixed here.

**Tasks:**
- Fix `MerchantNormalizationService::normalize_batch` ([merchant_normalization/service.rs](../backend/src/services/merchant_normalization/service.rs)) to also write `txn.normalized_merchant = Some(normalize_merchant_for_match(&result.display))` after setting `merchant_name`. For the early-continue path (empty raw), still derive it from the existing `merchant_name` if present. This makes sync/import the single writer.
- Update `category_management_service::set_transaction_category` ([category_management/service.rs:149](../backend/src/services/category_management/service.rs)) to read `transaction.normalized_merchant` directly instead of recomputing `normalize_merchant_for_match(merchant_name)`. The stored column is now authoritative; the service must not diverge from it.
- Create `subscription_detection/exclusions.rs` (recurring-but-not-subscription normalized-merchant patterns) and `subscription_detection/cadence.rs` (pure helpers: cadence classification from day-gaps, amount coefficient-of-variation, normalized monthly-cost). Thresholds as named consts (`AMOUNT_CV_MAX ≈ 0.15`, cadence windows weekly/biweekly/monthly±5/quarterly±10/annual±20, min occurrences 3 short / 2 long).
- Create `subscription_detection/service.rs` with `detect_and_assign_for_user(repo, user_id)`: pull scoped outflows in window → drop exclusions → group by `transactions.normalized_merchant` → apply cadence + amount gates → batch-update matches to `SUBSCRIPTION` (skip already-SUBSCRIPTION and user-overridden merchants).
- Add `DatabaseRepository` trait methods (mockable) + Postgres impl in [repository_service.rs](../backend/src/services/repository_service.rs): `get_transactions_for_subscription_detection(user_id, since)`, a batch category-update for a set of transaction ids (reuse the auto_categorization update path), and `get_subscription_summary(user_id)` (group SUBSCRIPTION effective-category txns by `normalized_merchant` → merchant display name, count, representative amount, date span).

**Acceptance criteria:**
- [x] After a SimpleFin sync or CSV/OFX import, every transaction with a non-empty `merchant_name` has `normalized_merchant` set to its alphanumeric-lowercase form. Teller/Plaid transactions are covered by the same `normalize_batch` path.
- [x] Setting a category override on a transaction uses `transaction.normalized_merchant` from the DB; no separate recomputation of the key.
- [x] The `auto_categorize_filter` correctly excludes user-overridden merchants (i.e. the JOIN now finds matches).
- [x] `cadence.rs` helpers are pure and unit-tested (monthly/weekly/annual matches, variance rejection, monthly-cost normalization).
- [x] Detector assigns `SUBSCRIPTION` for a stable monthly merchant ≥3 occurrences; rejects high-variance amounts and sub-threshold counts.
- [x] Detector ignores out-of-scope categories and exclusion-list merchants.
- [x] Detector does not overwrite a user-overridden merchant.
- [x] Repository methods covered by tests using the existing `mockall`/`#[tokio::test]` pattern (see [budget_service_tests.rs](../backend/src/tests/budget_service_tests.rs)).

## Phase 3 — Background trigger (post-categorization, post-sync)

**Goal:** Run detection automatically in the background, never user-invoked.

**Tasks:**
- Append the detection pass as the final stage of the auto-categorization worker's `run_job` ([auto_categorization/service.rs](../backend/src/services/auto_categorization/service.rs)).
- In [sync_service.rs](../backend/src/services/sync_service.rs), after `upsert_transactions_batch`, `tokio::spawn` the background categorization+detection job (same fire-and-forget pattern as the auto-categorize endpoint), with error logging.
- Invalidate the transactions cache after the pass writes (existing `cache_service.clear_transactions` pattern).

**Acceptance criteria:**
- [ ] Detection runs as the last stage of the categorization job and updates job counters consistently.
- [ ] A completed sync spawns the background pass without blocking the response.
- [ ] Transactions cache is invalidated after detection writes.
- [ ] No new user-invoked endpoint is introduced for detection.

## Phase 4 — Read endpoint + contract

**Goal:** Expose detected subscriptions for the UI.

**Tasks:**
- Add `backend/src/models/subscription.rs` → `SubscriptionSummary { merchant, monthly_cost, cadence, last_charged, occurrence_count }` (derive via shared `cadence.rs` helpers).
- Add `GET /api/subscriptions` handler + route in [main.rs](../backend/src/main.rs) returning `Vec<SubscriptionSummary>`.
- Register schema + path in `backend/src/openapi/mod.rs`; regenerate `backend/openapi/` and `docs/OPENAPI.json`.
- Mirror the type in `frontend/src/types/api.ts`.

**Acceptance criteria:**
- [ ] `GET /api/subscriptions` returns the authenticated user's subscription summaries (RLS-scoped).
- [ ] Monthly cost is normalized by cadence and matches detector logic.
- [ ] OpenAPI spec regenerated and `api.ts` type mirrors the model.
- [ ] Handler covered by an integration-style test.

## Phase 5 — Frontend data layer

**Goal:** Make subscriptions data and the category label available to the UI.

**Tasks:**
- Add `SUBSCRIPTION: 'Subscriptions'` to `SYSTEM_CATEGORY_LABELS` in [categories.ts](../frontend/src/utils/categories.ts).
- Add `frontend/src/services/SubscriptionService.ts` (thin `ApiClient` wrapper for `/subscriptions`, goes through `ApiClient` — do not bypass).
- Add a `useSubscriptions` hook (React Query, `keepPreviousData`, month-range-aware like `useBudgets`).

**Acceptance criteria:**
- [ ] "Subscriptions" appears in `CategoryPicker`, the transactions category filter, and accent coloring with no extra wiring.
- [ ] `useSubscriptions` fetches and exposes loading/error/data states; tested at the service boundary.

## Phase 6 — First-class Subscriptions view + navigation

**Goal:** A dedicated top-level Subscriptions view placed alongside Budgets.

**Tasks:**
- Add `'subscriptions'` to the `TabKey` union and nav, positioned **immediately after `'budgets'`**, in [AuthenticatedApp.tsx](../frontend/src/components/AuthenticatedApp.tsx) and [AppLayout.tsx](../frontend/src/layouts/AppLayout.tsx); reuse the `BudgetMonthPillSlider` bottom bar so the view is month-scoped.
- Create `frontend/src/views/SubscriptionsPage.tsx` using `PageLayout` matching Budgets: hero `HeroStatCard`s (Monthly recurring, Active subscriptions, Largest, Annualized) + a `GlassCard` card-grid of subscription merchant cards (name · monthly amount · cadence badge), mirroring `BudgetList`. `EmptyState` when none.
- Card click deep-links to the Transactions tab with the category filter set to `SUBSCRIPTION` and merchant search prefilled (via [useTransactionFilterState](../frontend/src/features/transactions/hooks/useTransactionFilterState.ts) + tab switch in `AuthenticatedApp.tsx`).

**Acceptance criteria:**
- [ ] A "Subscriptions" tab renders next to Budgets with the month-scoped bottom bar.
- [ ] The view shows hero stats + a merchant card-grid composed from existing primitives, with an empty state.
- [ ] Clicking a card navigates to Transactions filtered to Subscriptions for that merchant.
- [ ] Tab routing + card-click deep-link covered by frontend tests.

## Phase 7 — Retire the crude heuristic

**Goal:** Single source of truth for "recurring".

**Tasks:**
- Replace/repoint the old "Reoccurring" hero card on [TransactionsPage.tsx:151](../frontend/src/views/TransactionsPage.tsx) (either drop it or back it with the subscription summary).
- Assess the in-SQL `recurring_count`/`recurring_merchants` logic in `get_transactions_insights` — leave only if still useful as a generic "frequent merchant" signal; otherwise remove and update `TransactionsInsightsResponse` consumers.

**Acceptance criteria:**
- [ ] No competing "recurring" definition remains user-visible; the SUBSCRIPTION category is authoritative.
- [ ] Any removed fields are cleaned from model, query, and frontend consumers without breaking the Transactions page.

## Phase 8 — End-to-end verification

**Goal:** Prove the full pipeline against real data.

**Tasks / acceptance criteria:**
- [ ] Seed: a master-list brand ×1 (instant), a non-listed stable monthly merchant ×4 (cadence), an excluded recurring merchant (skipped).
- [ ] `cargo test -p sumurai-backend --locked subscription_detection` passes.
- [ ] After a sync/Classify job: `GET /api/transactions?category_primary=SUBSCRIPTION` and `GET /api/subscriptions` return the expected merchants + monthly costs.
- [ ] At `http://localhost:8080`: Subscriptions tab shows stats + cards; card click deep-links to filtered Transactions; re-categorizing a transaction away removes it from the Subscriptions view (override wins). Capture console/network/screenshot proof.
- [ ] `bun --cwd=frontend test` passes.

---

### TDD log — Phase 2

- Added `normalized_merchant: Option<String>` to `Transaction` model; updated all construction sites.
- `normalize_batch` now writes `normalized_merchant` from the normalized display name; early-continue path derives it from `merchant_name` when present.
- `set_transaction_category` reads `transaction.normalized_merchant` directly (authoritative from DB).
- New repo methods: `get_transactions_for_subscription_detection`, `get_subscription_summary`.
- `subscription_detection/cadence.rs`: 13 pure unit tests; `exclusions.rs` guards well-known non-subscription merchants.
- `subscription_detection/service.rs`: `detect_and_assign_for_user` groups by `normalized_merchant`, applies cadence + CV gates.
- `models/subscription.rs`: `SubscriptionSummary` struct (pre-defined for Phase 4 endpoint).
- `cargo test -p sumurai-backend --locked`: 591 passed, 0 failed.

### TDD log — Phase 1

- `cargo test -p sumurai-backend --locked subscription_detection`: 6 passed
- `cargo test -p sumurai-backend --locked categorization_classifier`: 7 passed
- `cargo test -p sumurai-backend --locked`: 571 passed, 0 failed
- Known-merchant matching uses `normalize_merchant_for_match` (alpha-only lowercase) with substring contains. Master-list entries chosen conservatively (e.g. `amazonprime` not bare `amazon`) to avoid false positives.
- Updated two existing fixtures in `categorization_classifier_tests.rs` that expected `ENTERTAINMENT` from the `"Subscription"` label.

## Next actions

1. Begin Phase 1 (backend category + classifier) with TDD red-green.
2. Proceed phase-by-phase; do not start a phase until the prior phase's acceptance criteria are met.
3. Keep `docs/ARCHITECTURE.md` Caching section in sync if any cache TTL/key changes.

## Source

Derived from the approved plan at `/Users/kodybuss/.claude/plans/how-should-i-go-tingly-lighthouse.md`.
