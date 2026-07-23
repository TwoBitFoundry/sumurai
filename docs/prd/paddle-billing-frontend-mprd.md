# Paddle Billing Frontend UI — MPRD

Status: Reviewed, ready for implementation
Owner: Kody Buss
Last updated: 2026-07-22

## Context

PR #176 shipped production Paddle billing on the backend — entitlement gates
(402 `PAID_ACCESS_REQUIRED`), webhook-driven `billing_entitlements`, and
endpoints (`GET /api/billing/status`, `POST /api/billing/checkout`,
`/trials/start`, `/payment-method`, `/portal-session`, `/webhooks/paddle`) —
but the frontend billing surface was deliberately removed and deferred
(`docs/ARCHITECTURE.md:124`). This work builds that frontend:

- A post-signin **pricing / plan-selection page shown in ALL environments**
  during onboarding. The card set varies by environment:
  - **Billing disabled (self-hosted / dev / OSS)**: **Demo mode** and
    **Self Hosted**.
  - **Billing enabled (docker compose production)**: **Demo mode**,
    **Free trial** (when `trials_enabled`), and **Premium — $8/mo**.
- Choosing **Demo mode** → **straight to dashboard** (skips provider picker) —
  in every environment.
- Choosing **Self Hosted** (billing disabled) → the existing
  **choose-provider page** (`OnboardingProviderPicker`).
- Choosing **Premium** → Paddle.js **overlay** checkout (not hosted redirect)
  → webhook activation → choose-provider page. Choosing **Free trial** →
  card-less trial start → choose-provider page.
- The **"Try demo mode" button is removed from the provider picker** — the
  demo choice now lives exclusively on the pricing page.
- A **Plan section in Settings** offering the environment's upgrade paths:
  - Billing disabled: **demo → Self Hosted** (exit demo by connecting real
    data via the existing Accounts flow).
  - Billing enabled: **demo → free trial** (when `trials_enabled`),
    **demo → premium**, and **free trial → premium** (add payment method;
    trial converts to paid at trial end).
- Premium-gated actions (server 402) → **upgrade modal** with a CTA that
  navigates to the Settings Plan section.
- **In-app cancel membership** (cancel-at-period-end via a new backend
  endpoint); user keeps access until the period ends, UI shows
  "Membership ends \<date\>".

Billing-specific behavior (checkout, trial, upgrade, cancel, 402 modal) is
enforced at **runtime**: `billing_enabled` from `GET /api/billing/status` is
true only when `BILLING_MODE=paddle`, which is set solely in
`docker-compose.prod.yml`. No build-time flag needed. The pricing page itself
appears in all environments; only its card set is environment-dependent.

## Confirmed decisions

- **Pricing page is a universal onboarding step** (all environments). Cards:
  billing disabled → Demo mode + Self Hosted; billing enabled → Demo mode +
  Free trial (when `trials_enabled`) + Premium.
- **Remove the "Try demo mode" hero button from the provider picker**
  (`OnboardingProviderPicker.tsx:169-179` / `activateDemoAndExit` :70-78);
  demo activation moves to the pricing page.
- Paddle.js **overlay** checkout, opened by `transactionId` from the existing
  checkout endpoint (user decision over hosted redirect).
- **In-app cancel** with `effective_from=next_billing_period` (user decision
  over Paddle-hosted portal cancel).
- **Free-trial card on the pricing page** when `trials_enabled` (card-less
  trial via `POST /api/billing/trials/start`, which requires
  `{country_code, postal_code}`). Ops note: for the trial card to appear in
  production, the deployment must set `BILLING_TRIALS_ENABLED=true` **and**
  `PADDLE_CARDLESS_TRIAL_PRICE_ID` (compose default stays `false`; flipping
  the default would break deploys that lack the trial price ID, since config
  parsing requires it when trials are enabled).
- Price label "$8/mo" is **hardcoded in the UI**; the actual price lives in the
  Paddle price configuration.
- Client token exposed via `BillingStatusResponse` (no new config endpoint) —
  one authed fetch drives both routing and Paddle.js init; Paddle client-side
  tokens are public-by-design.
- `PADDLE_ENVIRONMENT` is validated as `sandbox|production`. Paddle.js receives
  `environment: 'sandbox'` only for sandbox; production relies on Paddle's
  production default.
- `BillingStatusResponse.is_demo_mode_active` is truthful in every environment.
  The billing-disabled branch loads the authenticated user instead of returning
  a hardcoded `false`, so Settings does not need demo state threaded through the
  app tree separately.
- **Settings upgrade-path matrix** (the Settings section renders in every
  environment for demo users, not just production):
  - demo → Self Hosted (billing disabled): CTA navigates to the Accounts tab;
    connecting a real provider runs the existing `DemoExitWarningModal` flow —
    no new backend work.
  - demo → free trial (billing enabled, `trials_enabled`): trial start form
    (country + postal), 409 `TRIAL_ALREADY_USED` surfaced if the user already
    consumed their trial.
  - demo → premium (billing enabled): overlay checkout.
  - free trial → premium: "Upgrade to Premium" = add payment method via the
    existing `POST /api/billing/payment-method` transaction + overlay; the
    card-less trial converts to paid at trial end (standard Paddle flow) — no
    new backend endpoint.
- In billing-enabled environments, entitlement status determines the displayed
  billing plan before demo-data state. A trialing or active user may still have
  `is_demo_mode_active=true` until they connect real data; Settings must still
  show Free trial or Premium management, not the demo upgrade choices.
- Only one Paddle overlay workflow may be active at a time. SDK events are
  correlated to the active transaction, and a trailing `checkout.closed` event
  cannot regress a completed checkout back to idle.

## Assumptions & Key Facts (verified against code)

Backend:
- `access_status` values: `unrestricted|demo|trialing|active|past_due|paused|canceled|expired`;
  `can_use_own_data` true only for unrestricted/trialing/active
  (`backend/src/services/billing_service.rs:96-145`).
