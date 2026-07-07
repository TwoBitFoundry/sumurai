# Billing Architecture Remediation Plan

Status: Draft
Owner: Kody Buss
Last updated: 2026-07-07
Related: [production-paddle-billing-mprd.md](../prd/production-paddle-billing-mprd.md)

## Context

The production Paddle billing MPRD is implemented through Phase 7, but a branch review found architectural debt in three areas:

- **SoC:** Webhook handler verifies signatures but does not process events; billing orchestration is concentrated in `main.rs`; trial-code hashing is duplicated between backend and CLI.
- **KISS:** `BillingService::new(config.clone())` is constructed on every billing call; service methods take repository and client as parameters on every invocation.
- **DI:** `BillingService` is not wired on `AppState` unlike other domain services; a dummy `RealPaddleClient` is created when billing is disabled.

This plan closes those gaps without changing product behavior outside production billing mode.

## Goals

1. Make Paddle webhook processing the single source of entitlement updates.
2. Compose billing dependencies once at startup and inject them consistently.
3. Eliminate duplicated trial-code hashing between backend and CLI.
4. Reduce `main.rs` billing surface area.
5. Preserve existing API contracts, error codes, and test coverage.

## Non-goals

- New billing features (coupons, admin UI, reconciliation UI).
- Frontend redesign beyond optional action-hook extraction.
- Renaming the entire CLI store layer beyond what trial-code sharing requires.

## Workstreams

### Workstream 1 — Shared trial-code hashing

**Problem:** `hash_trial_code` / `normalize_trial_code` exist independently in `backend/src/services/billing_service.rs` and `cli/src/trial_codes.rs`. A drift here breaks redemption.

**Approach:**

- Add a small workspace crate, e.g. `billing-common`, with:
  - `normalize_trial_code(code: &str) -> Result<String, TrialCodeHashError>`
  - `hash_trial_code(key: &str, code: &str) -> Result<String, TrialCodeHashError>`
- Depend on it from `sumurai-backend` and `sumurai-cli`.
- Remove duplicate implementations from both call sites.
- Keep error mapping at boundaries (backend maps to `BillingServiceError`, CLI to `TrialCodeError`).

**Acceptance criteria:**

- [x] Backend and CLI produce identical hashes for the same key and code (including case/whitespace normalization).
- [x] Existing `trial_codes_tests` and billing redemption tests pass unchanged in behavior.
- [x] No plaintext trial codes stored or logged.

**TDD log**
- Red: `cargo test -p billing-common --locked` failed before `billing-common` crate existed.
- Green: `cargo test -p billing-common --locked`.
- Green: `cargo test -p sumurai-cli --locked --test trial_codes_tests`.
- Green: `cargo test -p sumurai-backend --locked billing_`.
- Verification: `cargo fmt --all --check`, `cargo check --workspace --locked --all-targets`, `cargo clippy -p sumurai-backend -p entity -p billing-common --locked --all-targets --no-deps -- -D warnings`.

---

### Workstream 2 — Compose `BillingService` on `AppState`

**Problem:** Handlers and guards construct `BillingService::new(state.config.clone())` and pass `db_repository` + `paddle_client` per call. Other services are wired once on `AppState`.

**Approach:**

- Extend `BillingService` to hold:
  - `config: Config` (clone, as today)
  - `repository: Arc<dyn DatabaseRepository>` (or borrow pattern consistent with other services)
  - `paddle_client: Arc<dyn PaddleClient>`
- Add `billing_service: Arc<BillingService>` to `AppState`.
- Construct once in `main.rs` startup alongside other services.
- Replace per-handler `BillingService::new(...)` with `state.billing_service`.
- Update entitlement guards to call `state.billing_service.require_own_data_access(user_id, operation)` (or equivalent) instead of inlining repository + projection logic in `main.rs`.

**Acceptance criteria:**

- [x] No direct `BillingService::new` in handlers or guards.
- [x] All billing mutation handlers use `state.billing_service`.
- [x] Entitlement gate tests still pass without behavior change.
- [x] Disabled billing mode still short-circuits before repository/Paddle calls.

