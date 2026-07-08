# Plan — Open Paddle Trials, Then Live Demo/Upgrade

Status: In progress (Phases 3 and 1 complete)  
Owner: Kody Buss  
Last updated: 2026-07-08  
Related: [production-paddle-billing-mprd.md](../prd/production-paddle-billing-mprd.md), [PRODUCTION_BILLING.md](../PRODUCTION_BILLING.md)

## Goal

1. **Remove Sumurai invite trial codes** (CLI inventory + redeem-with-code).
2. **Early access (backend):** open cardless trial start owned by Paddle; killable via config for live.
3. **Live (backend):** trials disabled; unpaid users are demo-only until paid (`active`).
4. **Remove the frontend Paddle/subscription surface now**; rebuild Settings billing UI, upgrade/trial CTAs, and provider paid-locks later.

Entitlement always comes from verified Paddle webhooks. Demo mode stays the free exploration path. Backend billing APIs and gates remain; the app UI does not drive Paddle checkout/portal/trial flows in this plan.

## Product stages (backend)

| Stage | New trial starts | Own-data unlock |
| ----- | ---------------- | --------------- |
| **Early access** | `POST /api/billing/trials/start` allowed | `trialing` or `active` |
| **Live** | Start rejected (`BILLING_TRIALS_ENABLED=false`) | `active` only |

Flip with backend config:

- `BILLING_TRIALS_ENABLED=true` → early access
- `BILLING_TRIALS_ENABLED=false` → live (no new trials)

Existing `trialing` users when flipping live: soft default is let current trials finish; block **new** starts only (confirm before cutover).

## Product rules (both stages)

| State | Access |
| ----- | ------ |
| Demo / unpaid | Seeded demo; no own-data writes |
| `trialing` | Own-data writes; `payment_method_required` until card added |
| `active` | Own-data writes |
| `past_due` / `paused` / `canceled` / `expired` | Read/export/disconnect/delete only |

**Once-per-user (early access):** cannot start another open trial if they already have/had a Paddle-backed trial or paid entitlement. Enforce in `BillingService` before calling Paddle.

**Country + postal** required for Paddle customer/address on cardless trial start (API contract; no Sumurai code).

## Non-goals

- Do not keep Sumurai `trial_codes` / CLI minting.
- Do not remove demo mode, paid checkout/portal **APIs**, or webhook entitlement.
- Do not ship or redesign frontend billing/subscription UI in this plan (explicitly deferred).
- Do not use Paddle discount codes as trial invites.
- Do not require dropping DB trial-code tables in the first cut.

## Frontend deferral (this plan)

**Remove now (no Paddle subscription UX in the app):**

- Settings `BillingSection` and its SettingsPage mount
- `useBillingStatus` / `useBillingActions` / `BillingService` usage from pages
- Provider selection / Accounts paid-lock copy and `billingStatus` props that push users to Upgrade/Redeem/Manage billing
- Frontend tests that assert billing CTAs, trial redeem, portal, payment-method buttons

**Keep for a later plan:**

- Backend `/api/billing/*` routes (status, checkout, trials/start, payment-method, portal, webhooks)
- Backend entitlement gates (`402 PAID_ACCESS_REQUIRED`) — users may hit API errors without a polished UI until the later frontend lands
- `BillingStatusResponse` (and related) types in `frontend/src/types/api.ts` if still useful; otherwise trim unused client helpers only

**Later frontend plan (out of scope here):** stage-aware Start trial / Upgrade / Manage billing, provider locks, payment-method CTA while `trialing`.

## Current → target

| Today | This plan |
| ----- | --------- |
| CLI invite codes | Gone |
| Redeem / Start trial / Upgrade / Portal UI | Gone (deferred rebuild) |
| `POST /trials/redeem` | Replace with `POST /trials/start` (backend only) |
| `TRIAL_CODE_HASH_KEY` | Removed |
| Entitlement gates | Kept |
| Webhooks / checkout / portal APIs | Kept |

---

## Phase 1 — Backend: open trial + stage flag

**Goal:** Code-free trial start; killable for live via config. No dependency on frontend CTAs.

**Tasks**
- Add `BILLING_TRIALS_ENABLED` (bool; early access `true`, live `false` in compose/env).
- Expose on `GET /api/billing/status` as `trials_enabled` (and optionally `can_start_trial`) for the future UI.
- Add `BillingService::start_open_trial(user, country, postal)`:
  - billing enabled;
  - `BILLING_TRIALS_ENABLED`;
  - once-per-user guard;
  - Paddle cardless trial via existing client;
  - return `pending`; no `trial_codes` writes.
- Replace `POST /api/billing/trials/redeem` with `POST /api/billing/trials/start` `{ country_code, postal_code }`.
- When trials disabled: start → `404` / `TRIALS_DISABLED`; status still works.
- Rate-limit start attempts.
- Drop `TRIAL_CODE_HASH_KEY` requirement; keep `PADDLE_CARDLESS_TRIAL_PRICE_ID` while trials may be enabled.
- OpenAPI update; keep or minimally adjust `frontend/src/types/api.ts` for status fields only if needed.
- Tests: start, once-per-user, trials-disabled, webhook without code fulfillment.

**Acceptance criteria**
- [x] Start trial works without a code when `BILLING_TRIALS_ENABLED=true`.
- [x] Start trial rejected when flag is false.
- [x] Second start rejected for same user.
- [x] Redeem-with-code path removed.
- [x] Status includes `trials_enabled` (future UI).
- [x] `cargo test -p sumurai-backend --locked billing_` passes.

