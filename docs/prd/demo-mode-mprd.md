# MPRD — Per-user demo mode with stable date offsets and fresh-start teardown

Status: Approved, ready for implementation
Owner: Kody Buss
Last updated: 2026-06-22

## Context

New users need a rich, immediate product experience without linking a real
institution first. The current repository has only a narrow, hardcoded demo-data
path in `backend/src/seed.rs` for the shared dev user `me@test.com`, with a
small fixed dataset and fixed transaction dates. That path is not appropriate as
the long-term user-facing demo experience:

- It is special-cased to one user instead of being a real product capability.
- The seeded financial data is too small to show off YTD analytics, budgets,
  transaction history, account variety, or category coverage.
- The dates are fixed in code, so they become stale as time moves forward.
- There is no user-visible demo-mode state, no clear warning before leaving demo
  mode, and no reliable fresh-start reset when a real institution is linked.

The target experience is a real per-user demo mode:

- New user accounts default toward demo mode.
- The onboarding path still lets the user link a real institution immediately or
  enter the demo experience through `Try demo mode`.
- Demo users receive a seeded, user-owned copy of realistic fake data that they
  can edit freely.
- When the user creates a new institution outside the seeded demo institutions,
  demo data is wiped and the user starts fresh with their own data.
- The authored demo dataset remains stable, but all transaction dates shift
  forward as a unit based on the current date so it never drifts out of a
  reasonable range.

## Confirmed decisions

- `users.demo_mode_active` is a required boolean with **no nulls**:
  `boolean not null default false`.
- First-party user creation paths write `demo_mode_active = true` explicitly even
  though the schema default is `false`.
- `demo_mode_active = true` on user creation is the pending default state for
  the new-account demo experience. The onboarding `Try demo mode` action is
  still the moment that seeds the demo dataset and marks onboarding complete.
- `me@test.com` keeps its password-login bootstrap, but loses its separate
  financial seed path. It uses the same shared demo-mode activation flow and the
  same dataset as every other demo-mode user.
- Demo mode data includes:
  - One synced institution, `Sumurai Demo Bank`
  - One seeded DIY institution
  - All account types
  - At least 300 transactions
  - Fake budgets
  - Repeated `OTHER` merchants for auto-categorization demos
  - Income and expenses
  - Strong YTD coverage
  - At least one transaction for every system category slug in
    `SYSTEM_CATEGORY_SLUGS`
- Every seeded transaction must persist both a raw merchant name
  (`original_merchant_name`) and a normalized merchant
  (`normalized_merchant`).
- Demo mode remains active while the user edits demo data, disconnects seeded
  institutions, or adds accounts to the seeded DIY institution.
- Demo mode ends only when the user creates a **new institution** outside the
  seeded demo institutions.
- Creating a new DIY institution counts as leaving demo mode.
- Adding an account to the already-seeded DIY institution does **not** leave
  demo mode.
- The date model is authored once and shifted at runtime:
  - Store fixed base dates in code for the demo dataset.
  - Store one fixed authored baseline latest transaction date for that dataset.
  - At seed time compute
    `offset_days = max(0, current_utc_date - authored_latest_transaction_date)`.
  - Apply the same `offset_days` to every base transaction date before
    persisting.
  - This preserves relative cadence and spacing while keeping the newest seeded
    activity current for the user.

## State model

### User-level state

- `demo_mode_active = false`
  - User is not in demo mode.
  - No demo badge is shown.
  - No demo exit warnings are shown.
- `demo_mode_active = true` and `onboarding_completed = false`
  - Newly created account in the default demo-ready state.
  - User has not yet entered the seeded demo workspace.
  - Onboarding still presents provider-linking options and `Try demo mode`.
- `demo_mode_active = true` and `onboarding_completed = true`
  - Seeded demo mode is active.
  - Demo badge is visible globally.
  - New-institution actions warn that demo data will be deleted and the user
    will start fresh.

### Demo exit boundaries

Leaving demo mode means:

