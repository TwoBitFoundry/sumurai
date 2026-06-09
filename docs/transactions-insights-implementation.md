# Contextual Transaction Analytics Bar — Phased Implementation Plan

> Implementation plan for [transactions-insights-rework.md](transactions-insights-rework.md). Companion to that PRD (requirements); this file is the build/handoff plan.

## Context

The Transactions page top area shows three static `HeroStatCard`s — **Total shown / Average size / Largest size** — fed by `/api/transactions/insights` (`views/TransactionsPage.tsx:136-176`, `features/transactions/hooks/useTransactionsInsights.ts`, `services/repository_service.rs:1613`). Static metrics skew on outliers and surface no behavioral insight.

We replace this with a **Contextual Analytics Bar**: three cards that morph by active filter state and cross-fade to reveal the human question each answers — modeled on the recently-shipped **Budgets insights** gold standard (`features/budgets/components/BudgetInsightsPanel.tsx` + `BudgetInsightCard.tsx` + `BudgetInsightQuestion.tsx`).

### Decisions locked (confirmed with stakeholder)

- **Theming:** neutral `slate` cards inside a single accent shell (`heroAccents.sky`), matching budgets — **overrides** the PRD's green/blue/purple scheme (§3.1/§5).
- **Flip:** reuse the budgets **cross-fade** (`AnimatePresence mode="wait"`, `FADE={duration:0.24, ease:[0.22,0.61,0.36,1]}`); **no** 3D flip.
- **Insight model — the hard requirement:** every metric describes the **shape of the in-view transaction set** and **how that subset compares to the overall** — never spend allocation, balances, cash flow, pacing, or subscription cost (all already on **Dashboard**: `BalancesOverview`, `SpendingByCategoryChart`, `TopMerchantsList`, `CashFlowChart`, `BudgetVsActualChart`; and **Budgets**: `BudgetInsightsPanel`). Avoiding overlap is non-negotiable.
- **Out of scope:** budget progress bars; **anomaly/predictive detection** (reserved for a later proactive-insights effort) — Card 3 is descriptive ("1.8× your usual"), never flagging.

### The unified card model (every state)

| Card | Role | Always answers |
| --- | --- | --- |
| **Card 1 — Volume** | magnitude of the in-view set | count + `SUM(ABS(amount))`, with a contextual **% share** caption when a parent exists. |
| **Card 2 — Shape** | what a transaction here *looks like* | the **typical** transaction — median (or **mode** / "the usual" in single-merchant contexts). |
| **Card 3 — Context** | subset vs. its parent | variance vs. parent median, share-of-wallet, swipe-preference, or composition split. *The PRD's most interesting idea.* |

State A (unfiltered) is the **baseline** other states compare against.

### Reusable building blocks (do not reinvent)

| Need | Existing asset |
| --- | --- |
| Flip card + question + shell + ring/gradient | `features/budgets/components/{BudgetInsightCard,BudgetInsightQuestion,BudgetInsightsPanel}.tsx` |
| Card recipes / accents | `components/widgets/HeroStatCard.tsx` (`heroStatCardRecipes`), `@/ui/tokens` (`heroAccents`) |
| Reset flipped on filter change | `resetKey`/`lastResetKey` in `BudgetInsightsPanel.tsx:44-53` |
| Mobile/desktop layout | `useViewportBreakpoint`, `tileLayout`/`subgridRow` props |
| Merchant normalization (search→canonical) | `backend/src/services/merchant_normalization/{engine,service}.rs` — `normalize(raw, src, index)`, `AliasIndex` (Redis-cached) |
| Effective category | `repository_service.rs` `effective_category_expr()` |
| Fixed vs variable / recurring | subscription detection writes `category_primary='SUBSCRIPTION'` (`services/subscription_detection/`) |
| Filtered base query + CTE aggregate pattern | `repository_service.rs` `insights_filtered_select()` (955) + `get_transactions_insights()` (1613) |
| Account filter state | `useAccountFilter()` (`selectedAccountIds`, `isAllAccountsSelected`) |

---

## State machine (shared FE ↔ BE)

