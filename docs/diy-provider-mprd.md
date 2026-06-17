# DIY Provider — Milestone PRD

## Context

Sumurai supports three aggregators (Teller, SimpleFIN, Plaid) that sync accounts and
transactions automatically. This adds a **DIY** option: users create their own
institutions (account containers), custom accounts with a type (checking, savings, loan,
credit), and import their own transactions — manually, with no aggregator.

### Product rules

- **The "one aggregator at a time" rule stays.** A user can have at most one of
  Teller / Plaid / SimpleFIN connected; switching aggregators still requires disconnecting
  the current one first.
- **DIY is the exception** — it can *always* coexist alongside whichever aggregator is
  active (or none). Custom institutions can always be added.
- **When all aggregators are disconnected, the user may add any of the 4 provider types.**
  The entry point is the **"Link Account" CTA**.
- **Clicking the DIY card goes straight into the add/edit-institution UI, then add
  accounts** — not a "choose a provider later" deferral. ("Skip for now" / Link Account is
  the only deferral path.)
- When all accounts are disconnected, the app defaults to the **DIY state** while still
  offering the provider picker via the Link Account CTA.
- Disconnecting a DIY institution removes all its records (accounts + transactions),
  exactly like the other providers.
- DIY content is functionally identical everywhere else — its accounts/transactions flow
  through all graphs, filters, and sorting unchanged.
- DIY is the strongest-privacy, free, unlimited-coverage option. A **4th "Sync" row** is
  added to every provider card: checked for the three aggregators, "Manual uploads" for DIY.

### Architecture finding — no DB migration required

- `accounts.account_type` is a free `varchar` (no enum) — supports any type string.
- `provider_connections.provider` is a `varchar` — DIY = `provider = 'diy'`.
- `transactions.account_id` already links to accounts; import targets an account we create.

DIY is modeled exactly like an aggregator connection: a `provider_connections` row
(`provider = 'diy'`, user-supplied `institution_name`, `item_id = "diy_<uuid>"`, **no
`provider_credentials`**) with `accounts` rows beneath it (synthetic
`provider_account_id = "diy_<uuid>"`, user-chosen `account_type`). The existing disconnect
cascade, balances overview, transaction queries, filters, charts, and the per-account
Import flow all work with zero changes.

### Scope decisions (confirmed)

- **Transactions**: file import only — reuse `ImportModal` + `POST /api/transactions/import`.
  No manual single-transaction entry.
- **Management depth**: create institution + create accounts; removal via the existing
  disconnect-institution flow (cascades all records). No per-account edit/delete.

### Assumptions

- DIY connections have no credentials, so sync paths never resolve/sync them (safe by
  construction); no DIY-specific sync branch needed.
- The synthetic `provider_account_id = "diy_<uuid>"` satisfies the existing
  `OnConflict(ProviderAccountId)` upsert path.
- Account-type display/icon mapping already covers checking/savings/loan/credit (verify in
  Phase 3; add fallback if not).

### Risks

- `FinancialProvider` is a closed union; adding `'diy'` forces compile-time completion of
  every `Record<FinancialProvider, …>` map (intentional — surfaces all touch points).
- Picker gating and the conditional Link Account CTA must not let a user run two
  aggregators; covered by tests.
- OpenAPI regeneration must stay in sync (`backend/openapi/`, `docs/OPENAPI.json`,
  `frontend/src/types/api.ts`).

---

## Phase 0 — Author this MPRD

**Goal:** Capture the phased plan in `docs/` as the implementation handoff.

**Tasks**
- Write `docs/diy-provider-mprd.md` mirroring the approved plan.

**Acceptance criteria**
- [ ] `docs/diy-provider-mprd.md` exists with all phases, goals, tasks, and acceptance
      criteria.

---

## Phase 1 — Backend: make DIY a non-exclusive, selectable provider

**Goal:** DIY appears as a registered, selectable provider without breaking the
one-aggregator rule.

**Tasks**
- Add `backend/src/providers/diy_provider.rs` implementing `FinancialDataProvider`:
  `provider_name()` → `"diy"`; `get_accounts`/`get_transactions` → empty;
  `create_link_token`/`exchange_public_token`/`get_institution_info` → error.
- Register it in the registry alongside Teller/Plaid/SimpleFIN (search `register(` /
  `from_providers` in `backend/src/main.rs`).
- `get_authenticated_provider_info` (`backend/src/main.rs:~3956`): add `"diy"` to the
  provider iteration so it appears in `available_providers`.
- `select_authenticated_provider` (`backend/src/main.rs:~4014`): skip the conflict check
  when `requested_provider == "diy"`, and exclude `provider == "diy"` connections from the
  conflict scan. Leave the aggregator-vs-aggregator conflict (line ~4058) unchanged.