- Delete demo financial-domain data for that user.
- Clear related caches.
- Set `demo_mode_active = false`.
- Persist the newly created institution and continue normally.

Leaving demo mode is triggered only by:

- Plaid connect
- Teller connect
- SimpleFIN connect
- DIY institution creation when it creates a brand-new institution

Leaving demo mode is not triggered by:

- Disconnecting a seeded institution
- Editing seeded accounts or transactions
- Adding accounts to the seeded DIY institution
- Importing into an existing seeded account

## Risks and mitigations

- **State ambiguity before onboarding completion.**
  Mitigation: treat `demo_mode_active = true` plus `onboarding_completed = false`
  as a valid pre-seed state; seed only through the explicit onboarding demo
  activation path.
- **Date drift over time.**
  Mitigation: authored base dates plus a forward-only runtime offset applied as a
  single unit to the whole dataset.
- **Mixed demo and real data.**
  Mitigation: wipe demo data before any new-institution creation succeeds.
- **Normalization gaps in fake data.**
  Mitigation: run the seed through the existing merchant-normalization service
  and apply a deterministic fallback if `normalized_merchant` remains missing.
- **Special-case code creeping back through `me@test.com`.**
  Mitigation: keep only the auth bootstrap for that user; route all financial
  seed behavior through the shared demo-mode service.
- **Frontend/backend contract drift on demo state.**
  Mitigation: make `demo_mode_active` required across backend models, API types,
  and frontend state, with no nullable branches.

## Assumptions

- `current_utc_date` means the backend server's UTC calendar date when demo data
  is seeded.
- The dataset shifts forward only. If the current date is earlier than the
  authored baseline latest transaction date, the offset is `0`.
- "When a new account is created" means a new **user account** in the auth flow,
  not a financial account under an institution.
- Budgets should only be created for budget-eligible spend categories; no
  budgets for `INCOME`, `TRANSFER_IN`, or `TRANSFER_OUT`.
- The seeded DIY institution is a normal existing institution after seeding.

Follow the `mprd`, `sumurai-backend-architecture`,
`sumurai-frontend-design-system`, and `sumurai-testing-policy` skills.

---

## Phase 1 — User state and auth contract

**Goal:** Add a durable, non-null demo-mode flag and carry it through the auth
contract.

**Tasks**
- Add a forward migration creating `users.demo_mode_active boolean not null
  default false`.
- Register the migration and regenerate `backend/entity/src/users.rs`.
- Extend backend auth models so `AuthResponse` includes `demo_mode_active:
  bool`.
- Extend every auth/session response path that already returns `AuthResponse`:
  refresh, password login, passkey login, passkey registration completion, and
  any recovery/authenticated enrollment path that emits the same payload.
- Update frontend API types so `AuthResponse` requires `demo_mode_active:
  boolean`.
- Update `App.tsx` session bootstrap and auth success paths to preserve
  `demo_mode_active` in app state from the first response onward.

**Acceptance criteria**
- [x] `demo_mode_active` is non-null in schema, entity, backend model, API type,
      and frontend type.
- [x] Auth/session payloads always include `demo_mode_active`.
- [x] No nullable demo-state branches remain in frontend or backend code.

**TDD log**
- Red: added backend auth/user contract assertions in
  `backend/src/tests/auth_handlers_integration_tests.rs` and
  `backend/src/tests/user_model_tests.rs`, plus frontend session-state coverage
  in `frontend/tests/App.test.tsx`.
- Green: added `users.demo_mode_active`, propagated the field through backend
  auth/session models and frontend auth/session state, and updated generated
  entity code and fixtures.
- Verification:
  `cargo test -p sumurai-backend --locked`
  `cargo check --workspace --locked --all-targets`
  `cargo fmt -p sumurai-backend -p entity --check`
  `bun --cwd=frontend run test`
  `bun --cwd=frontend run typecheck`
  `bun --cwd=frontend run build`

## Phase 2 — New-user defaults and shared demo bootstrap

**Goal:** Make new users demo-ready by default and remove the legacy special
financial seed path.

