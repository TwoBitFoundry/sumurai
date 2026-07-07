# MPRD - Production-Only Paddle Billing, Trials, And Hosted Access

Status: Approved, ready for implementation
Owner: Kody Buss
Last updated: 2026-07-06

## Context

Sumurai is becoming a paid, web-hosted service for users who want to use
their own financial data. Security and tenant isolation are paramount.

The default product experience stays demo mode. A user can explore the seeded
demo workspace without paying. In the production Docker Compose deployment
only, the user can upgrade to paid access for $8/month or redeem a Paddle
cardless trial code to use their own data.

Billing must never appear or gate behavior outside the production Docker Compose
environment. Development, OSS/self-host, local, and test deployments keep the
current behavior and do not show paid options.

This work must not collide with the existing in-app financial subscriptions
domain. The existing `subscription_detection` and `models/subscription.rs`
areas are about recurring spending in a user's transactions. Paddle billing is
SaaS entitlement and should use names like billing, entitlement, Paddle events,
and trial codes.

## Confirmed decisions

- **Production-only paid options.** Billing UI, Paddle checkout, trial-code
  redemption, payment-method prompts, customer portal links, and entitlement
  write gates apply only when the backend is explicitly configured by
  `docker-compose.prod.yml` for Paddle billing.
- **Never show billing outside production compose.** Non-production
  environments should not render billing cards, upgrade buttons, trial-code
  inputs, paid labels, payment-required locks, or payment-related empty states.
- **Billing disabled by default.** The backend config defaults to billing
  disabled. The only compose file that enables billing is
  `docker-compose.prod.yml`.
- **Production providers.** In production compose, hosted financial providers
  are limited to `diy` and `plaid`. Teller and SimpleFIN must not be returned
  in provider catalog responses or accepted by direct API calls in that mode.
- **Demo by default.** New accounts remain in demo mode. Demo exploration is
  available without payment.
- **Paid unlocks own data.** In production billing mode, users need a current
  Paddle-backed entitlement before connecting Plaid, creating a new DIY
  institution, importing their own data, syncing own data, or editing own-data
  resources after leaving demo mode.
- **Demo data is not paid data.** Demo-only exploration remains available
  without payment. If a user attempts to create or connect their own
  institution from demo mode without entitlement, return payment required and
  leave demo mode intact.
- **Entitlement source of truth.** Paddle is the source of truth for paid and
  trial subscription lifecycle. The app stores a local entitlement projection
  from verified webhooks for fast authorization.
- **Paddle cardless trials.** Trial codes create Paddle cardless trials. The
  app validates a Sumurai trial code first, then uses Paddle API workflows to
  create the customer/address/transaction. Access is granted from verified
  Paddle webhook fulfillment, not from the frontend.
- **Trial code semantics.** A trial code is single-use and has a redeem-by date.
  The code expiration controls whether it may be redeemed. The actual trial
  length comes from the configured Paddle cardless-trial price.
- **Trial billing details.** Trial redemption collects the existing account email
  plus country and postal code. No payment card is collected to start a cardless
  trial.
- **Expired access.** When paid/trial entitlement expires, is canceled, is
  paused, or is past due, keep user data tenant-isolated and available for
  read/export/disconnect/account deletion. Block own-data writes until access is
  restored.
- **No app admin UI in v1.** Trial-code creation is CLI/server-admin only, not a
  web admin surface.

## External Paddle constraints

- Cardless trials require a price with `trial_period.requires_payment_method =
  false`, and Paddle notes this feature is early access/developer preview.
- Cardless trials are created through the Paddle API, not Paddle Checkout. The
  server creates or reuses Paddle customer/address records, creates a
  transaction, and Paddle creates the subscription on completion.
- A customer and address are required for the transaction so Paddle can identify
  the customer, currency, and tax context.