- A user with **no entitlement row projects to `demo`**
  (`project_local_access_status`, `billing_service.rs:135-145`) — so fresh
  signups get the pricing page.
- Checkout endpoint already returns `{checkout_url, transaction_id}`
  (`backend/src/handlers/billing.rs`); overlay opens by `transactionId`.
- Entitlement gate failure: HTTP **402**, body
  `{error, message, code: "PAID_ACCESS_REQUIRED", details}`
  (`backend/src/middleware/entitlement.rs:9-16`, `models/api_error.rs:8-15`).
- Webhook processing (`billing_service.rs:364-444`) is the entitlement source
  of truth; `parse_subscription_data` (591-636) does **not** yet read Paddle
  `scheduled_change`. Out-of-order protection: `should_apply_event` (147-154)
  compares `last_event_at`.
- Billing error responses (`handlers/billing.rs:87-118`): 404 `BILLING_DISABLED`,
  409 `BILLING_ENTITLEMENT_UNAVAILABLE`, 409 `TRIAL_ALREADY_USED`,
  429 `RATE_LIMITED`, 502 `PADDLE_REQUEST_FAILED`.
- Paddle env lives only in `docker-compose.prod.yml:32-40`; `.env.example:33-41`
  documents vars; there is no client-side token var yet. **Never touch actual
  `.env` files.**
- OpenAPI regen: ignored test `regenerate_openapi_artifacts`
  (`backend/src/tests/openapi_tests.rs:388-394`) writes `docs/OPENAPI.json`.

Frontend (Next.js App Router, static export in prod, custom state-machine
routing — NO react-router):
- App routing precedence in `frontend/src/App.tsx`: `isLoading` (276) →
  `!isAuthenticated` (294) → `showOnboarding` (329, renders
  `OnboardingProviderPicker`) → `AuthenticatedApp` (335).
  `applyAuthenticatedSession` (69-86) sets
  `showOnboarding = !onboarding_completed` and `demoModeActive`.
- Existing error→modal pattern: `ApiClient` dispatches
  `sumurai:enrollment-required` on coded 403 (`ApiClient.ts:151-157, 228-234`);
  `App.tsx:115-119` listens.
- `FetchHttpClient.createApiError` (132-153) has **no 402 case**; body `code`
  extraction already exists at 124-130.
- `ConflictError` currently hardcodes `code='CONFLICT'`; preserving the backend
  code is required for `TRIAL_ALREADY_USED` handling.
- Tab navigation pattern: `NAVIGATE_TO_TRANSACTIONS_EVENT` in
  `frontend/src/utils/events.ts` + listener in `AuthenticatedApp.tsx:130-146`.
- Demo activation: `AuthService.activateDemoModeOnboarding()`
  (`POST /auth/onboarding/demo`, `authService.ts:110-112`).
- Provider picker demo button: passed as the optional `heroAction` prop into
  `ProviderSelectionPanel` (`OnboardingProviderPicker.tsx:169-179`); existing
  tests referencing it live in
  `frontend/tests/components/onboarding/OnboardingProviderPicker.test.tsx` and
  `frontend/tests/features/plaid/components/ProviderSelectionPanel.test.tsx`.
  Keep the `heroAction` prop itself (it has other uses/fallback); only stop
  passing the demo button from `OnboardingProviderPicker`.
- Onboarding completion handler: `handleOnboardingComplete` (`App.tsx:242-246`)
  sets `showOnboarding=false`, resets tab to dashboard, bumps `mainAppKey`.
- Settings sections are stacked `GlassCard`s in
  `frontend/src/views/SettingsPage.tsx`; feature-section pattern is
  `frontend/src/features/settings/PasskeySecuritySection.tsx` (+ View split).
  Delete-account confirm modal exemplar at `SettingsPage.tsx:140-208`.
- Modal exemplar: `frontend/src/features/demo/DemoExitWarningModal.tsx`.
  Pricing-card grid exemplar:
  `frontend/src/features/plaid/components/ProviderSelectionPanel.tsx` +
  `ProviderSelectionCard.tsx`.
- Services are static classes wrapping `ApiClient` (see `SettingsService.ts`);
  types live flat in `frontend/src/types/api.ts` (auth types 386-422).
- react-query is app-wide; `queryClient.clear()` on logout (App.tsx:219-240)
  wipes cached billing state automatically.
- Paddle.js (`@paddle/paddle-js`): `initializePaddle({token, environment,
  eventCallback})` → `Promise<Paddle|undefined>`; `paddle.Checkout.open({
  transactionId, settings: {displayMode: 'overlay'}})`; events
  `CHECKOUT_COMPLETED / CHECKOUT_CLOSED / CHECKOUT_ERROR` via
  `CheckoutEventNames`. `eventCallback` is fixed at init → use a mutable
  current-handlers ref.
- Both nginx templates currently allow Plaid but not Paddle in their Content
  Security Policy. Paddle.js and its overlay will be blocked until the Paddle
  script, frame, and connection origins are added.

## Risks

- **Webhook latency**: entitlement flips only when the webhook lands. Mitigate
  with 2s polling / ~120s cap / "Payment received — finishing setup…" + retry.
- **Wrong polling target**: a trialing user is already `trialing` before adding
  a payment method. Each workflow needs its own completion predicate: Premium
  checkout → `active`; card-less trial → `trialing`; trial payment method →
  `trialing && !payment_method_required` or `active`; past-due recovery →
  `active`.
- **Stale async work**: timers and Paddle callbacks can outlive a component or
  session. Polling must be single-flight, cancellable on unmount/logout, and
  unable to write query data after cancellation.
- **Optimistic cancel vs webhook ordering**: the in-app cancel write must NOT
  bump `last_event_at`, or `should_apply_event` could reject the authoritative
  `subscription.updated` webhook.
- **Un-cancel drift**: deriving `scheduled_cancel_at = None` when
  `scheduled_change` is null/non-cancel makes the webhook upsert auto-clear a
  Paddle-side un-cancel — rely on that rather than special-casing.