**Acceptance criteria**
- [ ] `/api/providers/info` lists `diy` in `available_providers`.
- [ ] `/api/providers/select` accepts `diy` even when an aggregator is connected.
- [ ] Selecting an aggregator is not blocked by existing `diy` connections.
- [ ] Switching between two aggregators is still blocked (rule preserved).
- [ ] DIY connections are never synced (no credentials path).

---

## Phase 2 — Backend: DIY institution & account creation endpoints

**Goal:** Create DIY institutions and accounts; transactions and disconnect reuse existing
flows.

**Tasks**
- Add `backend/src/services/diy_service.rs` (registered in `AppState`):
  - `create_institution(user_id, name)` → `ProviderConnection::new(user_id, "diy_<uuid>")`,
    `provider="diy"`, `mark_connected(name)`, `institution_id=Some("diy")`, persisted via
    `db_repository.save_provider_connection`.
  - `create_account(user_id, connection_id, name, account_type, mask?, balance?)` →
    validate connection ownership and `provider=="diy"`, build `Account` with
    `provider_account_id=Some("diy_<uuid>")` + `provider_connection_id`, `account_type` ∈
    {checking,savings,loan,credit}; persist via `db_repository.upsert_account`.
- Add models in `backend/src/models/diy.rs`: `CreateDiyInstitutionRequest/Response`,
  `CreateDiyAccountRequest/Response`.
- Add handlers + `#[utoipa::path]` in `backend/src/main.rs`:
  - `POST /api/diy/institutions`
  - `POST /api/diy/institutions/{connection_id}/accounts`
- Register routes near the other `/api/providers/*` routes (~line 577) and add to the
  OpenAPI doc set in `backend/src/openapi/mod.rs`.
- Transactions: no new endpoint — reuse `POST /api/transactions/import` with the DIY
  `account_id` (ownership via `ensure_import_account_owned`).
- Disconnect: no change — `disconnect_connection_by_id` already cascades.
- Regenerate OpenAPI (`backend/openapi/`, `docs/OPENAPI.json`).

**Acceptance criteria**
- [ ] `POST /api/diy/institutions` creates a `provider='diy'` connection owned by the user.
- [ ] `POST /api/diy/institutions/{id}/accounts` creates an account with the chosen type
      under that connection.
- [ ] Creating an account under a non-owned or non-DIY connection is rejected.
- [ ] Importing into a DIY account via the existing endpoint works.
- [ ] Disconnecting a DIY institution removes its accounts + transactions.
- [ ] OpenAPI artifacts regenerated and committed.

---

## Phase 3 — Frontend: types, provider card, and the new "Sync" row

**Goal:** DIY is a first-class provider in the picker with a 4th Sync row on every card.

**Tasks**
- Add `'diy'` to the `FinancialProvider` union in `frontend/src/types/api.ts`.
- `frontend/src/utils/providerCards.ts`:
  - Add `diy` to `PROVIDER_CARD_CONFIG` (badge "Self-Hosted", region "Unlimited", Cost
    "Free", Coverage "Unlimited", Privacy "Strongest" + privacyDetails).
  - Add a 4th "Sync" section to every card. Aggregators: "Automatic" / checked; DIY:
    "Manual uploads" / unchecked. Extend `ProviderCardSection` with `synced?: boolean`.
  - Add `diy` to `CONNECT_ACCOUNT_PROVIDER_CONTENT`; append `'diy'` to
    `PROVIDER_PRICE_ORDER`.
- `ProviderSelectionSection.tsx`: render check/dash when `section.synced` is defined
  (Lucide `Check`/`Minus` + existing status recipes).
- `frontend/src/utils/providerCapabilities.ts`: treat `'diy'` like `'simplefin'` (always
  listed/enabled). Add one-aggregator gating: given the connected aggregator, disable the
  other two aggregator cards ("Disconnect <active> first"); active aggregator + DIY stay
  enabled; all four enabled when none connected.

**Acceptance criteria**
- [ ] Picker shows 4 cards; each card has Cost, Coverage, Privacy, Sync rows.
- [ ] DIY Sync row renders unchecked / "Manual uploads"; aggregators render checked.
- [ ] With an aggregator connected, the other two aggregator cards are gated; DIY stays
      enabled.
- [ ] Type/lint pass with the expanded `FinancialProvider` union.

---

## Phase 4 — Frontend: DIY connect flow (create institution → accounts → import)

**Goal:** Clicking DIY opens the creation UI; accounts can be imported into.

**Tasks**
- Add `useDiyConnectionStrategy` in `frontend/src/hooks/financialConnection/` and register
  it in `connectionProviders.ts`. Clicking DIY opens the add/edit-institution UI (no SDK).
