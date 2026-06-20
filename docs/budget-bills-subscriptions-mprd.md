# MPRD — Split Bills & Subscriptions; decouple & make subscriptions drift-proof

Status: Approved, ready for implementation
Owner: Kody Buss
Last updated: 2026-06-19

## Context

The Budget tab shows a single **Fixed Expenses** card, and subscription
detection is fused into other flows: it runs automatically on every sync
(`backend/src/services/connection_service.rs`) and at the end of every
auto-categorization job (`backend/src/services/auto_categorization/service.rs`).

The deeper problem is **drift**. The only thing persisted about a subscription is
the per-transaction `category_primary = SUBSCRIPTION` tag — the subscription
*entity* (cadence, monthly cost, predicted due dates, displayed category) is
**re-derived on every read** in `get_fixed_expense_summary`
(`backend/src/services/repository_service.rs:3532`). That derivation is
deterministic *given a fixed input*, but **not stable under input growth or the
passage of time**:

- A missed month, an extra charge, or a late-posting transaction changes the
  day-gaps → cadence reclassifies → monthly cost (normalized per cadence) and
  predicted due dates move with it.
- `representative = max(amount)` means one anomalous charge shifts the shown cost.
- Detection and the summary use an 18-month window anchored on `now()`, so the
  oldest charge silently falls out over time, moving `first_charged` (the
  cadence/due-date anchor) **with no new data at all**.

"Don't drift on the user" requires stability-under-growth, not just determinism.
This work makes subscription identity **deterministic from transaction history
and frozen at identification** via a persisted registry, then splits the UI and
decouples the triggers.

## Confirmed decisions

- **Persisted subscription registry** is the canonical source of subscription
  identity. Cadence frozen at identification; the read path projects from it
  deterministically. Live transactions decide month-presence, cost tallies, and
  the predicted next-due date.
- **Self-heal, no data backfill.** The schema migration creates the table, but
  there is **no backfill migration**. The Subscriptions scan CTA reconciles on its
  next run: any merchant currently tagged `SUBSCRIPTION` (via the old on-sync
  detector or the deterministic categorizer — e.g. Netflix/Spotify, `classifier_labels.rs`)
  that lacks a registry row gets classified from history and registered. Until the
  first scan, the section may be empty for existing users — the empty state prompts
  a scan. (Healing is tied to the **Subscriptions** CTA, not the Transactions
  auto-categorize CTA — they stay decoupled.)
- **Manual re-mark reclassifies.** A user override→`SUBSCRIPTION` **reactivates**
  an `unmarked` row and re-derives cadence/amount from current history. Detection
  still respects `unmarked` (never re-identifies). One shared `upsert` is split
  into a detection path (skips `unmarked`) and a manual path (reactivates).
- **Amount refresh = reanalyze + reconcile.** On each scan, recompute the
  representative amount from the current charge set deterministically (median of
  the trailing 3 same-cadence charges; most recent if fewer) and update the stored
  value if it changed. **Never** re-derive cadence. Anomaly-resistant by median.
- **Totals tally actual charges only.** Subscription monthly/YTD figures sum the
  charges that actually posted (`charge_dates` + amounts), **not** prospective
  unpaid projections. (Bills keep projected totals.)
- **Predicted due date reflects reality.** Project the next due date from
  `last_charged` (most recent actual charge) forward by the frozen cadence — closer
  to reality than projecting from the original first charge. Deterministic because
  `last_charged` only moves when a real charge lands.
- **Mixed charges → show total.** For a registered subscription, derive cost from
  all of that merchant's actual debits in the window and show their total; do not
  attempt to separate non-subscription charges. (Detection's CV gate already keeps
  heterogeneous merchants from being auto-registered.)
- **Cadence changes (monthly→annual) deferred.** Not handled this round; recovery
  path is unmark + re-mark. Documented, not silent.
- **Lapse gate** applies to **Subscriptions only** (Bills keep Upcoming/Missed
  projection).
- **Threshold** = charges in **2+ distinct consecutive calendar months**,
  regardless of cadence.