**Tasks**
- In the user-creation path that persists a new user row after passkey
  registration, explicitly write `demo_mode_active = true`.
- Keep the database default as `false` for safety, but do not rely on it for
  first-party signups.
- In `maybe_seed_demo_user`, explicitly create `me@test.com` with
  `demo_mode_active = true`.
- Remove the old dedicated financial seed entrypoint for `me@test.com`
  (`maybe_seed_demo_simplefin_data`) and its special-case runtime wiring.
- Replace it with a shared demo activation service call so `me@test.com` gets
  the same seeded demo workspace as any other demo user.

**Acceptance criteria**
- [x] First-party new user creation persists `demo_mode_active = true`.
- [x] `me@test.com` no longer depends on a legacy special financial seed path.
- [x] Only one shared service owns demo financial seeding.

**TDD log**
- Red: extended passkey registration coverage to assert newly created users are
  demo-ready by default, and moved demo financial seed coverage to the shared
  service boundary in `backend/src/tests/seed_simplefin_tests.rs`.
- Green: passkey-finish signup now writes `demo_mode_active = true`,
  `maybe_seed_demo_user` creates `me@test.com` with the same state, and startup
  seeding now routes through `DemoModeService`.
- Verification:
  `cargo test -p sumurai-backend --locked passkey_registration_tests::given_register_and_finish_when_authenticated_request_then_succeeds`
  `cargo test -p sumurai-backend --locked seed_simplefin_tests`

## Phase 3 — Shared demo activation service and dataset authoring

**Goal:** Build one shared demo-mode service that seeds a large, realistic,
 user-owned financial workspace.

**Tasks**
- Create a service in `backend/src/services` that:
  - Enables demo mode for a user
  - Builds the authored demo dataset
  - Applies runtime date offsets
  - Seeds provider connections, accounts, transactions, and budgets
  - Marks onboarding complete when entered from onboarding
- The authored dataset must include:
  - `Sumurai Demo Bank` as a synced institution
  - One DIY institution
  - Checking, savings, credit, investment, and loan accounts
  - At least two accounts in the seeded DIY institution
  - At least 300 transactions
  - Both income and expense transactions
  - At least one transaction for every slug in
    `backend/src/services/categorization/category_descriptors.rs`
  - Repeated `OTHER` merchants with enough frequency to make auto-categorization
    worth demonstrating
  - Recurring rent, utilities, subscriptions, transportation, shopping,
    services, healthcare, travel, fees, and transfer activity
- Seed budgets for the eligible spend categories represented in the dataset.
- Use the existing merchant normalization service for all seeded transactions.
- Guarantee `original_merchant_name` is set to the raw seeded merchant string
  and `normalized_merchant` is non-null on every persisted seeded transaction.
- Set `user.provider = "simplefin"` when the demo workspace is activated.

**Acceptance criteria**
- [x] Demo activation seeds one synced institution and one DIY institution.
- [x] The dataset contains at least 300 transactions.
- [x] Every system category slug is represented at least once.
- [x] Fake budgets exist for represented budget-eligible spend categories.
- [x] Every seeded transaction has raw and normalized merchant fields.

**TDD log**
- Red: rewrote `backend/src/tests/seed_simplefin_tests.rs` around the shared
  service boundary to assert synced + DIY seeding, category coverage, runtime
  offsets, recurring `OTHER` merchants, budget creation, and normalized
  merchant persistence.
- Green: `DemoModeService` now owns the authored demo dataset, deterministic
  connection/account ids, runtime date shifting, merchant normalization, budget
  seeding, and provider selection updates for demo activation.
- Verification:
  `cargo test -p sumurai-backend --locked seed_simplefin_tests`
  `cargo check -p sumurai-backend --locked`

## Phase 4 — Stable runtime date offsets

**Goal:** Keep the seeded dataset current without changing its authored shape.

**Tasks**
- Define fixed base dates for the authored demo dataset in code.
- Define one authored baseline latest transaction date for that dataset.
- At seed time compute:
  - `current_date = Utc::now().date_naive()`
  - `offset_days = max(0, (current_date - authored_latest_transaction_date).num_days())`