- **Fail-open routing**: if the billing status fetch fails, render the pricing
  page in its billing-disabled variant (Demo mode + Self Hosted). In
  production that lets a user reach the provider picker without paying, but
  own-data writes remain server-gated (402 → upgrade modal), so nothing is
  bypassed and the flow self-heals.
- **Demo user upgrading**: stays `is_demo_mode_active=true` until they connect
  real data via the existing Accounts `DemoExitWarningModal` flow; the
  `check_own_data_access_after_demo` gate permits demo writes throughout.
- **Production CSP**: both nginx templates must permit the vendor-scoped Paddle
  origins needed by the CDN-loaded SDK and overlay while preserving the rest of
  the existing policy.
- **Paddle account prerequisites**: overlay checkout requires an approved
  checkout domain/default payment link, and in-app cancel requires an API key
  with `subscription.write`. Document and verify these before treating an
  integration failure as an application defect.
- **Manual-test secrets**: never put Paddle credentials in a repository file.
  Billing-enabled local verification uses user-supplied shell variables and an
  explicitly referenced temporary Compose override outside the worktree.
- Cursorless static export: all `NEXT_PUBLIC_*` are build-frozen — this design
  deliberately avoids any new build-time flag.

---

## Implementation readiness review

The plan is comfortable to execute work-package by work-package after the
revisions below. Each package has one primary risk boundary and can be reviewed
and verified without depending on unfinished UI from a later package.

| Work package | Verdict | Why it is bounded |
|---|---|---|
| 1. Runtime billing contract | Comfortable | Config validation, truthful status data, and deployment wiring form one backend contract. |
| 2. Scheduled-cancel persistence | Comfortable | Additive nullable schema change plus webhook projection and status exposure. |
| 3. Cancel endpoint | Comfortable | Provider, service, narrow repository update, and handler cover one operation. |
| 4. Backend contract publication | Comfortable | OpenAPI and backend docs are updated only after the API shape settles. |
| 5. Frontend transport contract | Comfortable | Typed errors, API types, and service calls are testable without rendering UI. |
| 6. Paddle runtime boundary and CSP | Comfortable | SDK lifecycle and deployment browser policy are verified together. |
| 7. Billing workflow orchestration | Comfortable | Polling and state transitions are isolated from presentation and routing. |
| 8. Pricing screen | Comfortable | A presentational workflow consumes mocked billing actions and status. |
| 9. Onboarding routing | Comfortable | App precedence and provider-picker cleanup are isolated from pricing visuals. |
| 10. Global paid-access recovery | Comfortable | One typed 402 event, one modal, and one navigation path. |
| 11. Settings plan policy and view | Comfortable | Pure policy precedence and rendered states land before network mutations. |
| 12. Settings billing actions | Comfortable | Payment-method, cancel, and portal mutations integrate into the stable view. |
| 13. Verification and docs | Comfortable | Full automation and secret-safe manual proof remain a release gate. |

## Phase 1 — Backend: runtime billing contract

**Goal**: The authenticated billing status response carries everything the
frontend needs to initialize Paddle.js (client token + environment), sourced
from a new required-when-enabled env var, and reports demo state accurately in
every environment.

### Tasks
- `backend/src/config.rs`: add `client_token: String` to `PaddleBillingConfig`;
  parse `PADDLE_CLIENT_TOKEN` via `parse_required_trimmed` in
  `parse_paddle_billing_config` (180-209). Validate `PADDLE_ENVIRONMENT` as
  exactly `sandbox|production` instead of silently treating any non-production
  value as sandbox.
- `backend/src/models/billing.rs` `BillingStatusResponse` (46-58): add
  `paddle_client_token: Option<String>`, `paddle_environment: Option<String>`.
- `backend/src/handlers/billing.rs` status handler: `None`s in the disabled
  branch (~136); fill from `state.config.paddle_billing()` in the enabled
  branch (~183). Load the authenticated user in both branches and return the
  actual `is_demo_mode_active` value when billing is disabled.
- `docker-compose.prod.yml` backend env (after line 39):
  `PADDLE_CLIENT_TOKEN: ${PADDLE_CLIENT_TOKEN:?PADDLE_CLIENT_TOKEN is required}`.
- Document in `.env.example` (33-41 block, commented) and
  `docs/PRODUCTION_BILLING.md` (config table row).

### Acceptance criteria
- [x] Config tests cover `PADDLE_CLIENT_TOKEN` parse + missing-var error when
      `BILLING_MODE=paddle` (HashMap `EnvironmentProvider` pattern in
      `config.rs` test module).
- [x] Config tests reject unsupported `PADDLE_ENVIRONMENT` values and retain
      the existing sandbox/production behavior.
- [x] `GET /api/billing/status` returns `paddle_client_token` +
      `paddle_environment` when billing enabled; both `null` when disabled
      (asserted in `backend/src/tests/billing_api_tests.rs`).
- [x] Billing-disabled status returns the authenticated user's real demo-mode
      state.
- [x] `cargo test -p sumurai-backend --locked` green.

### TDD log

- Red: extended configuration and authenticated status boundary tests for the
  required client token, validated Paddle environment, public SDK fields, and
  truthful disabled-mode demo state.
- Green/refactor: added the runtime configuration fields and validation,
  consolidated authenticated user loading, and wired Compose and operator
  documentation.
- Verification: `cargo test -p sumurai-backend --locked` — 760 passed, 1
  ignored.

## Phase 2 — Backend: scheduled-cancel visibility

**Goal**: `scheduled_cancel_at` is persisted from Paddle `scheduled_change`
webhooks and exposed in the billing status so the UI can show
"Membership ends \<date\>" (and auto-clear on un-cancel).

### Tasks
- `backend/entity/src/billing_entitlements.rs`: add nullable
  `scheduled_cancel_at: Option<DateTimeWithTimeZone>` (schema source of truth
  first, per CONTRIBUTING.md).