**TDD log**
- Red: `cargo test -p sumurai-backend --locked given_billing_disabled_when_checking_own_data_access_then_allows_without_repository` failed before service-owned access checks existed.
- Green: `cargo test -p sumurai-backend --locked billing_service_tests billing_entitlement_gate_tests billing_api_tests`.
- Verification: `cargo fmt --all --check`, `cargo check --workspace --locked --all-targets`, `cargo clippy -p sumurai-backend -p entity -p billing-common --locked --all-targets --no-deps -- -D warnings`.
- Verification: `cargo test -p sumurai-backend --locked` passed 772 tests with 1 ignored.
- Verification: `cargo test -p sumurai-cli --locked`.

---

### Workstream 3 — Paddle webhook processing in the service layer

**Problem:** `handle_paddle_billing_webhook` verifies signature and parses JSON, then returns 200 without idempotency recording, entitlement projection, or trial fulfillment. This is the highest-severity gap.

**Approach:**

- Add `BillingService::process_paddle_webhook(raw_body, signature_header, now) -> Result<(), BillingWebhookError>` that:
  1. Verifies signature (reuse `verify_paddle_webhook_signature`).
  2. Parses envelope + payload fields needed for projection.
  3. Records event idempotently via `record_paddle_webhook_event`.
  4. Resolves user from Paddle custom data / customer / subscription IDs.
  5. Applies entitlement updates only when `should_apply_event` allows.
  6. Marks trial redemption `fulfilled` when appropriate.
- Map at least these event types (per MPRD):
  - `transaction.completed`
  - `subscription.created`
  - `subscription.updated`
  - `subscription.activated`
  - `subscription.paused`
  - `subscription.canceled`
  - failure events that move subscription to past-due/blocked
- Handler becomes:

```rust
state.billing_service.process_paddle_webhook(&headers, &raw_body).await
```

**Acceptance criteria:**

- [ ] Duplicate webhook event IDs return success without double mutation.
- [ ] Out-of-order older events do not downgrade newer entitlement (`last_event_at`).
- [ ] Verified webhook is the only path that grants trialing/active entitlement (no frontend trust).
- [ ] Invalid/missing/stale signatures rejected before JSON business parsing.
- [ ] Handler contains no entitlement or repository logic beyond delegation.

**TDD slices:**

1. Red: service tests for signature rejection, duplicate event idempotency, out-of-order skip, status projection per Paddle status string.
2. Green: implement `process_paddle_webhook`; thin handler delegates.
3. Red: integration test — trial redeem → webhook → entitlement becomes `trialing`.
4. Refactor: isolate Paddle payload parsing helpers inside service module.

---

### Workstream 4 — Extract billing HTTP layer from `main.rs`

**Problem:** Billing routes, response mappers, guards, and OpenAPI annotations add significant weight to `main.rs`.

**Approach:**

- Create `backend/src/handlers/billing.rs` (or `backend/src/billing/handlers.rs` if a billing module folder is preferred).
- Move into it:
  - billing route handlers
  - `billing_service_error_response`
  - `load_billing_user`
  - billing-specific response helpers used only by billing routes
- Keep shared guards (`require_paid_own_data_access*`) either:
  - in `handlers/billing.rs` if billing-only, or
  - in `middleware/entitlement.rs` if used broadly across provider/import/budget routes (preferred long-term).
- Register routes from a `billing_routes()` builder called by `main.rs`.
- Update `openapi/mod.rs` path references if handler paths change.

**Acceptance criteria:**

- [ ] `main.rs` no longer contains billing handler function bodies.
- [ ] OpenAPI generation unchanged (same paths/schemas).
- [ ] `openapi_tests` and `billing_api_tests` pass.

**TDD slices:**

1. Green-first refactor: move code without behavior change; run `billing_api_tests` + `openapi_tests`.
2. Optional follow-up: extract entitlement middleware module once webhook + service wiring is stable.

---