- Apply `offset_days` to every authored base transaction date before the
  transaction objects are persisted.
- Apply the shift uniformly across recurring charges, income events, transfers,
  and edge-case demo merchants.
- Keep the authored non-date attributes unchanged: amounts, accounts, raw
  merchants, category intent, recurrence pattern, and ordering logic.

**Acceptance criteria**
- [x] The latest generated seeded transaction date equals the current UTC date
      when seeding happens after the authored baseline latest date.
- [x] Relative day gaps between authored transactions are preserved exactly after
      shifting.
- [x] Recurring monthly patterns remain monthly after shifting.
- [x] Seeding before the authored baseline latest date applies an offset of `0`.

**TDD log**
- Red: added offset-focused assertions in
  `backend/src/tests/seed_simplefin_tests.rs` for pre-baseline no-op behavior,
  post-baseline offset growth, and preserved monthly day gaps in shifted demo
  transactions.
- Green: the authored dataset now uses fixed baseline dates with a single
  `runtime_offset_days` rule applied uniformly before persistence.
- Verification:
  `cargo test -p sumurai-backend --locked seed_simplefin_tests`

## Phase 5 — Onboarding demo activation path

**Goal:** Let the user explicitly enter the seeded demo workspace from
onboarding.

**Tasks**
- Add a protected endpoint `POST /api/auth/onboarding/demo` that:
  - Verifies the authenticated user
  - Runs the shared demo activation service for that user
  - Marks onboarding complete
  - Returns `{ message, onboarding_completed: true, demo_mode_active: true }`
- Rename onboarding `Skip for now` to `Try demo mode`.
- Update `OnboardingProviderPicker` to call the new onboarding demo endpoint
  instead of plain onboarding-complete when the user chooses demo mode.
- Preserve the existing real-provider onboarding path so users can still link a
  real institution immediately without entering the seeded demo workspace.

**Acceptance criteria**
- [x] The onboarding CTA label is `Try demo mode`.
- [x] Choosing that CTA creates the seeded demo workspace and completes
      onboarding.
- [x] Linking a real institution from onboarding still works without seeding the
      demo dataset first.

**TDD log**
- Red: added an authenticated backend handler test for
  `POST /api/auth/onboarding/demo` and updated
  `frontend/tests/components/onboarding/OnboardingProviderPicker.test.tsx` to
  verify the new CTA and its dedicated auth-service call.
- Green: onboarding now exposes a protected demo-activation endpoint, returns
  `demo_mode_active`, calls the shared demo service, and preserves the existing
  real-provider completion flow.
- Verification:
  `cargo test -p sumurai-backend --locked auth_handlers_integration_tests::given_authenticated_user_when_activating_demo_mode_then_seeds_workspace_and_marks_onboarding_complete`
  `bun --cwd=frontend run test OnboardingProviderPicker`
  `bun --cwd=frontend run test AuthService.integration`
  `bun --cwd=frontend run typecheck`
  `bun --cwd=frontend run build`

## Phase 6 — Demo badge and exit warnings

**Goal:** Make demo mode globally visible and clearly warn before it is exited.

**Tasks**
- Carry required `demo_mode_active` state through `App`, `AuthenticatedApp`, and
  `AppLayout`.
- Show a persistent `Demo mode` badge in shared authenticated app chrome, using
  existing badge/pill primitives instead of one-off styling.
- In the Accounts experience, warn before any action that creates a new
  institution while `demo_mode_active = true`.
- The warning copy must state that demo accounts, transactions, budgets, and
  category changes will be deleted and the user will start fresh.
- Show that warning for:
  - Plaid connect
  - Teller connect
  - SimpleFIN connect
  - DIY institution creation when no `connectionId` exists yet
- Do not show that warning for:
  - Adding accounts to the seeded DIY institution
  - Disconnecting seeded institutions

**Acceptance criteria**
- [x] Demo badge is visible globally whenever `demo_mode_active = true` and
      onboarding is complete.