- New forward-only migration
  `backend/migration/src/m20260722_000009_billing_scheduled_cancel_at.rs`
  (register in `migration/src/lib.rs`): use SeaORM `Table::alter`/
  `ColumnDef` builders to add nullable `scheduled_cancel_at timestamptz`; `down`
  drops it. Apply through Compose and confirm regenerated entity output matches
  the hand-updated entity, per `CONTRIBUTING.md`.
- `backend/src/models/billing.rs`: add field to `BillingEntitlement` (17-31)
  and `BillingStatusResponse`.
- `backend/src/services/billing_service.rs`:
  - `ParsedSubscriptionData` (537-545) + `parse_subscription_data` (591-636):
    read `scheduled_change` — only when `action == "cancel"`, take
    `effective_at`. Yields `None` when null/non-cancel so the webhook upsert
    auto-clears on un-cancel.
  - `apply_subscription_entitlement` (446-490): copy into the entitlement row.
- `backend/src/services/repository_service.rs`: include the column in
  `upsert_billing_entitlement` (3944-3988, add to `update_columns`) and
  `get_billing_entitlement` (3990-4017).
- Status handler: expose `scheduled_cancel_at`.

### Acceptance criteria
- [x] `billing_service_tests.rs`: webhook with
      `scheduled_change{action:"cancel", effective_at}` persists
      `scheduled_cancel_at`; follow-up webhook with `scheduled_change: null`
      clears it.
- [x] Migration applies cleanly on a fresh DB (`billing_schema_tests.rs` /
      schema assertions updated if present) and upgrades a database containing
      the existing billing table without a backfill or table rewrite.
- [x] Status response includes `scheduled_cancel_at` (null when absent).
- [x] Repository round-trip coverage proves the tenant-scoped read/write maps
      `scheduled_cancel_at` correctly.

### TDD log

- Red: added webhook set/clear, status serialization, tenant-scoped repository
  round-trip, and additive migration source assertions.
- Green/refactor: added the entity and nullable migration, projected Paddle
  `scheduled_change`, persisted it through the repository, and exposed it in
  authenticated billing status.
- Verification: `cargo test -p sumurai-backend --locked` — 763 passed, 1
  ignored. The running dev Compose database recorded the migration with a
  nullable `timestamptz` and no default; SeaORM regeneration matched the entity
  source exactly.

## Phase 3 — Backend: in-app cancel endpoint

**Goal**: `POST /api/billing/subscription/cancel` schedules a Paddle
cancel-at-period-end for the caller's subscription and optimistically records
`scheduled_cancel_at`, without perturbing webhook ordering.

### Tasks
- `backend/src/providers/paddle_provider.rs`: new types
  `CancelSubscriptionRequest { subscription_id }`,
  `CancelSubscriptionResponse { status, scheduled_cancel_at, canceled_at }`;
  trait method on `PaddleHttpClient` (automocked)
  `async fn cancel_subscription(&self, request) -> Result<CancelSubscriptionResponse>`.
  `PaddleClient` impl: `POST {base}/subscriptions/{id}/cancel` body
  `{"effective_from": "next_billing_period"}`; parse `data.status`,
  `data.scheduled_change.effective_at` (only when `action == "cancel"`),
  `data.canceled_at`. `NoOpPaddleClient` → `Err("Paddle billing is disabled")`.
- `backend/src/services/repository_service.rs`: narrow trait method
  `set_billing_entitlement_scheduled_cancel(user_id, Option<DateTime<Utc>>)`
  updating only that column + `updated_at` via `with_tenant` — must NOT bump
  `last_event_at`.
- `backend/src/services/billing_service.rs`:
  `cancel_subscription_at_period_end(&self, user) ->
  Result<CancelSubscriptionOutcome, BillingServiceError>` — gate
  `is_billing_enabled` → `BillingDisabled`; require entitlement with
  `paddle_subscription_id` (else `EntitlementUnavailable`). If a local
  `scheduled_cancel_at` already exists, return it without another Paddle call.
  Otherwise call Paddle (`PaddleRequestFailed` on error); a success response
  without a cancel `scheduled_change.effective_at` is also a provider failure,
  not a successful response with a null date. Persist via the narrow repo
  method. `CancelSubscriptionOutcome { scheduled_cancel_at }`.
- `backend/src/models/billing.rs`:
  `BillingCancelResponse { status: String, scheduled_cancel_at }`, with the
  handler returning the literal status `scheduled`.
- `backend/src/handlers/billing.rs`: handler `cancel_billing_subscription` with
  `#[utoipa::path]` (200/401/404 disabled/409 no subscription/502); errors via
  existing `billing_service_error_response` (87-118); register
  `.route("/api/billing/subscription/cancel", post(...))` in
  `billing_authenticated_routes()` (30-43).

### Acceptance criteria
- [x] `billing_api_tests.rs`: cancel happy path (mock entitlement +
      `MockPaddleHttpClient::expect_cancel_subscription`, assert 200 +
      `scheduled_cancel_at` persisted); disabled → 404; no subscription → 409;
      Paddle failure → 502.
- [x] `billing_service_tests.rs`: optimistic cancel does NOT bump
      `last_event_at` (webhook ordering intact); an already-scheduled cancel is
      idempotent; malformed Paddle success data is rejected.
- [x] `paddle_provider_tests.rs`: wiremock-style test
      (`PaddleClient::new_for_test`) asserting request path/body
      `effective_from=next_billing_period` and response parse.

### TDD log

- Red: added provider-wire, service, repository SQL-shape, and authenticated
  API boundary tests for successful, idempotent, disabled, unavailable, and
  provider-failure outcomes.
- Green/refactor: implemented Paddle cancel-at-period-end transport, a narrow
  tenant-scoped schedule update that leaves webhook ordering untouched, and
  the authenticated cancellation endpoint.
- Verification: `cargo test -p sumurai-backend --locked` — 772 passed, 1
  ignored.

## Phase 4 — Backend: contract publication