- Webhook signature verification must use the exact raw request body, the
  `Paddle-Signature` header, HMAC-SHA256, timestamp tolerance, and timing-safe
  comparison before processing the event.
- Customer portal session links are Paddle-hosted, authenticated, temporary
  links. They must be generated on demand and not cached or embedded in an
  iframe.

References:
- https://developer.paddle.com/build/trials/cardless-trials/
- https://developer.paddle.com/webhooks/about/signature-verification/
- https://developer.paddle.com/api-reference/customer-portals/create-customer-portal-session/
- https://developer.paddle.com/api-reference/transactions/create-transaction/

## Assumptions

- `docker-compose.prod.yml` is the production Docker Compose environment.
- Paddle cardless trials are enabled for the Paddle account before this work is
  released.
- The production monthly paid price is $8/month and is represented by a Paddle
  price ID supplied through backend configuration.
- A separate Paddle price ID exists for cardless trials because Paddle cardless
  trial pricing is configured on the price.
- `.env` files are never read or written. Use `.env.example` and compose
  manifests as configuration references.
- If adding direct Rust dependencies for webhook HMAC verification or constant
  time comparison, add them with Cargo tools and then update with Cargo tools.

## Risks and mitigations

- **Billing leaks into non-production.** Mitigation: backend billing config
  defaults disabled, frontend hides billing when `billing_enabled` is false, and
  tests prove non-production does not render billing UI or enforce payment.
- **Frontend-only entitlement checks.** Mitigation: all own-data write gates are
  backend-enforced through shared entitlement guards.
- **Webhook spoofing or replay.** Mitigation: verify signature against raw body,
  reject stale timestamps, deduplicate Paddle event IDs, and process events
  idempotently.
- **Trial-code brute force or sharing.** Mitigation: store only keyed code hashes,
  use single-use redemption, rate limit redemption attempts, and do not reveal
  whether a code exists versus is expired/redeemed.
- **Tenant data leakage.** Mitigation: mirror existing RLS and
  `app.current_user_id` tenant context patterns for user-owned billing tables;
  add cross-tenant tests.
- **Paddle status drift.** Mitigation: store webhook event history and expose a
  service-level reconciliation path for a single user's Paddle subscription if
  status is stale.
- **Cardless trial early-access changes.** Mitigation: isolate Paddle-specific
  calls in a provider client and keep the app entitlement contract independent of
  Paddle response shape details.

Follow the `sumurai-backend-architecture`, `sumurai-testing-policy`,
`database-migrations-schema-evolution`, `authn-authz-architecture`, and
`sumurai-frontend-design-system` skills.

---

## Phase 1 - Billing mode and production provider policy

**Goal:** Add explicit production-only billing/provider configuration without
changing behavior in other environments.