- [x] New-institution actions in Accounts show the warning in demo mode.
- [x] Add-account inside the seeded DIY institution does not show the warning.

**TDD log**
- Red: extended `frontend/tests/ui/primitives/AppTitleBar.test.tsx` for global
  demo badge visibility and `frontend/tests/views/AccountsPage.test.tsx` for
  new-institution warning gating versus seeded DIY add-account bypass.
- Green: wired `demoModeActive` through `AuthenticatedApp`, `AppLayout`, and
  `AppTitleBar`; added `DemoExitWarningModal` and gated Accounts new-institution
  actions behind the shared warning flow.
- Verification:
  `bun --cwd=frontend run test`
  `bun --cwd=frontend run typecheck`
  `bun --cwd=frontend run build`

## Phase 7 — Fresh-start teardown on first real institution

**Goal:** Exit demo mode cleanly before the user's first real institution is
created.

**Tasks**
- Add a shared teardown path in backend services that deletes the user's demo
  financial-domain data and clears related cache entries.
- The teardown must remove:
  - Provider connections
  - Provider credentials
  - Accounts
  - Transactions
  - Budgets
  - Transaction category overrides
  - User custom categories
  - SimpleFIN hidden-org and root-credential records
  - Related caches
- After teardown, set `demo_mode_active = false`.
- Invoke teardown only at new-institution boundaries:
  - Before `ConnectionService.exchange_public_token` persists a new Plaid,
    Teller, or SimpleFIN institution
  - Before `create_diy_institution` persists a brand-new DIY institution
- Do not invoke teardown for `create_diy_account` when it targets an existing
  seeded DIY connection.
- After a successful new-institution creation, clear the frontend demo-state
  view immediately so the badge and warnings disappear without requiring a full
  reload.

**Acceptance criteria**
- [ ] Connecting a new real institution from demo mode wipes demo data and
      leaves only the new institution.
- [ ] Creating a new DIY institution from demo mode wipes demo data and leaves
      only the new DIY institution.
- [ ] Adding an account to the seeded DIY institution preserves demo mode and
      existing demo data.
- [ ] `demo_mode_active` is `false` after successful demo exit.

## Phase 8 — Test coverage and validation

**Goal:** Cover the new state machine, dataset contract, and teardown behavior at
the right boundaries.

**Tasks**
- Backend tests:
  - Migration/entity/model contract for non-null `demo_mode_active`
  - New-user creation writes `demo_mode_active = true`
  - `me@test.com` no longer uses legacy special financial seed data
  - Demo activation seeds both institutions and all required account types
  - Demo activation seeds at least 300 transactions
  - Full category coverage across `SYSTEM_CATEGORY_SLUGS`
  - Repeated `OTHER` merchants present
  - Income and expense transactions present
  - Raw and normalized merchant fields present for every seeded transaction
  - Date offset application preserves relative spacing and updates latest date as
    specified
  - First real provider connection wipes demo data before persisting the new
    institution
  - New DIY institution creation wipes demo data
  - `create_diy_account` on the seeded DIY connection does not wipe demo data
- Frontend tests:
  - Onboarding CTA rename and action path
  - Required boolean `demo_mode_active` session handling
  - Global demo badge visibility
  - Accounts exit warning behavior on new-institution actions only

**Acceptance criteria**
- [ ] Focused backend and frontend tests cover the new state machine and dataset
      contract.
- [ ] Validation passes with:
      `cargo test -p sumurai-backend --locked`,
      `cargo check --workspace --locked --all-targets`,
      `bun --cwd=frontend run test`,
      `bun --cwd=frontend run typecheck`,
      `bun --cwd=frontend run build`.

## Next actions

- Implement the schema and auth-contract work first so all later demo-mode
  behavior has a stable user-state backbone.
- Build the shared demo activation service before touching onboarding or
  Accounts UI, so frontend work can integrate against the final backend
  contract.
- Add the date-offset tests alongside the new dataset builder, not after the UI
  wiring, because the date model is a core product rule.