**Goal**: The new endpoint/schema are part of the generated OpenAPI artifacts
and the billing docs reflect reality.

### Tasks
- `backend/src/openapi/mod.rs`: add `BillingCancelResponse` schema (~86-90) and
  `cancel_billing_subscription` path (~163-168).
- Regenerate:
  `cargo test -p sumurai-backend --locked regenerate_openapi_artifacts -- --ignored`
  → commit `docs/OPENAPI.json`.
- Update `docs/PRODUCTION_BILLING.md` (cancel endpoint, client token,
  environment validation, approved checkout domain/default payment link, and
  Paddle API-key permissions including `subscription.write`) — the
  "UI deferred" notes in `docs/ARCHITECTURE.md:124` / `PRODUCTION_BILLING.md`
  are removed in Phase 13 when the UI actually exists.

### Acceptance criteria
- [x] `openapi_tests.rs` billing endpoints/schemas assertion (line ~75) extended
      with the new path, schema, and new billing-status fields; suite green.
- [x] `docs/OPENAPI.json` contains `/api/billing/subscription/cancel`.
- [x] `bun run backend:ci` green before frontend work consumes the contract.

### TDD log

- Red: extended the generated-contract boundary test with the cancellation
  path and response schema plus all new billing-status fields; it failed on the
  absent route.
- Green/refactor: registered the endpoint and schema, regenerated the checked-in
  OpenAPI artifact, and documented environment validation, checkout account
  prerequisites, client-token scope, and cancellation API-key permissions.
- Verification: focused OpenAPI test and artifact regeneration passed;
  `bun run backend:ci` passed with 772 backend tests, 1 ignored, 4 CLI tests,
  and 8 development-seed tests.

## Phase 5 — Frontend: transport contract, types, and service

**Goal**: Billing errors and responses are precise TypeScript contracts, and
all billing API calls go through a mockable service boundary.

### Tasks
- `frontend/src/services/boundaries/errors.ts`: `PaymentRequiredError extends
  ApiError` (status 402, preserves `code`, optional body); export from the
  boundaries barrel.
- `FetchHttpClient.ts` `createApiError` switch (132-153): `case 402: return new
  PaymentRequiredError(errorMessage, errorCode ?? 'PAYMENT_REQUIRED',
  errorData)` — errorCode extraction at 124-130 already preserves
  `PAID_ACCESS_REQUIRED`.
- Update `ConflictError` and its `FetchHttpClient` mapping to preserve the
  backend `code` while retaining the parsed response body. This makes
  `TRIAL_ALREADY_USED` a first-class error instead of requiring unsafe body
  inspection.
- `frontend/src/types/api.ts` (near auth types 386-422): `BillingAccessStatus`
  union (`'unrestricted'|'demo'|'trialing'|'active'|'past_due'|'paused'|'canceled'|'expired'`),
  `PaddleEnvironment = 'sandbox'|'production'`, and a discriminated
  `BillingStatusResponse` union. The enabled member requires a client token and
  environment; the disabled member requires both to be `null`. Include
  `scheduled_cancel_at`, checkout/trial/cancel/portal response types, and the
  trial-start request.
- New `frontend/src/services/BillingService.ts` (static-class pattern like
  `SettingsService.ts`): `getStatus` GET `/billing/status`; `createCheckout`
  POST `/billing/checkout`; `startTrial` POST `/billing/trials/start`;
  `createPaymentMethodTransaction` POST `/billing/payment-method`;
  `createPortalSession` POST `/billing/portal-session`; `cancelSubscription`
  POST `/billing/subscription/cancel`.
- New `frontend/src/features/billing/useBillingStatus.ts`:
  `BILLING_STATUS_QUERY_KEY = ['billing','status']`, react-query wrapper over
  `BillingService.getStatus`, `{enabled}` option, `staleTime: 60_000`, and a
  shared disabled fallback factory used only after a real query error.

### Acceptance criteria
- [x] `frontend/tests/**` `FetchHttpClient` test: 402 →
      `PaymentRequiredError` preserving `PAID_ACCESS_REQUIRED`.
- [x] `FetchHttpClient` test: 409 preserves `TRIAL_ALREADY_USED` and its body.
- [x] `BillingService` test: endpoint paths/verbs (mirror
      `SettingsService.test.ts`).
- [x] Billing-status tests cover enabled, disabled, and query-error fallback
      shapes without converting a pending query into the fallback.
- [x] Focused service/transport tests, lint, and typecheck green.

### TDD log

- Red: added transport mapping, six-endpoint service, and query-state boundary
  tests; they failed on the absent typed errors, service, and status hook.
- Green/refactor: introduced discriminated billing contracts, preserved coded
  402/409 response bodies, centralized billing API calls, and added a cached
  status query whose disabled fallback is applied only after failure.
- Verification: 22 focused tests passed; frontend lint and typecheck passed;
  the complete frontend unit suite passed with 1,347 tests.

## Phase 6 — Frontend: Paddle runtime boundary and CSP

**Goal**: Paddle.js initializes once, routes events only to the active overlay
transaction, and can load through the production nginx security policy.

### Tasks
- Add `@paddle/paddle-js` with Bun, then run Bun's package update command for
  that dependency so the lockfile resolves the latest compatible release.
- Add `frontend/src/features/billing/paddleClient.ts` as the only direct SDK
  boundary. Memoize the initialization promise, keep mutable active-session
  handlers behind the fixed `eventCallback`, and expose
  `openOverlayCheckout({token, environment, transactionId, handlers})`.
  Reuse initialization only for the same token/environment and reject a
  conflicting configuration because Paddle supports one initialization per
  page.
- Pass `environment: 'sandbox'` only for sandbox and omit the SDK environment
  for production. Open by `transactionId` with overlay display mode.
- Correlate `checkout.completed` and `checkout.closed` payloads to the active
  transaction ID. Clear handlers after terminal events, ignore late events,
  prevent concurrent overlays, and report initialization/open failures through
  the boundary result.