- Add `frontend/src/services/DiyService.ts` (through `ApiClient`): `createInstitution(name)`,
  `createAccount(connectionId, {name, accountType, mask?, balance?})`. Reuse `ImportService`.
- Add `frontend/src/features/diy/DiyInstitutionModal.tsx` (shared primitives/recipes):
  - Step 1 — institution form (name) → `createInstitution`.
  - Step 2 — account form(s) (name, type ∈ {checking,savings,loan,credit}, optional mask,
    optional starting balance) → `createAccount`; support adding multiple accounts.
  - Exposes `onComplete(connectionId)` so hosts diverge afterward (Phase 5).
- Per-account Import uses the existing button in `ConnectionsList` — no new import UI.
- Add "Add account" (on DIY institution rows) and "Add custom institution" entry points
  that reopen the same component.

**Acceptance criteria**
- [ ] DIY card opens `DiyInstitutionModal` directly (no SDK popup, no deferral screen).
- [ ] Creating an institution + account renders it in `ConnectionsList`.
- [ ] The per-account Import button imports transactions into a DIY account.
- [ ] "Add account" and "Add custom institution" reopen the shared modal.

---

## Phase 5 — Frontend: DIY default state + the two host flows

**Goal:** Onboarding and accounts-page hosts wire DIY correctly; Link Account behaves
conditionally.

**Tasks**
- Onboarding host (`OnboardingProviderPicker.tsx`):
  - In `handleSelectProvider`, branch `provider === 'diy'` to open `DiyInstitutionModal`
    instead of `initiateConnection()`.
  - `onComplete` → `chooseProvider('diy')` then `completeAndExit()` (reuse
    `handleConnectComplete`).
  - No gating (no aggregator can exist yet). "Skip for now" remains the only deferral.
- Accounts-page host (`AccountsPage.tsx`):
  - `onComplete` refreshes catalog + connections and closes the modal (no onboarding
    completion).
  - DIY default state (add-custom-institution CTA) when `needsProviderPick`.
  - Compute the active aggregator from `banks` (ignoring `provider==='diy'`) to drive the
    conditional **Link Account** CTA:
    - No aggregator active → opens the provider picker (all 4 selectable).
    - Aggregator active → opens that aggregator's link flow directly (no picker).
  - "Add custom institution" affordance is always available (opens `DiyInstitutionModal`),
    independent of Link Account.

**Acceptance criteria**
- [ ] Onboarding: selecting DIY creates a first institution + account, selects `diy`, and
      exits onboarding into the app.
- [ ] Onboarding: "Skip for now" lands in the accounts-page DIY default state.
- [ ] Accounts page, no aggregator: Link Account opens the picker (all 4).
- [ ] Accounts page, aggregator active: Link Account opens that aggregator's flow directly;
      DIY still addable via "Add custom institution".
- [ ] Disconnecting the last aggregator returns the app to the DIY default state.

---

## Phase 6 — Tests & verification

**Goal:** Behavior is covered by boundary tests and verified end-to-end.

**Tasks**
- Backend tests in `backend/src/tests/`: catalog lists `diy`; select allows `diy` w/o
  conflict; create-institution + create-account persist with `provider='diy'`; disconnect
  cascades DIY records. Extend `provider_selection_api_tests.rs` and `openapi_tests.rs`.
- Frontend tests in `frontend/tests/**`: providerCards has 4 sections incl. Sync;
  `DiyService` hits correct endpoints; DIY card renders unchecked Sync row.
- Follow `sumurai-testing-policy` (boundary-only, in test folders, not inline).

**End-to-end verification (http://localhost:8080, Nginx-backed)**
1. New/disconnected user → DIY default state + picker.
2. Picker shows 4 cards; DIY Sync row unchecked, others checked.
3. Choose DIY → create institution "My Cash" → add a "checking" account.
4. Import a CSV/OFX into that account → transactions appear in lists, charts, filters,
   sorting.
5. No aggregator → Link Account opens the picker (all 4) and an aggregator can be
   connected. Aggregator active → Link Account opens that aggregator's flow directly; DIY
   addable via "Add custom institution".
6. Disconnect DIY institution → its records removed. Disconnect aggregator → Link Account
   re-opens the picker, app returns to DIY default state.

**Acceptance criteria**
- [ ] Backend test suite passes including new DIY tests.
- [ ] Frontend test suite passes including new DIY tests.
- [ ] End-to-end steps 1–6 verified at `http://localhost:8080`.

---

## Next actions

- Implement phases 1 → 6 in order using strict TDD where practical.
- Regenerate OpenAPI after Phase 2; mirror types in `frontend/src/types/api.ts`.
- Verify account-type display/icon coverage during Phase 3.