### Workstream 5 — Disabled-mode Paddle client

**Problem:** When `BILLING_MODE=disabled`, startup still builds `RealPaddleClient::new("sandbox", String::new())`.

**Approach:**

- Add `NoOpPaddleClient` implementing `PaddleClient` that returns `BillingServiceError::BillingDisabled` (or internal error) on all methods.
- Select implementation at startup:
  - `Some(paddle)` → `RealPaddleClient`
  - `None` → `NoOpPaddleClient`
- Assert in tests that disabled mode never invokes Paddle (existing test may already cover checkout; extend to all mutation paths).

**Acceptance criteria:**

- [ ] No real HTTP client constructed when billing disabled.
- [ ] Billing disabled tests prove Paddle client methods are never called.

---

### Workstream 6 — Frontend cleanup (optional, low priority)

**Problem:** `BillingSection` mixes UI and side-effect orchestration. Not blocking, but will grow if more billing actions are added.

**Approach:**

- Extract `useBillingActions` hook:
  - `upgrade`, `redeemTrial`, `addPaymentMethod`, `openPortal`
  - pending/error/message state
- Keep `useBillingStatus` as read-only status fetch.
- `BillingSection` becomes mostly render logic.

**Acceptance criteria:**

- [ ] Existing Settings and billing tests pass.
- [ ] No change to when billing UI is shown/hidden.

---

### Workstream 7 — CLI store naming (optional, low priority)

**Problem:** `PostgresPasskeyResetStore` implements `TrialCodeStore`.

**Approach:**

- Rename to `PostgresAdminStore` or split into `PostgresTrialCodeStore` if passkey reset and trial codes should not share a type.
- Update CLI `connect_store` helpers accordingly.

**Acceptance criteria:**

- [ ] CLI trial-code and reset-passkeys commands still work.
- [ ] No behavioral change.

## Recommended execution order

| Order | Workstream | Rationale |
| ----- | ---------- | ----------- |
| 1 | Shared trial-code hashing | Small, removes drift risk before webhook work |
| 2 | Compose `BillingService` on `AppState` | Foundation for webhook + handler extraction |
| 3 | Webhook processing in service | Highest functional gap; depends on composed service |
| 4 | Extract billing handlers from `main.rs` | Safer after service API stabilizes |
| 5 | `NoOpPaddleClient` | Quick win once service wiring exists |
| 6 | Frontend `useBillingActions` | Optional polish |
| 7 | CLI store rename | Optional clarity |

Each workstream should be committed separately with conventional commits referencing this plan.

## Validation commands

After each workstream:

```bash
cargo fmt -p sumurai-backend -p entity --check
cargo check --workspace --locked --all-targets
cargo clippy -p sumurai-backend -p entity --locked --all-targets --no-deps -- -D warnings
cargo test -p sumurai-backend --locked
cargo test -p sumurai-cli --locked
bun --cwd=frontend run test
bun --cwd=frontend run typecheck
```

Full webhook workstream should additionally run focused tests:

```bash
cargo test -p sumurai-backend --locked billing_service_tests
cargo test -p sumurai-backend --locked billing_api_tests
```

## Risks and mitigations

| Risk | Mitigation |
| ---- | ---------- |
| Webhook payload shape changes | Keep Paddle JSON parsing in isolated private helpers; test with fixture payloads |
| Refactor breaks entitlement gates | Migrate guards to service first; keep existing gate integration tests green |
| Shared crate adds workspace complexity | Keep crate minimal (hashing only); no DB or HTTP deps |
| Handler extraction breaks OpenAPI | Run `openapi_tests` after every move; use `#[path]` or module re-exports to preserve utoipa paths |

## Definition of done

- Webhook fulfillment grants entitlement without manual intervention.
- Billing dependencies composed once on `AppState`.
- Trial-code hash has a single implementation shared by backend and CLI.
- `main.rs` billing handler bodies extracted.
- Disabled mode uses explicit no-op Paddle client.
- All validation commands pass.
- This plan's acceptance criteria checked off.