- **Section mapping**: Bills = `RENT_AND_UTILITIES` / `LOAN_PAYMENTS` /
  `INSURANCE`; Subscriptions = `SUBSCRIPTION`. Bills render first.
- **Subscriptions** get a `WandSparkles` magic CTA + toast progress/results; Bills
  do not.
- **Observability**: the scan emits **one aggregate structured log** on
  completion (eligible, newly-detected, healed, reactivated, amount-updated,
  skipped-unmarked, merchants-flagged, duration) — not per-merchant spam.

## Already-correct behavior to preserve (do NOT re-implement)

- `get_transactions_for_subscription_detection`
  (`repository_service.rs:3503`) already restricts to eligible categories and
  applies `auto_categorize_filter`, which **excludes user-overridden merchants** →
  user-customized categories are already kept out of the detection engine.
- Cadence classification (`backend/src/services/subscription_detection/cadence.rs`)
  and the CV ≤ 0.15 amount-stability gate are sound and reused as-is.

## Assumptions

- Transactions remain tagged `SUBSCRIPTION` at the row level (for Transactions
  page, analytics/sankey, budget-by-category); the registry is **additive** and is
  the source of truth only for the Budget tab Subscriptions cards.
- "Unmark" is performed via the existing recategorize UX (Transactions page
  `CategoryInlinePill`) — no new frontend control is required.
- The 18-month detection window constant is retained for *candidate gathering*;
  stability comes from freezing identity at identification, not from the window.
- Amount refresh happens only during an explicit scan (button press), not per read.

## Risks & mitigations

- **Two sources of truth (tag vs registry).** Mitigation: registry drives only the
  subscription cards; detection + override paths keep both in sync; reads never
  write.
- **RLS regression on the new table.** Mitigation: mirror the existing
  `transaction_category_overrides` RLS policy + `updated_at` trigger; add a
  tenant-isolation test.
- **OpenAPI / frontend type drift.** Mitigation: regenerate `backend/openapi/` +
  `docs/OPENAPI.json` and mirror in `frontend/src/types/api.ts` in the same phase.
- **Manual-override edge cases** (set→clear→re-set). Mitigation: `unmarked` status
  is sticky against detection; explicit re-mark reactivates.
- **Empty Subscriptions section until first scan** (no backfill migration).
  Mitigation: self-heal registers existing `SUBSCRIPTION`-tagged merchants on the
  first scan; the empty state prompts the user to run it.
- **Genuine cadence change** (e.g. monthly→annual) is not auto-corrected this round.
  Mitigation: documented; recovery is unmark + re-mark. Revisit if it surfaces.

Follow the `database-migrations-schema-evolution`, `repository-pattern-data-security`,
`sumurai-backend-architecture`, and `sumurai-testing-policy` skills.

---

## Phase 1 — Registry schema & entity (anti-drift foundation)

**Goal:** Persist subscription identity in a new tenant-isolated table.

**Tasks**
- New forward-only migration in `backend/migration/src/` creating
  `identified_subscriptions`; mirror RLS policy + `updated_at` trigger from
  `m20260528_000001_init.rs` (`transaction_category_overrides`).
- Columns: `id` (UUID PK), `user_id` (UUID NOT NULL, FK users, RLS key),
  `normalized_merchant` (TEXT NOT NULL), `cadence` (TEXT NOT NULL, frozen),
  `representative_amount` (DECIMAL(12,2)), `anchor_date` (DATE NOT NULL, frozen),
  `status` (TEXT NOT NULL DEFAULT `'active'`: `active` | `unmarked`),
  `source` (TEXT: `detected` | `manual`), `identified_at`/`updated_at` (TIMESTAMPTZ).
- Unique index `(user_id, normalized_merchant)`.
- Generate SeaORM entity `backend/entity/src/identified_subscriptions.rs`
  (FK to users only; merchant join is logical on `(user_id, normalized_merchant)`).

**Acceptance criteria**
- [ ] Migration applies cleanly and is reversible-forward per migration policy.
- [ ] RLS isolates `identified_subscriptions` per tenant (test proves cross-tenant
      rows are invisible).