- Extend `script-src`, `frame-src`, and `connect-src` in both
  `nginx/nginx.conf.template` and `nginx/nginx.slim.conf.template` with the
  vendor-scoped Paddle origins required by the CDN-loaded SDK and overlay. The
  minimum allowlist is `https://cdn.paddle.com` for scripts and
  `https://*.paddle.com` for frames/connections. Add another origin only when
  supported by current Paddle documentation or observed sandbox runtime
  evidence; do not broaden a directive to all HTTPS. Preserve every existing
  Plaid, SimpleFIN, and self origin.
- Extend the nginx policy assertions in `backend/src/tests/config_tests.rs` so
  the full and slim templates cannot drift.

### Acceptance criteria
- [x] Boundary tests prove one SDK initialization, sandbox/production mapping,
      transaction-correlated completed/closed/error events, concurrent-open
      rejection, and late-event cleanup.
- [x] A completed checkout followed by `checkout.closed` remains completed.
- [x] Both nginx templates retain their existing CSP sources and allow Paddle's
      SDK, overlay frame, and browser connections.
- [x] Static frontend build and nginx config validation are green.

### TDD log

- Red: added SDK lifecycle/event and dual-template CSP boundary tests; they
  failed on the absent Paddle boundary and vendor allowlist.
- Green/refactor: added and updated `@paddle/paddle-js`, isolated its mutable
  lifecycle behind one callback, enforced one active transaction and one SDK
  configuration, and extended both nginx policies without broad HTTPS access.
- Verification: 6 Paddle boundary tests, frontend lint/typecheck/static build,
  and the nginx policy configuration test passed.

## Phase 7 — Frontend: billing workflow orchestration

**Goal**: Checkout, trial, and payment-method workflows share a deterministic,
cancellable state machine without coupling timers to UI components.

### Tasks
- Add a billing workflow hook/service with states
  `idle|creating|checkout_open|waiting_activation|activated|timeout|error` and
  one active run at a time.
- Support named completion targets rather than a broad paid-status check:
  - Premium checkout: `access_status === 'active'`.
  - Card-less trial: `access_status === 'trialing'`.
  - Trial payment method: `access_status === 'active'` or
    (`access_status === 'trialing' && !payment_method_required`).
  - Past-due recovery: `access_status === 'active'`.
- For overlay workflows, create the server transaction, open Paddle by
  transaction ID, and begin 2-second status polling only after the matching
  `checkout.completed` event. Card-less trial starts polling after the API
  returns. Write each successful poll into `BILLING_STATUS_QUERY_KEY`.
- Cap polling at about 120 seconds. Preserve a timeout state with retry rather
  than treating payment as failed. Keep 409 `TRIAL_ALREADY_USED`, 429, SDK, and
  network failures distinguishable for presentation.
- Cancel timers and ignore callbacks/cache writes after unmount, logout, or a
  superseding run. Closing before completion returns to idle; closing after
  completion does not interrupt activation polling.

### Acceptance criteria
- [x] Deterministic fake-timer tests cover every completion target, timeout and
      retry, abandoned close, close-after-complete, and error mapping.
- [x] A trialing user adding a payment method does not activate immediately
      merely because the starting status is already `trialing`.
- [x] Unmount/logout during polling leaves no timer and performs no later cache
      write or callback.
- [x] Focused hook tests, lint, and typecheck green.

### TDD log

- Red: added deterministic controller and hook tests for all completion
  targets, terminal ordering, timeout/retry, error kinds, supersession,
  cancellation, cache writes, and unmount cleanup.
- Green/refactor: separated the workflow controller from its React adapter,
  added exact target predicates and 2-second bounded polling, and connected
  successful status reads to the shared query key.
- Verification: 20 focused billing tests, frontend lint/typecheck, and the
  complete 1,362-test frontend unit suite passed.

## Phase 8 — Frontend: PricingScreen

**Goal**: A design-system-compliant pricing screen renders every environment
and billing workflow state through explicit props and mocked boundaries.

### Tasks
- New `frontend/src/features/billing/PricingScreen.tsx`:
  - Props `{ billingStatus, onDemoActivated, onContinueToProviders, onLogout }`
    — `onContinueToProviders` fires for Self Hosted selection AND after
    Premium/trial activation, unifying the "proceed to provider picker" exit.
  - Shell mirrors `OnboardingProviderPicker.tsx` (GradientShell +
    `AppTitleBar state="onboarding"` + `appLayout.contentShellWithGutter`).
  - Card grid styled after `ProviderSelectionPanel`/`ProviderSelectionCard`
    using `GlassCard` + `Button`. Card set by `billingStatus.billing_enabled`:
    - **Disabled (self-hosted/dev)**: **Demo mode** (secondary →
      `AuthService.activateDemoModeOnboarding()` → `onDemoActivated()`) and
      **Self Hosted** (primary → `onContinueToProviders()`; copy: free, your
      own data on your own infrastructure).
    - **Enabled (production)**: **Demo mode** (same), **Free trial** (only
      when `trials_enabled`; reveals country-code + postal-code `Input`s →
      `startTrial`), **Premium — $8/mo** (primary → `startCheckout`).
  - Render checkout phases (spinner during `waiting_activation`, timeout
    retry, validation, demo-activation failure, and error `Alert`s). Normalize
    country code to two uppercase ASCII letters and require nonblank postal
    code before the trial request.
- Add `PricingScreen.stories.tsx` for disabled, enabled, enabled-with-trial,
  waiting, timeout, and error states. Keep interaction assertions in the
  Storybook Vitest project where browser rendering owns the behavior.

### Acceptance criteria
- [ ] PricingScreen tests: disabled variant shows Demo mode + Self Hosted
      only; enabled variant shows Demo mode + Premium, plus Free trial only
      when `trials_enabled`.
- [ ] Trial validation, loading/disabled controls, retry, callback outcomes,
      and error announcements are covered at the rendered component boundary.
- [ ] Storybook Vitest, focused Bun tests, design lint, and typecheck green.