**Notes**
- `POST /api/billing/trials/start` `{ country_code, postal_code }` replaces redeem.
- `BILLING_TRIALS_ENABLED` defaults to `false` when unset; paddle mode no longer requires `TRIAL_CODE_HASH_KEY`.
- Once-per-user: any non-demo entitlement status blocks another start (`TRIAL_ALREADY_USED`).
- Webhook entitlement still works without a trial-code redemption row; legacy fulfillment helpers remain until Phase 2.

**TDD log (Phase 1)**
- Red/green: API tests for start success, Paddle failure, once-per-user conflict, trials disabled.
- Config: trials flag parse + default-off; OpenAPI path/schema rename + `trials_enabled`.
- Verify: `cargo test -p sumurai-backend --locked billing_` — 48 pass; clippy `-D warnings` clean; OpenAPI regenerated.

---

## Phase 2 — Remove CLI trial-code surface

**Goal:** No invite-code ops in the public product.

**Tasks**
- Remove CLI `trial-codes` commands, tests, and hashing dependency if unused.
- Remove `billing-common` if only used for trial codes.
- Remove `TRIAL_CODE_HASH_KEY` from compose/docs.
- Deprecate or later-drop `trial_codes` / `trial_code_redemptions` tables.

**Acceptance criteria**
- [ ] No trial-codes CLI; cli tests pass.
- [ ] No runtime `TRIAL_CODE_HASH_KEY` / `hash_trial_code` usage.

---

## Phase 3 — Remove frontend Paddle subscription surface

**Goal:** App has no billing/subscription management UI until a later plan.

**Tasks**
- Remove `BillingSection` from Settings (and delete or gut the feature module).
- Stop calling billing hooks/services from Settings, Accounts, and provider selection.
- Remove paid-lock / “Upgrade or redeem…” UX that depends on billing status (provider cards fall back to non-billing behavior).
- Delete or stop shipping: `useBillingActions`, billing action tests, Settings billing CTA tests, `BillingService` mutation helpers if unused.
- Optionally keep a thin `getStatus` client for a future plan; prefer removing unused client code entirely if nothing reads it.
- Ensure Storybook/user-journey stories do not require billing UI.

**Acceptance criteria**
- [x] No Settings Billing section, trial redeem, checkout, portal, or payment-method buttons in the app.
- [x] Provider/Accounts flows do not show Paddle upgrade/trial copy.
- [x] Frontend tests that asserted billing CTAs are removed or rewritten without billing UI.
- [x] App still loads in billing-disabled and billing-enabled backends (gates may 402 on own-data writes without UI guidance — accepted until later frontend).

**Notes**
- Deleted `BillingSection`, `useBillingStatus`, `useBillingActions`, `BillingService`, and unused billing client types from `api.ts`.
- Accounts/provider picker no longer read billing status or show Upgrade/Redeem locks; visibility uses `visibleProviders` only.
- Backend `/api/billing/*` and entitlement gates unchanged.

**TDD log (Phase 3)**
- Red/green: `SettingsPage` — assert no Billing/Upgrade/portal/redeem controls; remove `BillingSection` mount.
- Red/green: `ProviderSelectionPanel` — replace paid-lock CTA tests with “no upgrade/trial copy”; strip `billingStatus` / `billingLocked`.
- Cleanup: delete billing hooks/service/tests; trim unused billing types.
- Verify: `bun --cwd=frontend run typecheck` pass; `bun --cwd=frontend run test` — 1350 pass / 0 fail.

---

## Phase 4 — Docs and cutover

**Goal:** Operators know early-access vs live; docs do not assume in-app billing UI yet.

**Tasks**
- Document `BILLING_TRIALS_ENABLED`, `POST /trials/start`, and live flip in `PRODUCTION_BILLING.md`.
- State clearly that **in-app Paddle subscription UI is deferred**; early access/live trial starts may be API/ops-driven until the later frontend lands.
- Update architecture (redeem → start; note flag; note no frontend billing surface).
- Note on original MPRD: invite codes superseded; frontend billing CTAs deferred.
- Align `.env.example` with remaining Paddle vars + trials flag.
- Cutover checklist:
  1. Early access: flag on, cardless price configured, start API live.
  2. Live: `BILLING_TRIALS_ENABLED=false`; no new trials.
  3. Decide soft vs hard cutover for in-flight `trialing` subs.
  4. Later: rebuild frontend billing CTAs against status + start/checkout/portal APIs.

**Acceptance criteria**
- [ ] Docs describe stages, flag, and deferred frontend.
- [ ] No public doc tells operators to mint Sumurai trial codes.
- [ ] Doc tests updated.

---

## Validation

```bash
cargo test -p sumurai-backend --locked billing_
cargo test -p sumurai-cli --locked
bun --cwd=frontend run test
bun --cwd=frontend run typecheck
```

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Users hit `402` with no upgrade UI | Accepted until later frontend; document for operators |
| Live flip strands trialing users | Soft vs hard Paddle cancel — choose before flip |
| Open-trial abuse in early access | Once-per-user + rate limit + flag |
| Ops need to start trials without UI | Use API/authenticated calls or temporary tooling until frontend returns |

## Definition of done

- [ ] No Sumurai trial-code inventory or CLI.
- [x] Backend supports open Paddle trial start + live kill switch.
- [x] No in-app Paddle subscription / billing CTA surface.
- [ ] Docs match backend stages and deferred frontend.
- [ ] Tests green.

## Implementation order

1. Phase 3 (remove frontend billing surface) — can land first to stop exposing unfinished UX  
2. Phase 1 (backend open trial + flag)  
3. Phase 2 (CLI cleanup)  
4. Phase 4 (docs + cutover)