- [ ] `updated_at` auto-updates on mutation.
- [ ] Entity compiles and is wired into the entity module.

## Phase 2 — Registry repository layer

**Goal:** CRUD + availability count for the registry, drift-proof by construction.

**Tasks** (`backend/src/services/repository_service.rs`, `with_tenant`)
- `register_subscription_detected(record)` — **detection path**: insert if absent;
  if existing & `active`, update **amount only** (never cadence/anchor); if
  `unmarked`, **no-op** (user decision wins).
- `register_subscription_manual(record)` — **manual path**: insert if absent;
  **reactivate** an `unmarked` row (status→`active`) and re-derive cadence/anchor/
  amount; update an `active` row's amount.
- `get_active_identified_subscriptions(user_id)`.
- `set_identified_subscription_status(user_id, normalized_merchant, status)` and
  `delete_identified_subscription(...)`.
- `count_eligible_subscription_detection(user_id)` — same filters as
  `get_transactions_for_subscription_detection` (amount<0, since-window, eligible
  categories, `auto_categorize_filter`).
- `get_orphan_subscription_merchants(user_id)` — **heal candidates**: merchants
  whose effective category is `SUBSCRIPTION` with **no** registry row (any status).
  Returns each merchant's charge history for classification.

**Acceptance criteria**
- [ ] Detection upsert on an `active` row changes amount but leaves cadence/anchor
      byte-for-byte unchanged.
- [ ] Detection upsert on an `unmarked` row is a no-op; manual register on an
      `unmarked` row reactivates and reclassifies.
- [ ] `get_orphan_subscription_merchants` returns `SUBSCRIPTION`-tagged merchants
      lacking a row (incl. deterministically-tagged), and excludes ones with any row.
- [ ] `count_eligible_subscription_detection` matches the detection candidate set.
- [ ] Boundary-only tests cover each method (existing `backend/src/tests/**`).

## Phase 3 — Decouple triggers & make detection registry-aware

**Goal:** Detection runs only on demand, writes/respects the registry, and uses
the new threshold.

**Tasks**
- `services/connection_service.rs` — delete both `detect_and_assign_for_user`
  `tokio::spawn` blocks (~1054–1089, ~1700–1730); keep unrelated cache-clears.
- `services/auto_categorization/service.rs` `run_job` (242–254) — drop the
  detection call and `state.updated += detection_count`.
- `services/subscription_detection/service.rs` `detect_and_assign_for_user`:
  - Return a result struct: `{ newly_detected, healed, reactivated, amount_updated,
    skipped_unmarked, transactions_updated }`.
  - **Threshold**: replace `MIN_OCCURRENCES_SHORT/LONG` check (73–81) with
    "charge dates span ≥2 distinct **consecutive** calendar months" (sorted
    year-month set, adjacent pair required), regardless of cadence. Keep
    `classify_cadence` + CV gate.
  - **Registry-aware (detection path)**: for each qualifying group call
    `register_subscription_detected` — `unmarked` → skip (count `skipped_unmarked`);
    `active` → keep cadence/anchor, refresh amount per rule below; no row → insert
    frozen cadence (classified now), `anchor_date = first qualifying charge`,
    `source = detected`. Continue tagging the group's transactions `SUBSCRIPTION`
    (monotonic).
  - **Self-heal step**: iterate `get_orphan_subscription_merchants` — merchants
    already tagged `SUBSCRIPTION` but with no registry row (legacy on-sync detector
    output + deterministic categorizer output). Classify cadence from history and
    insert (`source = detected`, counted as `healed`). This is what makes the
    section populate for existing users without a backfill migration.
  - **Amount refresh rule**: `representative_amount` = median of the trailing 3
    same-cadence charges (most recent if fewer); update the stored value only if it
    changed. Deterministic + anomaly-resistant. Never re-derive cadence.
  - **Structured log**: emit one aggregate completion log with the full result
    struct + `user_id` + duration (no per-merchant logs).