## Phase 9 — Frontend: onboarding routing and provider-picker cleanup

**Goal**: Every onboarding-incomplete user sees pricing before providers;
demo completes onboarding directly, while Self Hosted and activated paid plans
continue to the provider picker.

### Tasks
- `frontend/src/App.tsx`: add `useBillingStatus({ enabled: isAuthenticated })`
  and a `pricingComplete` boolean state; expand the `showOnboarding` block:
  - Billing query pending → existing loading shell.
  - Show `<PricingScreen>` while pricing is incomplete unless billing is
    enabled and `can_use_own_data` is already true. Paid users refreshing
    between checkout and provider selection therefore resume at providers.
  - A query error uses the explicit billing-disabled fallback status. It must
    not expose paid CTAs without a client token.
  - Demo activation sets local demo state and calls the existing onboarding
    completion path; Self Hosted or successful billing sets
    `pricingComplete=true` and falls through to providers.
  - Reset pricing state on logout and whenever a new authenticated session is
    applied. Replaying pricing after a full-page refresh in the self-hosted
    mid-flow case is accepted because no durable plan-selection record exists.
- Remove `activateDemoAndExit` and the demo `heroAction` from
  `OnboardingProviderPicker.tsx`. Keep the optional `heroAction` API on
  `ProviderSelectionPanel` because other consumers may use it.
- Update provider-picker tests while retaining the panel's independent
  `heroAction` coverage.

### Acceptance criteria
- [ ] `App.test.tsx` precedence coverage: pending status, enabled/disabled
      pricing, status-error fallback, paid mid-flow, logout/new-session reset,
      demo → dashboard, and Self Hosted/Premium/trial → providers.
- [ ] Demo mode calls `POST /auth/onboarding/demo` and never renders providers.
- [ ] Provider picker never renders "Try demo mode"; its generic panel action
      still works.
- [ ] Premium/trial activation reaches providers without a page reload.

## Phase 10 — Frontend: global paid-access recovery

**Goal**: Any coded 402 from an authenticated API call raises one accessible
upgrade modal whose CTA navigates to Settings.

### Tasks
- `frontend/src/utils/events.ts`: add `PAID_ACCESS_REQUIRED_EVENT`,
  `NAVIGATE_TO_SETTINGS_EVENT =
  'sumurai:navigate-to-settings'`, and their dispatchers. Add the Settings
  listener in `AuthenticatedApp.tsx` mirroring the transactions listener.
- `ApiClient.ts`: after the existing ForbiddenError dispatch blocks, dispatch
  `PAID_ACCESS_REQUIRED_EVENT` when a `PaymentRequiredError` has code
  `PAID_ACCESS_REQUIRED`, guarded for browser execution.
- New `frontend/src/features/billing/UpgradeRequiredModal.tsx` (mirrors
  `DemoExitWarningModal.tsx`: Modal + GlassCard + Alert + buttons). Primary CTA
  "View plans in Settings". Add a focused Storybook story for open, dismissal,
  and CTA behavior.
- `App.tsx`: `showUpgradeRequired` state + listener for
  `sumurai:paid-access-required` (mirrors 115-119); render modal in the
  authenticated branch (335-358); CTA closes modal +
  `dispatchNavigateToSettings()`.

### Acceptance criteria
- [ ] 402 from any authed call opens `UpgradeRequiredModal`; its CTA switches
      the tab to Settings.
- [ ] Repeated 402s while the modal is open do not stack dialogs; closing and
      reopening remains deterministic.
- [ ] Modal keyboard/focus behavior is covered through its Storybook story and
      Storybook Vitest interaction.

## Phase 11 — Frontend: Settings plan policy and view

**Goal**: Settings renders the correct plan, dates, alerts, and available
actions from a pure policy model before mutation logic is attached.

### Tasks
- Add `PlanSection.tsx`, `PlanSectionView.tsx`, and `planPolicy.ts` following
  the existing Settings container/view split. `PlanSection` owns the billing
  query; the view receives resolved state and callback props. Do not thread a
  second demo-mode prop through `AuthenticatedApp` because billing status is
  now truthful in every environment.
- Pure policy helpers cover plan label, renewal/end copy, cancel eligibility,
  payment-method need, and action resolution. In billing-enabled deployments,
  entitlement status has precedence over `is_demo_mode_active`:
  - `trialing` always renders Free trial management.
  - `active` always renders Premium management.
  - `past_due|paused|canceled|expired` render their recovery states.
  - Only billing status `demo` renders the production demo upgrade choices.
- Billing-disabled + demo renders Demo mode and Switch to Self Hosted.
  Billing-disabled + non-demo renders no Plan section.
- Billing-enabled demo exposes Premium and, only when enabled, Free trial.
  Trialing shows its end date and payment-method state. Active shows renewal or
  scheduled membership end. Past due shows an error alert. Paused, canceled,
  and expired show status/recovery copy. Portal availability controls Manage
  billing visibility.
- Render explicit loading, query-error with retry, empty, mutation-pending, and
  mutation-error slots. Use existing primitives and recipes; do not add a new
  design token unless an existing role cannot express the UI.
- Render `<PlanSection />` as its own Settings card between preferences and the
  danger card. Update `SettingsPage` tests, Storybook screen slices, and any
  direct Settings renderers affected by the new section.
- Add `PlanSectionView.stories.tsx` for the policy matrix and browser-owned
  interactions.

### Acceptance criteria
- [ ] `planPolicy` table tests cover disabled demo/non-demo; enabled demo with
      and without trials; trialing with and without payment method; active with
      and without scheduled cancel; past_due, paused, canceled, and expired.
- [ ] Tests prove trialing/active status wins when demo-data mode is still true.
- [ ] Date copy handles absent and invalid timestamps without displaying an
      invalid date.
- [ ] Plan section is absent only for billing-disabled non-demo users; a query
      failure shows retry UI rather than silently hiding the section.
- [ ] Storybook Vitest, focused Bun tests, design lint, and typecheck green.