**Tasks**
- Extend `backend/src/config.rs` with:
  - `BILLING_MODE` enum: `disabled` (default) or `paddle`.
  - `ENABLED_FINANCIAL_PROVIDERS` optional comma-separated allowlist.
  - Paddle config required only when `BILLING_MODE=paddle`:
    `PADDLE_ENVIRONMENT`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`,
    `PADDLE_MONTHLY_PRICE_ID`, `PADDLE_CARDLESS_TRIAL_PRICE_ID`.
- Set `BILLING_MODE=paddle` only in `docker-compose.prod.yml`.
- Set `ENABLED_FINANCIAL_PROVIDERS=diy,plaid` in `docker-compose.prod.yml`.
- Do not set billing mode in `docker-compose.yml` or `docker-compose.dev.yml`.
- Update provider catalog resolution so the allowlist is applied after registry
  availability and before response serialization.
- Add a shared provider-policy helper used by provider-info and direct provider
  action routes.
- Keep the existing dynamic provider registry behavior when no allowlist is set.
- Update `.env.example` with Paddle placeholders and comments, but do not read or
  write any `.env` file.

**Acceptance criteria**
- [x] In default config, billing is disabled and no Paddle settings are required.
- [x] `docker-compose.prod.yml` is the only compose file that enables Paddle
      billing.
- [x] Production provider catalog returns only registered providers that are also
      in `diy,plaid`.
- [x] Direct API attempts to select/connect/sync a provider outside the allowlist
      return `403 PROVIDER_DISABLED`.
- [x] Non-production provider behavior matches current behavior.
- [x] Config tests cover default disabled mode, missing Paddle config in Paddle
      mode, invalid provider allowlist values, and production allowlist parsing.

**TDD log**
- Red: `cargo test -p sumurai-backend --locked config_tests` failed before
  billing mode, Paddle config, provider allowlist parsing, and compose
  assertions existed.
- Red: `cargo test -p sumurai-backend --locked provider_selection_api_tests::given_provider_allowlist`
  failed before provider catalog, selection, connect, and sync routes enforced
  the allowlist.
- Green: `cargo test -p sumurai-backend --locked config_tests`.
- Green: `cargo test -p sumurai-backend --locked provider_selection_api_tests::given_provider_allowlist`.
- Verification: `cargo fmt -p sumurai-backend -p entity --check`.
- Verification: `cargo check --workspace --locked --all-targets`.
- Verification: `cargo clippy -p sumurai-backend -p entity --locked --all-targets --no-deps -- -D warnings`.
- Verification: `cargo test -p sumurai-backend --locked` passed 731 tests with
  1 ignored.

## Phase 2 - Billing schema, models, and repository contracts

**Goal:** Store Paddle identity, entitlement projection, trial-code state, and
webhook idempotency with tenant isolation.

**Tasks**
- Add forward-only migration under `backend/migration/src/` and register it in
  `backend/migration/src/lib.rs`.
- Create `billing_profiles`:
  - `user_id` UUID primary key and FK to users.
  - `paddle_customer_id` text unique nullable.
  - `paddle_address_id` text nullable.
  - `billing_country_code` text nullable.
  - `billing_postal_code` text nullable.
  - `created_at`, `updated_at`.
  - RLS by `user_id`.
- Create `billing_entitlements`:
  - `user_id` UUID primary key and FK to users.
  - `access_status` text not null: `demo`, `trialing`, `active`,
    `past_due`, `paused`, `canceled`, `expired`.
  - `source` text not null: `none`, `paddle`.
  - `paddle_subscription_id` text unique nullable.
  - `paddle_customer_id` text nullable.
  - `paddle_price_id` text nullable.
  - `trial_ends_at`, `current_period_ends_at`, `canceled_at`, `last_event_at`.
  - `payment_method_required` boolean not null default false.
  - `created_at`, `updated_at`.
  - RLS by `user_id`.
- Create `trial_codes`:
  - `id` UUID primary key.
  - `code_hash` text unique not null.
  - `redeem_by_at` timestamptz not null.
  - `redeemed_at` timestamptz nullable.
  - `redeemed_by_user_id` UUID nullable FK to users.
  - `disabled_at` timestamptz nullable.
  - `created_at`, `updated_at`.
  - No plaintext code column.
- Create `trial_code_redemptions`:
  - `id` UUID primary key.
  - `trial_code_id` UUID FK.
  - `user_id` UUID FK and RLS key.
  - `status` text not null: `pending`, `fulfilled`, `failed`.
  - `paddle_transaction_id` text unique nullable.
  - `paddle_subscription_id` text unique nullable.
  - `created_at`, `updated_at`, `fulfilled_at`, `failed_at`.
  - Unique active redemption per `trial_code_id`.
  - Unique fulfilled trial redemption per `user_id`.
- Create `paddle_webhook_events`:
  - `event_id` text primary key.
  - `event_type` text not null.
  - `occurred_at`, `processed_at`.
  - `processing_status` text not null.
  - `related_user_id` UUID nullable.
  - `related_subscription_id` text nullable.
  - `error_code` text nullable.
  - Do not store raw webhook payload.
- Generate SeaORM entities and wire them into `backend/entity/src/lib.rs`.
- Add backend models in `backend/src/models/billing.rs`.
- Add repository methods for:
  - get/update billing profile by user.
  - get/update entitlement by user.
  - reserve/redeem/fail trial code.
  - record webhook event idempotently.
  - find user by Paddle customer/subscription/custom data.

**Acceptance criteria**
- [x] Migration applies cleanly and is registered.
- [x] User-owned billing tables have RLS and cross-tenant tests.
- [x] Trial codes never store plaintext codes.
- [x] Duplicate Paddle webhook event IDs cannot be processed twice.
- [x] A user cannot have more than one fulfilled local trial redemption.
- [x] Entity smoke tests include new entities.

**TDD log**
- Red: `cargo test -p sumurai-backend --locked billing_schema_tests` failed
  before the registered billing migration existed.
- Red: `cargo test -p sumurai-backend --locked repository_service_tests::given_billing`
  failed before billing models and repository contracts existed.
- Red: `cargo test -p sumurai-backend --locked repository_service_tests::given_paddle_webhook_event_when_recording_then_event_id_is_idempotency_key`
  failed before Paddle webhook idempotency storage existed.
- Green: `cargo test -p sumurai-backend --locked billing_schema_tests`.
- Green: `cargo test -p sumurai-backend --locked repository_service_tests::given_billing`.
- Green: `cargo test -p sumurai-backend --locked repository_service_tests::given_paddle_webhook_event_when_recording_then_event_id_is_idempotency_key`.
- Green: `cargo test -p sumurai-backend --locked entity_smoke_tests`.
- Verification: `cargo fmt -p sumurai-backend -p entity --check`.
- Verification: `cargo check --workspace --locked --all-targets`.
- Verification: `cargo clippy -p sumurai-backend -p entity --locked --all-targets --no-deps -- -D warnings`.
- Verification: `cargo test -p sumurai-backend --locked` passed 740 tests with
  1 ignored.

## Phase 3 - Paddle client, webhook verification, and entitlement service

**Goal:** Isolate Paddle API/webhook behavior and expose a reliable local
entitlement decision.

**Tasks**
- Add `backend/src/providers/paddle_provider.rs` for Paddle API calls. Keep
  Paddle network logic out of handlers.
- Add `backend/src/services/billing_service.rs` for business rules:
  - status projection.
  - trial-code redemption workflow.
  - checkout creation.
  - customer portal session creation.
  - entitlement checks.
- Add `backend/src/services/entitlement_service.rs` if separating pure access
  decisions from Paddle orchestration keeps the service boundary cleaner.
- Implement webhook signature verification:
  - read raw body bytes before JSON parsing.
  - require `Paddle-Signature`.
  - verify timestamp tolerance.
  - compute HMAC-SHA256 over Paddle's signed payload format.
  - compare signatures with timing-safe equality.
  - parse JSON only after signature verification.
- Process at least these Paddle lifecycle events:
  - `transaction.completed`.
  - `subscription.created`.
  - `subscription.updated`.
  - `subscription.activated`.
  - `subscription.paused`.
  - `subscription.canceled`.
  - transaction/payment failure events that can move a subscription to a blocked
    or past-due status.
- Map Paddle subscription statuses to local entitlement:
  - `trialing` -> access allowed, `payment_method_required=true` for cardless
    trial until a payment method is added.
  - `active` -> access allowed.
  - `past_due`, `paused`, `canceled`, `expired` -> own-data writes blocked.
- Grant or update entitlement only from verified webhook processing or an
  explicit server-side reconciliation path, not from frontend claims.
- Add an internal reconciliation method that can fetch a Paddle subscription by
  ID for one user and refresh local state.
- Ensure logs never include Paddle API keys, webhook secrets, raw webhook
  payloads, trial codes, full postal codes, provider tokens, or raw financial
  payloads.

**Acceptance criteria**
- [x] Invalid, missing, stale, or mismatched webhook signatures are rejected
      before JSON parsing.
- [x] Duplicate webhook events return success without double mutation.
- [x] Out-of-order older events do not downgrade newer entitlement state when
      `last_event_at` is newer.
- [x] Trialing and active subscriptions allow own-data writes in billing mode.
- [x] Paused/canceled/past-due/expired subscriptions block own-data writes in
      billing mode.
- [x] Billing disabled mode never calls Paddle.

**TDD log**
- Red: `cargo test -p sumurai-backend --locked billing_service_tests` failed
  before the billing service and Paddle client boundary existed.
- Green: `cargo test -p sumurai-backend --locked billing_service_tests`.
- Verification: `cargo fmt -p sumurai-backend -p entity --check`.
- Verification: `cargo check --workspace --locked --all-targets`.
- Verification: `cargo clippy -p sumurai-backend -p entity --locked --all-targets --no-deps -- -D warnings`.
- Verification: `cargo test -p sumurai-backend --locked` passed 749 tests with
  1 ignored.

## Phase 4 - Billing API routes and CLI trial-code operations

**Goal:** Add production billing endpoints and server-admin trial-code creation
without exposing a web admin surface.

**Tasks**
- Add routes under `/api/billing`:
  - `GET /api/billing/status`.
  - `POST /api/billing/checkout`.
  - `POST /api/billing/trials/redeem`.
  - `POST /api/billing/payment-method`.
  - `POST /api/billing/portal-session`.
  - `POST /api/billing/webhooks/paddle`.
- Outside `BILLING_MODE=paddle`:
  - `GET /api/billing/status` returns `billing_enabled: false` and
    `access_status: unrestricted`.
  - mutation-style billing endpoints return `404 BILLING_DISABLED`.
  - webhook endpoint is registered but returns `404 BILLING_DISABLED`.
- In `BILLING_MODE=paddle`, `GET /api/billing/status` returns:
  - `billing_enabled`.
  - `access_status`.
  - `can_use_own_data`.
  - `is_demo_mode_active`.
  - `trial_ends_at`.
  - `current_period_ends_at`.
  - `payment_method_required`.
  - `billing_portal_available`.
  - `enabled_financial_providers`.
- `POST /api/billing/checkout` creates a Paddle checkout/transaction for the
  $8/month price and returns a Paddle-hosted checkout URL.
- `POST /api/billing/trials/redeem` accepts `{ code, country_code, postal_code }`:
  - rate limit attempts.
  - validate country/postal presence.
  - reserve the single-use code without storing plaintext.
  - create or update Paddle customer/address records.
  - create the cardless-trial transaction with Sumurai user ID in Paddle custom
    data.
  - return `pending` until webhook fulfillment updates entitlement.
- `POST /api/billing/payment-method` uses Paddle's update-payment-method
  transaction flow for a trialing subscription and returns checkout data needed
  for Paddle Checkout.
- `POST /api/billing/portal-session` creates a temporary Paddle customer portal
  session for existing Paddle customers and returns the overview URL plus
  subscription URLs when available.
- Add a CLI command under the existing `cli/` package for trial-code operations:
  - create a code with a redeem-by date.
  - list metadata without plaintext codes.
  - disable a code.
  - hash codes using the same keyed hash algorithm as the backend.
- Regenerate OpenAPI output and update frontend API types.

**Acceptance criteria**
- [x] Billing status is safe and useful in both disabled and production billing
      modes.
- [x] Billing mutation endpoints are unreachable or return `BILLING_DISABLED`
      outside production billing mode.
- [x] Trial redemption does not consume a code if Paddle API setup fails before a
      transaction is created.
- [x] A single-use trial code cannot be redeemed by two users, including
      concurrent attempts.
- [x] Customer portal links are generated on demand and never persisted.
- [x] CLI can create, list, and disable trial codes without adding a web admin UI.

**TDD log**
- Red: `cargo test -p sumurai-backend --locked billing_api_tests` failed before
  billing routes, disabled-mode endpoint gates, and production status projection
  existed.
- Red: `cargo test -p sumurai-backend --locked billing_api_tests` failed before
  trial redemption released reserved codes after Paddle setup failures, blocked
  already reserved codes without calling Paddle, and kept portal URLs ephemeral.
- Red: `cargo test -p sumurai-backend --locked openapi_tests` failed before
  billing paths and schemas were registered in the OpenAPI document.
- Red: `cargo test -p sumurai-cli --locked --test trial_codes_tests` failed
  before keyed trial-code hashing and CLI create/list/disable operations
  existed.
- Green: `cargo test -p sumurai-backend --locked billing_api_tests`.
- Green: `cargo test -p sumurai-backend --locked billing_service_tests`.
- Green: `cargo test -p sumurai-backend --locked openapi_tests`.
- Green: `cargo test -p sumurai-cli --locked --test trial_codes_tests`.
- Verification: `cargo fmt --all --check`.
- Verification: `cargo check --workspace --locked --all-targets`.
- Verification: `cargo clippy --workspace --locked --all-targets --no-deps -- -D warnings`.
- Verification: `bun --cwd=frontend run typecheck`.
- Verification: `bun --cwd=frontend run test` passed 1348 tests.
- Verification: `cargo test --workspace --locked` passed with backend 761
  tests, 1 ignored, and all CLI tests passing.

## Phase 5 - Entitlement and provider gates for own-data writes

**Goal:** Enforce paid/trial access and provider policy at backend boundaries,
not just in the UI.

**Tasks**
- Add a shared guard function or middleware for production billing mode:
  - if billing disabled, allow.
  - if operation is demo-only, allow.
  - if user entitlement is trialing/active, allow.
  - otherwise return `402 PAID_ACCESS_REQUIRED`.
- Add a shared provider allowlist check:
  - if provider not in production allowlist, return `403 PROVIDER_DISABLED`.
  - apply to provider catalog, provider select, Plaid link token, Plaid exchange,
    provider connect, provider sync, SimpleFIN ignored-institution routes, and
    any provider-specific direct route.
- Gate own-data write routes in production billing mode:
  - Plaid link token and exchange token.
  - provider select/connect/sync.
  - DIY create institution.
  - import own transactions.
  - transaction/category/budget writes once the user is outside demo mode or the
    target resource is not demo-scoped.
- Keep these routes available without entitlement:
  - read-only dashboard/accounts/transactions/budgets data.
  - export.
  - disconnect provider connection.
  - delete account.
  - logout, refresh, passkey/security settings.
  - demo onboarding and demo-only exploration.
- Ensure demo exit happens only after the entitlement guard passes for new
  own-data institution/connect flows.
- Add structured logs for entitlement blocks using status/category only; do not
  log financial data or secrets.

**Acceptance criteria**
- [ ] In production billing mode, unpaid demo users cannot create a new DIY
      institution, start Plaid link, exchange a Plaid token, import own data, or
      sync own data.
- [ ] Those denied operations leave `demo_mode_active` unchanged.
- [ ] Trialing/active users can create/connect/sync own data for `diy` and
      `plaid`.
- [ ] Expired/canceled/past-due users can read/export/disconnect/delete but
      cannot mutate own-data resources.
- [ ] Billing disabled mode preserves existing current behavior and does not
      call entitlement checks as blockers.
- [ ] Teller and SimpleFIN direct calls are rejected in production compose even
      if credentials are configured.

## Phase 6 - Frontend billing and production-only visibility

**Goal:** Show billing only in production billing mode and keep all other
environments free of billing UI.

**Tasks**
- Add `frontend/src/services/BillingService.ts` and matching tests.
- Add a `useBillingStatus` hook with a conservative UI rule:
  - if status says disabled, hide all billing UI.
  - if status fetch fails outside a user-triggered billing action, hide billing
    UI and do not show a billing error.
  - never use a frontend env var as the source of truth for whether billing is
    enabled.
- Add a Settings billing section rendered only when `billing_enabled=true`.
- Billing section states:
  - demo/unpaid: show Upgrade and Redeem trial code.
  - trialing with missing payment method: show trial end date and Add payment
    method.
  - active: show paid status and Manage billing.
  - expired/canceled/past-due: show blocked write state, Upgrade/Manage billing,
    and data-retention copy.
- Trial redemption form:
  - code.
  - country.
  - postal code.
  - no card fields.
  - on success, show pending/active state based on billing status refresh.
- Provider picker/account flows:
  - when billing enabled and access missing, show production-only paid lock for
    own-data connect actions.
  - do not show paid locks in billing disabled mode.
  - respect backend `enabled_financial_providers`; do not display Teller or
    SimpleFIN in production billing mode.
- Use existing primitives, recipes, and settings layout conventions. Do not add a
  landing page.
- Keep browser-side telemetry sanitized. Do not log trial codes, postal codes, or
  Paddle URLs with tokens.

**Acceptance criteria**
- [ ] Billing section is absent in dev, OSS/default compose, test stories, and
      billing-disabled API responses.
- [ ] Billing section appears in production billing mode only.
- [ ] Provider picker shows only DIY and Plaid in production billing mode.
- [ ] Unpaid production users see a clear path to Upgrade/Redeem when attempting
      own-data flows.
- [ ] Trial redemption never collects card details.
- [ ] Active/trialing status unlocks own-data UI after billing status refresh.
- [ ] Expired status keeps read/export/disconnect/delete discoverable while
      blocking write actions.

## Phase 7 - Documentation, deployment checks, and verification

**Goal:** Make the production-only billing rollout auditable and safe to operate.

**Tasks**
- Update hosted deployment docs with:
  - production-only billing behavior.
  - Paddle config variables.
  - provider allowlist behavior.
  - trial-code CLI usage.
  - webhook setup and required Paddle event types.
  - cardless trials early-access prerequisite.
  - data-retention behavior after cancellation/expiry.
- Update `.env.example` with placeholder Paddle variables and comments only.
- Update OpenAPI docs for billing endpoints and new response types.
- Add test coverage in the existing backend/frontend test folders.
- Run focused tests first, then full relevant suites.
- If a package is added, use the package manager's add/update flow and commit the
  lockfile changes with the implementation.

**Acceptance criteria**
- [ ] Docs state that paid options apply only to production Docker Compose.
- [ ] Docs state that billing UI must never show in non-production environments.
- [ ] Docs list DIY/Plaid as the only production hosted providers.
- [ ] OpenAPI contains billing endpoints and error codes.
- [ ] Validation passes:
      `cargo fmt -p sumurai-backend -p entity --check`;
      `cargo check --workspace --locked --all-targets`;
      `cargo clippy -p sumurai-backend -p entity --locked --all-targets --no-deps -- -D warnings`;
      `cargo test -p sumurai-backend --locked`;
      `bun --cwd=frontend run test`;
      `bun --cwd=frontend run typecheck`;
      `bun --cwd=frontend run build`.

## Implementation notes for student agents

- Start with config and tests before adding Paddle calls.
- Keep Paddle-specific HTTP code out of handlers.
- Keep entitlement decisions in backend services and reuse the same guard across
  all own-data write routes.
- Do not trust frontend state for access control.
- Do not store plaintext trial codes.
- Do not persist customer portal URLs.
- Do not read or write `.env` files.
- Do not rename or reuse existing financial subscription detection modules for
  SaaS billing.
- Keep tests in `backend/src/tests/` and `frontend/tests/`.