**Acceptance criteria**
- [ ] A sync no longer triggers subscription detection (verified in test/log).
- [ ] The auto-categorize job no longer triggers subscription detection.
- [ ] A merchant charged in 2 consecutive months is flagged; same-month-only
      charges are not.
- [ ] A `SUBSCRIPTION`-tagged merchant with no registry row (incl. a
      deterministically-tagged Netflix) is **healed** into the registry by a scan.
- [ ] `unmarked` and already-`active` merchants are never re-classified by detection.
- [ ] Amount refresh updates an `active` row's amount via the median rule but never
      its cadence/anchor; a single anomalous charge does not move it.
- [ ] Re-running detection over a grown/older-window dataset yields identical
      cadence/anchor for an existing subscription (determinism test).
- [ ] One aggregate structured log is emitted per scan with all result counts.

## Phase 4 — Manual override → registry

**Goal:** A user-set SUBSCRIPTION appears with an auto-classified cadence, and
"unmark" is durable.

**Tasks** — extend the category-override write path. Confirm `PUT
/transactions/{id}/category` (handler in `main.rs`, override upsert
`repository_service.rs` ~3070 / delete ~3110) resolves to a **merchant-level**
override keyed by `normalized_merchant` (the table is keyed that way) so a single
recategorize covers the merchant.
- Override set to `SUBSCRIPTION` → `register_subscription_manual` (cadence
  classified from that merchant's history at override time; `source = manual`).
  This **reactivates** a previously `unmarked` row.
- Override changed away from / cleared from `SUBSCRIPTION` →
  `set_identified_subscription_status('unmarked')`.

**Acceptance criteria**
- [ ] Manually marking a merchant SUBSCRIPTION creates an `active` registry row
      with a deterministic cadence/anchor.
- [ ] Recategorizing off SUBSCRIPTION sets the row `unmarked`.
- [ ] A subsequent **detection** scan does not re-identify an `unmarked` merchant,
      but a manual re-mark **does** reactivate + reclassify it.
- [ ] A single recategorize affects the whole merchant (merchant-level override).
- [ ] User categories are never run through the detection engine.

## Phase 5 — Read path: registry-driven subs + transaction-derived bills

**Goal:** Subscriptions project from frozen identity; bills keep current
projection; expose actual charge dates.

**Tasks**
- Refactor `get_fixed_expense_summary` (`repository_service.rs:3532`):
  - **Subscriptions** ← active registry rows. Join **all of that merchant's actual
    debits** (`normalized_merchant`, amount<0) within the window for `charge_dates`,
    their amounts, `occurrence_count`, `first_charged`/`last_charged`. Mixed
    charges are **not** separated — totals reflect the merchant's real spend.
    Identity comes from the registry: frozen `cadence`,
    `monthly_cost = normalize_to_monthly_cost(representative_amount, cadence)`,
    `category = "SUBSCRIPTION"`. Carry `last_charged` so the frontend projects the
    next due date from it (Phase 7).
  - **Bills** ← transactions whose effective category ∈ {RENT_AND_UTILITIES,
    LOAN_PAYMENTS, INSURANCE} (unchanged recompute logic).
- Add `charge_dates: Vec<NaiveDate>` (and the per-date amounts needed for
  actual-only totals) to
  `backend/src/models/subscription.rs::FixedExpenseSummary`.

**Acceptance criteria**
- [ ] Subscription cadence in the summary comes from the registry, not re-derivation.
- [ ] `charge_dates` (+ amounts) is populated from the merchant's real debits.
- [ ] Bills are unaffected (still transaction-derived, still projected).
- [ ] A subscription's cadence is invariant across repeated reads and an unrelated
      sync; only `charge_dates`/`last_charged` move when a real charge posts.

## Phase 6 — Standalone auto-subscription job + endpoints + types

**Goal:** A dedicated, cancellable detection job exposed over HTTP, with
availability gating.

**Tasks**
- `backend/src/models/subscription_detection_job.rs` —
  `SubscriptionDetectionJobState` (reuse `AutoCategorizationJobStatus` shape).
- `backend/src/services/subscription_detection/job.rs` —
  `SubscriptionDetectionJobService` modeled on
  `services/auto_categorization/service.rs`: Redis `start`/`get_status`/`cancel`,
  keys `subscription_detect:job:{user_id}` (+ cancel key). Single-pass worker:
  `total = count_eligible_subscription_detection`, run `detect_and_assign_for_user`,
  set the user-visible "found" = `newly_detected + healed + reactivated` (carry the
  full result struct for the toast), mark Completed, then `invalidate_session_caches`
  (clear transactions + budgets caches). Cancel is best-effort (single fast pass —
  may complete before cancel lands; document as cosmetic).
- Register service in `main.rs` (alongside `auto_categorization_service`, ~411/467).
- Routes/handlers mirroring 572–575 / 1764–1860:
  `POST /api/subscriptions/detect` (start), `GET` (status), `DELETE` (cancel).
  `GET` returns `{ job: SubscriptionDetectionJobState | null, eligible_count }`.
- Register schemas/paths in `openapi/mod.rs`; regenerate `backend/openapi/` +
  `docs/OPENAPI.json`. Mirror new types + `charge_dates` in
  `frontend/src/types/api.ts`.

**Acceptance criteria**
- [ ] `POST` starts a job; `GET` reports progress; `DELETE` cancels.
- [ ] `GET` returns `eligible_count` even with no active job.
- [ ] Job invalidates transaction + budget caches on completion.
- [ ] OpenAPI regenerated; frontend types mirror the backend.

## Phase 7 — Frontend: split into Bills + Subscriptions

**Goal:** Two cards, Bills first, with the subscription-only lapse gate.

**Tasks**
- `features/budgets/hooks/useBudgets.ts` — partition `filteredFixedExpenses` via
  `getFixedExpenseCategoryPrimary(item.category)` into `billExpenses` and
  `subscriptionExpenses`; filter subscriptions with new `hasActualChargeInMonth`,
  keep bills on `hasFixedExpenseChargeInMonth`.
- `views/BudgetsPage.tsx` — replace single `FixedExpensesSection` (252–265) with
  two `GlassCard`s: **Bills** first (icon e.g. `Receipt`), **Subscriptions**
  second (`Repeat2`); update subtitle (line 140).
- Generalize `features/fixed-expenses/components/FixedExpensesSection.tsx`
  (`title`/`titleIcon`/`sectionId`/labels/optional `actions`); render twice; reuse
  `FixedExpenseList`. Give Subscriptions its own empty state prompting a scan
  ("Run a scan to detect your subscriptions") — this is the self-heal entry point;
  Bills keeps a neutral empty state.
- `domain/FixedExpenseCalculator.ts`:
  - Add `hasActualChargeInMonth(summary, month)` (any `charge_dates` entry in
    `month`, reuse `isIsoDateInMonth`).
  - **Subscription cost = actual only.** Sum `charge_dates` amounts in the period
    for subscription month/YTD totals instead of the projected schedule. Bills keep
    the projected `computeFixedExpenseMonthCost`/`computeFixedExpenseYtdCost`.
  - **Subscription due date from `last_charged`.** Project the next due date from
    `last_charged` forward by cadence (reflect reality); bills keep
    `first_charged` projection.
- Ensure hero/insights totals (`BudgetInsightsPanel`, `insightsFixedExpenses`)
  use the actual-only subscription cost so cards and totals agree (no
  prospective-unpaid inflation).

**Acceptance criteria**
- [ ] Budget tab shows Bills then Subscriptions cards, same layout.
- [ ] A subscription with no charge in the viewed month is hidden; an unpaid bill
      still shows Missed/Upcoming.
- [ ] Subscription monthly/YTD totals count only posted charges; a lapsed sub does
      not inflate totals.
- [ ] A subscription's predicted next due date tracks its most recent actual charge.
- [ ] Subscriptions empty state prompts a scan; existing cadence-grouped card
      rendering is reused.

## Phase 8 — Frontend: Subscriptions magic CTA + toasts

**Goal:** On-demand scan with progress + results, gated on availability.

**Tasks**
- `services/SubscriptionDetectionService.ts` (mirror
  `AutoCategorizationService.ts`) — GET/POST/DELETE `/subscriptions/detect`.
- `features/.../useSubscriptionDetection.ts` (mirror `useAutoCategorization.ts`) —
  poll every 2s while active; `handleAction` toggles start/cancel; expose
  `eligibleCount`.
- CTA: `WandSparkles` `Button` in the Subscriptions section `actions` slot,
  identical treatment to `TransactionsPage` (92–117); disabled when
  `eligibleCount === 0`.
- Toasts: reuse `components/toastStack/ToastStack.tsx`; add subscription message
  builders (mirror `autoCategorizationToastMessages.ts`): "Scanning for
  subscriptions…" → "Subscription scan complete · N subscriptions found".
  Generalize `useAccountsToastStack` (or add a sibling hook); mount on Budgets
  page; invalidate `['budgets']` on terminal success.

**Acceptance criteria**
- [ ] CTA disabled at 0 eligible; enabled otherwise.
- [ ] Running the scan shows a progress toast then a terminal "N subscriptions
      found" toast.
- [ ] New subscriptions appear after a successful scan (budgets query invalidated).

---

## Testing (existing test folders only; boundary-only doubles)

Backend (`backend/src/tests/**`)
- [ ] Detection register freezes cadence/anchor; second run updates amount only.
- [ ] **Self-heal**: a `SUBSCRIPTION`-tagged merchant with no registry row (incl.
      deterministically-tagged) is registered by a scan; one with a row is untouched.
- [ ] `unmarked` rows never re-identified by detection; **manual re-mark reactivates
      + reclassifies**; manual override set/clear toggles status.
- [ ] Amount refresh uses median-of-trailing-3; a single anomalous charge does not
      move the stored amount.
- [ ] Threshold: 2-consecutive-month flags; same-month-only does not; overridden +
      active merchants untouched.
- [ ] Determinism: grown/older-window dataset → identical cadence for an existing sub.
- [ ] Read path: subs from registry, bills transaction-derived, `charge_dates` +
      amounts populated from real debits. Job lifecycle + `eligible_count`.
- [ ] One aggregate structured log per scan carries all result counts.

Frontend (`frontend/tests/**`)
- [ ] Bills/Subscriptions partition + ordering (Bills first).
- [ ] Lapse gate hides a no-charge sub; unpaid bill still shows Missed.
- [ ] Subscription totals count only posted charges (lapsed sub adds nothing);
      predicted due date tracks the latest actual charge.
- [ ] Subscriptions empty state prompts a scan.
- [ ] CTA disabled when `eligibleCount === 0`; toast progress→terminal shows "found".

## End-to-end verification

1. `cargo test -p sumurai-backend --locked subscription` + auto-categorization
   tests (confirm detection no longer runs there).
2. `bun --cwd=frontend test` for touched suites.
3. Manual at `http://localhost:8080` (Nginx-backed):
   - Bills then Subscriptions cards present.
   - Sync and auto-categorize do not create/alter subscriptions.
   - **Self-heal**: an existing user whose Netflix is already `SUBSCRIPTION`-tagged
     sees it absent before the first scan, then registered + shown after running it.
   - CTA disabled at 0 eligible; runs → "N subscriptions found" → rows appear.
   - Cadence stable across month navigation and after an unrelated sync; predicted
     due date tracks the most recent charge.
   - Recategorizing a merchant off Subscription removes it and it is not
     re-identified by a scan; manually re-marking it brings it back reclassified.
   - Subscription with no charge this month is absent and adds nothing to totals;
     unpaid bill still shows Missed.
4. Run the new migration locally; confirm RLS tenant isolation. `design:guard`
   only if a token/DESIGN.md change is introduced.

## Next actions

- Begin at Phase 1 (migration + entity) using strict TDD per `phase-implementer`.
- Keep this file as the source of truth; check off acceptance criteria as phases
  land.