State derives from three active dimensions: **a** = exactly one account selected; **c** = `selectedCategory != null`; **m** = search resolves to a normalized merchant (free-text that doesn't resolve does *not* activate `m`, but still filters rows).

| a | c | m | State |
|---|---|---|---|
| – | – | – | **A** Unfiltered |
| – | ✓ | – | **B** Category |
| – | – | ✓ | **C** Merchant |
| ✓ | – | – | **D** Account |
| ✓ | ✓ | – | **E** Account+Category |
| ✓ | – | ✓ | **F** Account+Merchant |
| – | ✓ | ✓ | **G** Category+Merchant |
| ✓ | ✓ | ✓ | **Triple** |

Backend is authoritative: it derives the state and echoes it in the response; FE keys copy off the returned `state`. **Edge cases:** multi-but-not-all accounts → `a` inactive (rows still filtered); unresolved free-text search → `m` inactive.

## Metrics + flip-side questions (source of truth for `insightCopy.ts`)

Each cell = **metric** + *human question*. "vs parent" = subset median vs. relaxed-filter median, as a ratio (`1.8×`) or signed %.

| State | Card 1 — Volume | Card 2 — Shape | Card 3 — Context (subset vs parent) |
|---|---|---|---|
| **A** baseline | count + `SUM(ABS(amount))`<br>*"How much, across how many transactions?"* | **median** `ABS(amount)`<br>*"What does a typical purchase look like?"* | fixed/variable **count** split (`category='SUBSCRIPTION'` vs rest)<br>*"How much is recurring bills vs active swipes?"* |
| **B** Category | category sum + count, "% of all spend" caption<br>*"What's my total here, and how big a slice is it?"* | category **median**<br>*"What does a typical purchase here cost?"* | category median **vs overall median** (⚠ parent = all cats, same range)<br>*"Are purchases here bigger or smaller than usual?"* |
| **C** Merchant | **lifetime** merchant sum + count (⚠ drop date filter)<br>*"How much have I spent here in total?"* | the **"usual"** = `mode()` of exact amounts (lifetime)<br>*"What's my go-to order here?"* | merchant median **vs its category's median** (⚠ parent = that category)<br>*"Is this merchant pricier than its category?"* |
| **D** Account | account sum + count, "% of all spend" caption<br>*"How much runs through this account, and what share is it?"* | account **median**<br>*"What does a typical charge here look like?"* | account median **vs overall median** (⚠ parent = all accounts)<br>*"Are charges here bigger or smaller than usual?"* |
| **E** Acct+Cat | sub-total sum + count<br>*"How much of this category goes on this card?"* | intersection **median**<br>*"What does a typical purchase here cost?"* | **share of wallet** = cat spend here ÷ cat spend **all accounts** (⚠ relax account)<br>*"What share of this category lands on this card?"* |
| **F** Acct+Merch | card-loyalty sum + count<br>*"How much have I spent here on this card?"* | intersection **median**<br>*"What's my typical receipt here on this card?"* | **swipe preference** = visits here on this card ÷ visits here **all accounts** (⚠ relax account)<br>*"How often do I use this card here vs others?"* |
| **G** Cat+Merch | merchant-in-cat sum + count, "% of category" caption<br>*"How much here, and what slice of the category?"* | merchant **median** (or "usual")<br>*"What does a typical purchase here cost?"* | merchant median **vs category-overall median** (⚠ parent = category). *Drop the PRD's "cross-category frequency."*<br>*"Is this merchant pricier than the category average?"* |
| **Triple** | triple-intersection sum + count<br>*"What's the total of this exact subset?"* | the **"usual"** = `mode()` of intersection amounts<br>*"What do I spend most often on this?"* | **recency** = `today − MAX(date)` days<br>*"How long since I last did this?"* |

**Postgres specifics:** median → `percentile_cont(0.5) WITHIN GROUP (ORDER BY ABS(amount))::float8`; mode → `mode() WITHIN GROUP (ORDER BY ABS(amount))::float8`; "vs parent"/lifetime → reuse `apply_transaction_filters` with the relaxed arg `None`, computed in the same round-trip (CTE per scope). Guard: parent denominator `0` or subset `< 2` rows → return `null`, card renders em-dash (mirror budgets' `'—'`). Merchant resolution → `merchant_normalization::normalize` → `canonical_key`, filter `normalized_merchant = canonical_key`; **fallback** regex/ILIKE clean (`*8931078006`, `STORE #120`) on `merchant_name`. `EXCLUDED_ANALYTICS_CATEGORY_PRIMARIES` still applies to spend sums.

---

## Phase 1 — Shared insight widgets

**Goal:** one shared, flip-capable insight card used by both Budgets and Transactions, so the new feature builds on the gold standard rather than copying it.

**Tasks:**
- Promote `BudgetInsightCard.tsx` → `components/widgets/InsightCard.tsx` and `BudgetInsightQuestion.tsx` → `components/widgets/InsightQuestion.tsx` (keep recipes, accents, `tileLayout`/`subgridRow`, cross-fade).
- Repoint `BudgetInsightsPanel.tsx` imports to the shared widgets; delete the budgets-local copies.
- Keep prop API identical (`title`, `icon`, `value`, `question`, `accent`, `flipped`, `onToggle`, `outlined`, `tileLayout`, `subgridRow`).

**Acceptance criteria:**
- [x] `InsightCard`/`InsightQuestion` live in `components/widgets/` and are imported by budgets.
- [x] Budgets insights render and flip exactly as before (existing budgets tests/stories green).
- [x] No duplicate card/question implementations remain.

**TDD log:**
- Promoted `BudgetInsightCard` → `InsightCard`, `BudgetInsightQuestion` → `InsightQuestion` in `components/widgets/`.
- Updated `BudgetInsightsPanel`, `BudgetSummaryCard` to import from shared widgets; deleted local copies.
- `data-testid` changed: `budget-insight-card-*` → `insight-card-*`; `budget-insight-question` → `insight-question`; updated `BudgetInsightsPanel.stories.tsx` accordingly.
- `npm --prefix frontend run typecheck` clean; `npm --prefix frontend run test:storybook` → 203 passed.

## Phase 2 — Backend: endpoint + Volume & Shape metrics

**Goal:** a new contextual-insights endpoint with the authoritative state machine and the per-state Volume + Shape metrics; Context fields returned `null` for now so the frontend can integrate early.

**Tasks:**
- Add models to `backend/src/models/transaction.rs`: `ContextualInsightsResponse { state, card1, card2, card3 }` and `InsightMetric { value, format, secondary?, comparison?, share?, label? }` (`format` ∈ currency|count|days|percent|ratio).
- Repository method `get_transactions_contextual_insights(user_id, search, account_ids, start, end, category)` deriving state (a/c/m rules) and dispatching per-state; reuse `insights_filtered_select` / `apply_transaction_filters`. Implement Card 1 (sum+count) and Card 2 (median, or mode for C/Triple); merchant resolution + fallback for `m`.
- Handler in `backend/src/main.rs` mirroring `get_authenticated_transactions_insights:1306`; route `GET /api/transactions/contextual-insights`.
- Register schema in `backend/src/openapi/mod.rs`; regenerate `backend/openapi/` + `docs/OPENAPI.json`.

**Acceptance criteria:**
- [ ] Endpoint returns the correct `state` for all 8 filter combinations.
- [ ] Card 1 (sum+count) and Card 2 (median/mode) correct for each state; merchant search resolves via normalization with regex fallback.
- [ ] Lifetime scope (State C) ignores the date-range filter; exclusion categories respected.
- [ ] OpenAPI regenerated and committed; `cargo test -p sumurai-backend --locked contextual` green.

## Phase 3 — Backend: Context (subset-vs-parent) metrics

**Goal:** the comparison layer — the feature's differentiator.

**Tasks:**
- Parent aggregates (relaxed-filter, same round-trip): overall median (B/D), category median (C/G), all-accounts denominators (E/F), category total (G).
- Card 3 per state: fixed/variable count split (A); variance ratio vs parent median (B/C/D/G); share-of-wallet % (E); swipe-preference % (F); recency days (Triple). Card 1 `share` caption (B/D/G).
- `null`-guard every ratio/denominator (`0` parent or `< 2` rows) → `comparison`/`share` = `null`.
- Verify/extend indexes for relaxed-filter aggregates: `(user_id, date)`, `(user_id, normalized_merchant)`, category; add a forward-only migration only if a hot path is unindexed.

**Acceptance criteria:**
- [ ] Each state's Card 3 matches hand-computed fixtures (variance, share-of-wallet, swipe-preference, recency, composition).
- [ ] Empty-parent / single-row cases return `null`, not misleading numbers.
- [ ] Endpoint p95 < 150ms on a representative dataset (parent aggregate included).

## Phase 4 — Frontend: panel, hook, copy, wire-up

**Goal:** replace the three static cards with the contextual panel, matching the budgets aesthetic.

**Tasks:**
- Mirror types in `frontend/src/types/api.ts` (`ContextualInsightsResponse`, `InsightMetric`, `InsightState`); add `TransactionService.getTransactionsContextualInsights()` via `ApiClient`.
- Hook `useTransactionsContextualInsights.ts` (evolve `useTransactionsInsights.ts`): same debounce + react-query cache keys + empty-selection short-circuit; expose account context for single-account state.
- `features/transactions/copy/insightCopy.ts` — `Record<InsightState, {card1,card2,card3}>` of `{ title, question, icon }`; `question` strings are the italicized text in the metrics table; titles short ("Volume", "Typical", "vs your usual").
- `features/transactions/components/TransactionInsightsPanel.tsx` mirroring `BudgetInsightsPanel`: sky shell + ring/gradient, slim header = active-state label, three `InsightCard`s (`accent="slate"`, `tileLayout={!isMobile}`, `subgridRow={isMobile}`), `flipped` map + reset on filter change (`resetKey` from state+search+category+accountKey+dateRange). Format each `InsightMetric` by `format` with caption units (`%`, `×`, `/d`).
- Wire into `views/TransactionsPage.tsx`: replace the `stats` `HeroStatCard` grid (136-176) with `<TransactionInsightsPanel/>`; remove dead `topCategories`/`categoryDriver`/`largestTransaction` derivations (67-80).

**Acceptance criteria:**
- [ ] All three cards render correct metric + flip to the correct question per state.
- [ ] Changing any filter resets flipped cards to the data face.
- [ ] Neutral slate cards in the accent shell visually match `BudgetInsightsPanel`; mobile + dark mode correct.
- [ ] Old static-card derivations removed; no dead code.

## Phase 5 — Tests & end-to-end verification

**Goal:** prove correctness and parity before handoff.

**Tasks:**
- Backend (`backend/src/tests/repository_service_tests.rs`): one test per state for metric math + merchant resolution/fallback + relaxed-denominator ratios + exclusion handling; extend `openapi_tests.rs`.
- Frontend (`frontend/tests/**`, boundary-only per `sumurai-testing-policy`): `TransactionInsightsPanel` test (title/question per state, flip toggle, filter-reset) + Storybook Vitest stories per state.
- Manual at **`http://localhost:8080`** (Nginx — not `:3001`): walk A→B→C→D→E→F→G→Triple, tap each card (question cross-fades), change filters (cards reset), verify aesthetic parity, mobile/dark via `preview_resize`, endpoint timing via `preview_network`, capture `preview_screenshot`s for the PR.

**Acceptance criteria:**
- [ ] `cargo test -p sumurai-backend --locked` and `npm --prefix frontend test` green.
- [ ] Storybook stories exist for every state and pass Vitest.
- [ ] Manual walkthrough confirms morph, flip, reset, parity, responsive/dark, <150ms.

---

## Assumptions
- Subscription detection has populated `category_primary='SUBSCRIPTION'` (fixed/variable split degrades to all-variable if not).
- `a` is active only for a single selected account; multi-account selections fall back to the other dimensions' state.
- The old `/api/transactions/insights` endpoint is retired after Phase 4 cutover (no other consumers — verify before deletion).

## Risks
- **Overlap creep:** re-check every card against Dashboard/Budgets coverage before merge — overlap is the top failure mode.
- **Performance:** Card 3's parent aggregate adds a second scan; keep it in one round-trip and watch the 150ms budget (Phase 3 acceptance gate).
- **Comparison legibility:** ratios must read plainly ("1.8× your usual"); avoid analyst-speak (the dropped "cross-category frequency").
- **Lifetime vs in-range confusion (State C):** copy must make the lifetime scope explicit so the number isn't misread as date-range-bound.

## Next actions
1. Confirm phase ordering with stakeholder (re-phasing was anticipated).
2. Start Phase 1 (shared widget extraction) — lowest risk, unblocks everything.
3. Hand Phases 2–3 to a backend implementer (TDD, boundary-only) and Phase 4 to frontend once the API contract from Phase 2 lands.