## Phase 12 — Frontend: Settings billing actions

**Goal**: Stable Settings states gain trial, checkout, payment-method, cancel,
portal, and Accounts-navigation behavior with correct cache transitions.

### Tasks
- Add `NAVIGATE_TO_ACCOUNTS_EVENT = 'sumurai:navigate-to-accounts'`, its
  dispatcher, and the matching `AuthenticatedApp` listener.
- Switch to Self Hosted dispatches Accounts navigation; the existing
  `DemoExitWarningModal` remains the owner of replacing demo data.
- Production demo can start a card-less trial or open Premium checkout through
  the workflow targets from Phase 7. Surface `TRIAL_ALREADY_USED`, rate limit,
  SDK, and network errors without losing the current plan state.
- Trialing Upgrade to Premium creates the payment-method transaction and waits
  for the trial-payment-method completion target. Once
  `payment_method_required=false`, render the effective Premium-start copy.
- Past-due Update payment method uses the same transaction endpoint with the
  past-due recovery target (`active`), not the already-true trial predicate.
- Active without a scheduled cancel opens an accessible confirmation modal.
  On success, atomically update `scheduled_cancel_at` in the cached enabled
  status so the view flips to Membership ends immediately. Keep the prior cache
  on failure; repeated submissions are disabled and the backend remains
  idempotent. Active with a scheduled cancel exposes no cancel action.
- Paused/canceled/expired recovery uses the resolved upgrade action. Manage
  billing creates a portal session and opens `overview_url` in a new tab with
  `noopener` only after a successful response.
- Refetch billing status after successful mutations where the workflow did not
  already poll it, while preserving the optimistic cancel result until the
  authoritative response arrives.

### Acceptance criteria
- [ ] Switch to Self Hosted navigates to Accounts.
- [ ] Demo trial/Premium and trial/past-due payment-method tests use the correct
      completion targets.
- [ ] Confirmed cancel calls the API once and immediately renders Membership
      ends; cancel failure preserves the prior view and exposes retryable error.
- [ ] Portal success/failure and popup invocation are tested at the boundary.
- [ ] Plan-section rendered interactions pass Storybook Vitest; focused Bun
      tests, lint, and typecheck green.

## Phase 13 — Verification + docs cleanup

**Goal**: Full-suite green plus manual proof of every flow in both
billing-disabled and billing-enabled environments; docs reflect the shipped UI.

### Tasks
- Run focused checks during each package, then full parity:
  `bun run backend:ci && bun run frontend:ci`. The frontend command owns lint,
  typecheck, design guard, Bun tests, build, Storybook Vitest, static Storybook,
  and runtime smoke.
- Manual at `http://localhost:8080` (never `:3001`):
  - **Billing-disabled run (self-hosted/dev)**:
    `docker compose -f docker-compose.dev.yml up -d --build` — register →
    pricing page shows **Demo mode + Self Hosted only** (no Premium/trial);
    Self Hosted → provider picker (with **no** "Try demo mode" button);
    Demo mode → dashboard directly; as a demo user, Settings shows the Plan
    section with **Switch to Self Hosted** → Accounts tab → connecting a
    provider runs the demo-exit warning flow; as a non-demo user, Settings has
    no Plan section; no upgrade modals anywhere.
  - **Billing-enabled run**: the user supplies sandbox credentials as shell
    variables. Use a temporary Compose override outside the worktree that only
    references those variable names, and invoke it explicitly with both
    `-f docker-compose.dev.yml` and `-f /absolute/path/to/temporary-override`.
    Set the billing mode/environment, Paddle API, webhook, monthly price, and
    client-token variables, plus trial variables to exercise the trial card.
    Never create/read a repository `.env` or write credential values into the
    worktree. Point a public tunnel at `/api/billing/webhooks/paddle` for
    Paddle sandbox notifications. Confirm the sandbox has an approved/default
    checkout link and the API key has the documented transaction, customer,
    address, portal, and `subscription.write` permissions.
  - Exercise: register → pricing shows **Demo mode + Free trial + Premium**
    (no Self Hosted) → sandbox overlay checkout (4242 4242 4242 4242) →
    activation poll → provider picker; trial start → provider picker;
    Demo mode → dashboard; demo user triggers an own-data write → 402 upgrade
    modal → Settings; Settings demo → **Start free trial** works and demo →
    **Upgrade to Premium** works; trialing user's Settings → **Upgrade to
    Premium** opens the payment-method overlay and
    `payment_method_required` clears after the webhook without prematurely
    succeeding on the existing `trialing` status; Cancel → "Membership ends
    \<date\>" immediately and remains so after `subscription.updated`; with
    webhooks unreachable, validate timeout/retry and timer cleanup.
  - Confirm browser console/network output has no CSP violations for Paddle.js,
    its overlay, or Paddle connections in both nginx templates.
- Update `docs/ARCHITECTURE.md:124` + `docs/PRODUCTION_BILLING.md` to drop the
  "billing UI deferred" note and describe the new flow.

### Acceptance criteria
- [ ] `bun run backend:ci && bun run frontend:ci` green.
- [ ] Manual flows above verified and screenshotted in light and dark modes
      where visual.
- [ ] No Paddle CSP violations and no credential-bearing files in the worktree.
- [ ] Docs updated; no references left to "deferred" billing UI.

---

## Sequencing / next actions

Phases 1–4 settle and publish the backend contract. Phase 5 consumes that
contract; Phase 6 establishes the browser SDK boundary; Phase 7 builds reusable
workflow orchestration. Phase 8 can then land the pricing UI, followed by its
App integration in Phase 9. Phase 10 establishes global paid-access recovery.
Phases 11–12 build Settings policy first and mutations second. Phase 13 is the
release gate.

Implement in order unless working in parallel on non-overlapping files. Hand
off one work package at a time with boundary-focused tests in
`backend/src/tests/**` / `frontend/tests/**`, browser behavior in Storybook
Vitest, and no tests inline with source.
