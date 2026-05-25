# Replace Onboarding with Provider Picker + Per-User Active Provider

## Context

Today, onboarding is a two-step wizard ([WelcomeStep](frontend/src/components/onboarding/WelcomeStep.tsx) → [ConnectAccountStep](frontend/src/components/onboarding/ConnectAccountStep.tsx)) where the user's provider is pre-decided by the `DEFAULT_PROVIDER` env var. The backend even refuses to start if that var points at a provider whose credentials aren't configured. A polished `ProviderSelectionPanel` already exists at [frontend/src/features/plaid/components/ProviderSelectionPanel.tsx](frontend/src/features/plaid/components/ProviderSelectionPanel.tsx) but is only wired into Storybook.

We want to:

1. **Replace the entire wizard with a single Provider Picker screen.** Keep only the **Skip for now** and **Continue** footer buttons from the wizard chrome. No step indicator, no Welcome step, no embedded connect flow.
2. **Remove the system-wide provider default concept.** Each user chooses their own active provider; provider selection is entirely user-owned.
3. **Show the picker again on the Accounts page when the user has no active provider** (fresh user who skipped, or fully disconnected user) so they can switch.
4. **Re-do the picker card copy** with accurate, price-led, self-hosted-pricing framing — Teller → SimpleFIN → Plaid — and emphasize SimpleFIN's privacy story.

Card content must be accurate (don't fudge details), short, scannable.

Behavior rules:

- **SimpleFIN is always enabled** in the picker (user supplies a one-time setup token at connect time).
- **Teller is enabled only when Teller credentials are configured** on the host (cert + key files).
- **Plaid is enabled only when Plaid credentials are configured** on the host (client id + secret + env).
- Disabled cards stay visible; only the action button is disabled. Show a tiny "Missing credentials" line beneath it (no long explanation).
- A user can switch providers via `/providers/select` only when they have zero `is_connected = true` `ProviderConnection`s for their current provider.
- `user.provider` stays a `String`; an **empty string means unset**. No DB migration.

---

## Phase 1 — Backend: remove the startup default-provider dependency

**Goal:** The Rust app boots successfully with any subset of provider credentials configured (including zero). `/providers/info` reflects whatever was actually registered.

**Tasks:**

- Update startup block in [backend/src/main.rs](backend/src/main.rs) (lines ~115–185):
  - When a provider's credentials are missing, log a warning and skip registration (current "skipping" log is fine — just don't crash).
  - If zero providers register, log a single warning ("No financial providers configured — users will see all picker cards disabled"). Don't crash.
- Update [backend/src/services/sync_service.rs](backend/src/services/sync_service.rs):
  - `resolve_provider`: if the per-connection provider name is missing, return a clear error (`"No provider selected — connect an account first"`). Never silently fall back.

**Acceptance criteria:**

- [x] `cargo build --manifest-path backend/Cargo.toml --locked` succeeds.
- [x] With `PLAID`_* and Teller cert vars all unset, `cargo run` boots without panic and logs that only SimpleFIN registered (SimpleFIN always initializes).
- [x] With Plaid creds unset, the app still boots; Plaid is skipped with a warning.
- [x] `GET /api/providers/info` returns `available_providers` containing only the providers that successfully registered.
- [x] `cargo test --manifest-path backend/Cargo.toml --locked` passes (existing config tests updated where needed; add at least one test in `backend/src/tests/` covering the boot-with-zero-Plaid/Teller path and one for `SyncService::resolve_provider` error path).

**TDD log:**

- `cargo test --manifest-path backend/Cargo.toml --locked provider_bootstrap_tests::given_plaid_and_teller_unavailable_when_building_provider_registry_then_only_simplefin_is_registered -- --nocapture`
  - Bootstrap helper test passed.
- `cargo test --manifest-path backend/Cargo.toml --locked sync_service_tests::given_missing_provider_when_resolving_then_returns_error -- --nocapture`
  - Resolve-provider error-path test passed.
- `cargo build --manifest-path backend/Cargo.toml --locked`
  - Build passed.
- `cargo test --manifest-path backend/Cargo.toml --locked`
  - 435 tests passed, 1 ignored.

---

## Phase 2 — Backend: per-user active provider + connection-gated switching

**Goal:** Each user owns their active provider via `user.provider` (empty = unset). The `/providers/select` endpoint accepts any registered provider, and rejects switches while active connections exist on the current provider.

**Tasks:**

- Update [backend/src/main.rs](backend/src/main.rs) `register_user` (lines ~732–753):
  - Set `provider: String::new()` on newly created `User` rows (no longer derives from config default).
- Update [backend/src/models/auth.rs](backend/src/models/auth.rs):
  - Add a helper on `User`, e.g. `pub fn active_provider(&self) -> Option<&str>` returning `None` for empty string.
- Update `select_authenticated_provider` in [backend/src/main.rs](backend/src/main.rs) (lines ~3404–3439):
  - Remove the `provider != "plaid" && provider != "teller"` check. Validate against the registry instead: 400 if the requested provider isn't registered.
  - Before persisting, check whether the user has any `is_connected = true` connections whose `provider` differs from the requested value. If yes, return 409 with `"Disconnect all <current_provider> accounts before switching"`. (Zero active connections ⇒ allow.)
- Update `get_authenticated_provider_info` in [backend/src/main.rs](backend/src/main.rs) (lines ~3340–3388):
  - `user_provider` serializes as `null` when `user.provider` is empty — drop the "fall back to default during onboarding" behavior. The picker is what drives selection now.
- Confirm `update_user_provider` (already present at [backend/src/services/repository_service.rs:549](backend/src/services/repository_service.rs:549)) needs no schema change; it accepts any string and the column stays `NOT NULL DEFAULT 'teller'` from migration 019.
- Regenerate OpenAPI: [backend/openapi/](backend/openapi/) and [docs/OPENAPI.json](docs/OPENAPI.json). The `ProviderInfoResponse` schema must show nullable `user_provider`.

**Acceptance criteria:**

- [x] `POST /api/providers/select { "provider": "simplefin" }` returns 200 (previously returned 400).
- [x] `POST /api/providers/select { "provider": "made-up" }` returns 400 with a "not registered" message.
- [x] When the authenticated user has any `is_connected = true` `ProviderConnection` with `provider = 'teller'`, `POST /api/providers/select { "provider": "plaid" }` returns 409.
- [x] After all Teller connections are disconnected (`is_connected = false`), the same call returns 200.
- [x] A user created via `/register` has `user.provider = ''` in the database; `GET /api/providers/info` returns `user_provider: null`.
- [x] Backend tests in `backend/src/tests/` cover: register sets empty provider, select rejects unregistered provider, select rejects switch while active connections exist, select allows switch when none exist, select allows simplefin.
- [x] `cargo test --manifest-path backend/Cargo.toml --locked` passes.
- [x] Regenerated OpenAPI files committed; manual diff confirms intentional nullable changes only.

**TDD log:**

- `cargo test --manifest-path backend/Cargo.toml --locked provider_selection_api_tests::given_ -- --nocapture`
  - 7 provider-selection tests passed.
- `cargo test --manifest-path backend/Cargo.toml --locked regenerate_openapi_artifacts -- --ignored --nocapture`
  - Regenerated `docs/OPENAPI.json` from the current schema.
- `cargo test --manifest-path backend/Cargo.toml --locked`
  - 433 tests passed, 1 ignored.
- `cargo build --manifest-path backend/Cargo.toml --locked`
  - Build passed.

---

## Phase 3 — Frontend types + provider catalogue

**Goal:** Types and provider catalogue helpers reflect that `user_provider` can be null, and that picker availability is per-provider with a reason.

**Tasks:**

- Update [frontend/src/types/providerCatalog.ts](frontend/src/types/providerCatalog.ts) and [frontend/src/types/api.ts](frontend/src/types/api.ts):
  - `user_provider?: FinancialProvider | null`.
- Update [frontend/src/hooks/useProviderCatalog.ts](frontend/src/hooks/useProviderCatalog.ts):
  - `defaultProvider` and `userProvider` already accept `null` — verify all consumers handle null without crashing.
  - `chooseProvider` already calls `/providers/select`; just ensure the success path updates `user_provider` correctly when it was previously null.
- Update [frontend/src/utils/providerCapabilities.ts](frontend/src/utils/providerCapabilities.ts):
  - `getConnectBlockedReason(provider, catalogue)` returns concise, accurate copy for each provider when not available:
    - Teller: `"Missing credentials"`
    - Plaid: `"Missing credentials"`
    - SimpleFIN: always returns `null` (never blocked at the picker — the connect step handles the token).
  - Provide a thin helper like `isPickerEnabled(provider, catalogue): boolean` that's true for SimpleFIN regardless of `availableProviders`, and otherwise mirrors `isProviderConnectable`.

**Acceptance criteria:**

- [x] `npm --prefix frontend run typecheck` passes.
- [x] Unit tests for `providerCapabilities` cover: Teller without creds → blocked with reason, Plaid without creds → blocked with reason, SimpleFIN always enabled, all three enabled when fully configured.
- [x] No remaining frontend code reads `userProvider` as if it were guaranteed non-null.

**TDD log:**

- `npm --prefix frontend test -- --runTestsByPath tests/utils/providerCapabilities.test.ts tests/hooks/useProviderCatalog.test.tsx`
  - Passed after updating the stale Teller blocked-copy assertion.
- `npm --prefix frontend run typecheck`
  - Passed.
- `rg -n "userProvider!|\\buserProvider\\s*\\." frontend/src frontend/tests`
  - Returned no unsafe direct non-null assertions or property reads.

---

## Phase 4 — Frontend: provider card copy + picker UI for the 3-tier layout

**Goal:** The `ProviderSelectionPanel` renders the canonical Teller → SimpleFIN → Plaid order, with Self-Hosted Cost chips, accurate bullets, and disabled-with-reason states for cards whose backend credentials are missing.

**Design rule (non-negotiable):** Every visual primitive in this phase must come from [DESIGN.md](DESIGN.md)-driven tokens and recipes:

- Use `cn()`, `GlassCard`, `Button`, and other shared primitives from `@/ui/primitives`.
- Use recipes from `@/ui/recipes` (`border`, `effect`, `radius`, `status`, `surface`, `text`, `font`) — never inline raw Tailwind values that mirror token state (e.g. don't write `text-slate-500` when `uiTextRecipes.subtle` exists).
- Pull palettes from `@/ui/tokens` (`featurePalettes` etc.) instead of bespoke gradients.
- The new `price` chip, `Self-Hosted Cost` eyebrow, and `"Missing credentials"` line all reuse existing recipes (`uiStatusRecipes.info.`* for the price chip, `uiTextRecipes.subtle` for the missing-credentials line, etc.). No new ad-hoc color literals.
- If a needed token is missing, add it to `DESIGN.md` and regenerate via `npm run design:guard` rather than hardcoding values.

**Tasks:**

- Rewrite [frontend/src/utils/providerCards.ts](frontend/src/utils/providerCards.ts):
  - Add a `price` field on `ProviderCardConfig` (separate from `badge`).
  - Export `PROVIDER_PRICE_ORDER: FinancialProvider[] = ['teller', 'simplefin', 'plaid']`.
  - **Teller** — `price: "Free for up to 100 live connections"`, `badge: "Developer-first"`. Bullets emphasize: self-hosted with your own Teller API keys, mTLS-secured, US bank coverage, transparent category strings.
  - **SimpleFIN** — `price: "$1.50 / month at simplefin.org"`, `badge: "Privacy-first"`. Bullets emphasize: you authorize each institution on your own SimpleFIN bridge, no third-party link UI inside Sumurai, read-only via one-time setup token, revoke or rotate per-institution anytime.
  - **Plaid** — `price: "Pay-as-you-go (Plaid pricing)"`, `badge: "Broadest coverage"`. Bullets emphasize: 12,000+ supported institutions, enhanced merchant + category enrichment, fast end-user link flow, you pay Plaid directly per their tiers.
  - Keep existing `CONNECT_ACCOUNT_PROVIDER_CONTENT` block intact (used by AccountsPage connect content) — only the small picker card data changes.
- Update [frontend/src/features/plaid/components/ProviderSelectionPanel.tsx](frontend/src/features/plaid/components/ProviderSelectionPanel.tsx):
  - Iterate `PROVIDER_PRICE_ORDER` instead of `availableProviders` so all three cards always render.
  - Accept per-provider `enabled` + `blockedReason` props (compute via `isPickerEnabled` / `getConnectBlockedReason`), or compute in-component from the catalogue object.
  - Render the **"Self-Hosted Cost"** eyebrow above the title (replace today's "Select Provider").
  - Show the `price` value as a chip beneath the title; keep the persona `badge` slot in the top-right.
  - Disabled state: card stays fully visible; only the action button is disabled (use the existing `Button` disabled styling — do not invent a new variant). Show a tiny `"Missing credentials"` line beneath the button using `uiTextRecipes.subtle` + `uiTypographyRecipes.caption`. SimpleFIN never renders disabled.
  - Keep the existing `onSelectProvider` callback contract; the panel stays visible after selection so onboarding can enable Continue without leaving the screen.
- Update Storybook story (`AccountsScreenSlice.tsx` or the dedicated picker story if one exists) so it demos all three states: all enabled, Teller disabled, all disabled except SimpleFIN.

**Acceptance criteria:**

- [x] Picker always shows 3 cards in order Teller → SimpleFIN → Plaid.
- [x] Self-Hosted Cost eyebrow + per-card price chip render exactly as specified.
- [x] With only Teller creds configured: Teller + SimpleFIN enabled, Plaid card visible with disabled button + `"Missing credentials"` line.
- [x] With only Plaid creds configured: Plaid + SimpleFIN enabled, Teller card visible with disabled button + `"Missing credentials"` line.
- [x] With zero provider creds configured: only SimpleFIN enabled; Teller + Plaid show disabled button + `"Missing credentials"` line.
- [x] `rg "text-(slate|gray|sky|emerald|red|amber)-[0-9]" frontend/src/utils/providerCards.ts frontend/src/features/plaid/components/ProviderSelectionPanel.tsx` returns nothing — all styling flows through `@/ui/recipes` / `@/ui/tokens` / `@/ui/primitives`.
- [x] `npm --prefix frontend run design:guard` (or the project equivalent) reports no drift between [DESIGN.md](DESIGN.md) and generated artifacts.
- [x] Storybook stories cover all three states; visual review confirms accurate copy and clear disabled affordances.
- [x] Unit / RTL tests in `frontend/tests/` cover enabled and disabled card states.

---

## Phase 5 — Frontend: delete wizard, replace with single-screen onboarding

**Goal:** Onboarding is one screen: the provider picker with Skip-for-now + Continue footer. The multi-step wizard and Welcome step are gone. The card action launches the provider-specific connect modal, and SimpleFIN uses the same modal pattern for its setup-token flow.

**Tasks:**

- Create `frontend/src/components/onboarding/OnboardingProviderPicker.tsx`:
  - Renders inside `GradientShell` + `AppTitleBar` (carry over from `OnboardingWizard.tsx`).
  - Renders `ProviderSelectionPanel` (from Phase 4) with `providerCatalog` wired in and keeps the picker visible while the modal handles the provider connection.
  - When a card's `Connect` action is used, open the provider-specific connect modal. SimpleFIN uses the setup-token field; Teller and Plaid launch their existing SDK/link flows from inside the modal.
  - Footer row contains **Skip for now** and **Continue** buttons (use the existing `Button` primitive with the same variants as today's wizard) and stays inside the picker surface.
  - **Continue** is disabled until `providerCatalog.userProvider` is non-empty. After the modal finishes successfully, the chosen provider is saved and Continue becomes available. Clicking Continue calls `AuthService.completeOnboarding()` then `onComplete()`.
  - **Skip for now** calls `AuthService.completeOnboarding()` then `onComplete()` — leaves `user.provider` empty so the AccountsPage picker takes over.
- Update [frontend/src/App.tsx](frontend/src/App.tsx):
  - Replace `<OnboardingWizard ... />` with `<OnboardingProviderPicker ... />`. Same `onboarding_completed` gate.
- Slim down or delete [frontend/src/hooks/useOnboardingWizard.ts](frontend/src/hooks/useOnboardingWizard.ts):
  - Drop step machinery: `stepIndex`, `goToNext`, `goToPrevious`, `isLastStep`, `ONBOARDING_STEPS`, `OnboardingStep` type.
  - If only `completeWizard` + `skipWizard` remain and they're trivial wrappers, inline them into `OnboardingProviderPicker` and delete the hook entirely.
- Delete:
  - [frontend/src/components/onboarding/OnboardingWizard.tsx](frontend/src/components/onboarding/OnboardingWizard.tsx)
  - [frontend/src/components/onboarding/WelcomeStep.tsx](frontend/src/components/onboarding/WelcomeStep.tsx)
  - [frontend/src/components/onboarding/ConnectAccountStep.tsx](frontend/src/components/onboarding/ConnectAccountStep.tsx)
  - Their `frontend/tests/components/onboarding/`* siblings.
- Add `frontend/tests/components/onboarding/OnboardingProviderPicker.test.tsx`:
  - Continue disabled before a provider connect completes.
  - Completing a provider connect enables Continue.
  - Skip-for-now calls `completeOnboarding` without touching `/providers/select`.
  - Continue after a completed provider connect calls `chooseProvider` then `completeOnboarding`.
  - Connect on SimpleFIN reveals the setup-token field; Connect on Teller/Plaid triggers the provider connect hook.

**Acceptance criteria:**

- [x] No file under `frontend/src/components/onboarding/` references "step", "Welcome", or "ConnectAccount" any more.
- [x] `OnboardingProviderPicker.tsx` exists and is the only onboarding-rendering component used by `App.tsx`.
- [ ] Fresh-user flow in the browser at [http://localhost:8080](http://localhost:8080): register → onboarding shows ONLY the picker (no step indicator, no Welcome). Continue button disabled until pick.
- [ ] Skip-for-now path lands the user in the app with `user.provider = ''`.
- [ ] Continue path lands the user in the app with `user.provider` set to the picked value.
- [x] `npm --prefix frontend test` passes (new picker test added; old wizard tests removed).
- [x] `npm --prefix frontend run typecheck` and `npm --prefix frontend run lint` pass.

**TDD log:**

- `npm --prefix frontend test -- --runTestsByPath tests/components/onboarding/OnboardingProviderPicker.test.tsx tests/App.test.tsx tests/features/plaid/components/ProviderSelectionPanel.test.tsx`
  - Passed after wiring the onboarding picker and keeping the provider panel visible after selection.
- `npm --prefix frontend test -- --runTestsByPath tests/components/onboarding/OnboardingProviderPicker.test.tsx tests/features/plaid/components/ProviderSelectionPanel.test.tsx`
  - Passed after wiring the new onboarding picker and keeping the provider panel visible after selection.
- `npm --prefix frontend run typecheck`
  - Passed after removing the wizard module tree and updating all onboarding imports.
- `npm --prefix frontend run lint`
  - Passed after formatting the new onboarding picker and app entrypoint.
- `npm --prefix frontend run storybook:build`
  - Passed after removing the old onboarding stories and updating the picker stories.
- `npm --prefix frontend test -- --runTestsByPath tests/components/onboarding/OnboardingProviderPicker.test.tsx tests/features/plaid/components/ProviderSelectionPanel.test.tsx`
  - Passed after adding the provider connect surface and SimpleFIN token-entry path under the picker.
- Browser verification at `http://localhost:8080`
  - Blocked: no server was listening on port 8080 in this environment.

---

## Phase 6 — Frontend: Accounts page picker fallback + auto-disconnect handoff

**Goal:** The AccountsPage shows the provider picker whenever the user has no active provider (`user.provider === ''`) or has zero active connections for their current provider. After disconnecting the last bank, the picker reappears automatically.

**Tasks:**

- Update [frontend/src/views/AccountsPage.tsx](frontend/src/views/AccountsPage.tsx):
  - Compute `hasActiveConnections` from `banksWithSync.filter(b => b.status === 'connected')`.
  - Compute `needsProviderPick = providerCatalog.userProvider == null || !hasActiveConnections`.
  - When `needsProviderPick` is true and we're not loading: render the same `ProviderSelectionPanel` (with the catalogue wired in) as the page's primary empty state, replacing the current "Add account" / `ConnectionsList` fallback for that branch.
  - When the user picks a provider here, call `providerCatalog.chooseProvider(...)` — after success, the standard connect affordances (Add account, or SimpleFIN token entry for the SimpleFIN case) appear because `userProvider` is now set and `hasActiveConnections` is still false.
  - Leave the existing SimpleFIN token-entry and ignored-institutions empty states intact — they apply *after* SimpleFIN has been picked.
- Update or remove the AccountsPage `primaryProvider` fallback chain (currently falls back to `'plaid'` if nothing is set) — when `userProvider` is null, do not pretend a provider is selected; defer to the picker.
- Add tests in `frontend/tests/views/AccountsPage.test.tsx` (or equivalent):
  - Brand-new account with no `user_provider`: picker is shown.
  - User who picked Teller and disconnected all banks: picker is shown.
  - User with active connections: picker is **not** shown (regular connections view).

**Acceptance criteria:**

- [ ] Browser test at [http://localhost:8080](http://localhost:8080): from a "Skip for now" user, navigating to /accounts shows the picker. Selecting SimpleFIN there transitions seamlessly to the SimpleFIN token entry (same page).
- [ ] Browser test: with an existing user who has Teller banks, disconnect each bank in turn. After the final disconnect, the page state updates to the picker (no full reload needed).
- [x] With active connections present, the picker is not rendered.
- [ ] Attempting to pick a provider while active connections still exist for a different provider surfaces the backend 409 message in the UI.
- [x] `npm --prefix frontend test` passes.

**TDD log:**

- `npm --prefix frontend test -- tests/views/AccountsPage.test.tsx`
  - 3 new picker-fallback tests added (red → green). Existing tests updated to include connected banks where needed to avoid triggering the picker when testing normal-page features.
- `npm --prefix frontend test` — 715 tests passed.
- `npm --prefix frontend run typecheck` — passed.
- `npm --prefix frontend run lint` — passed (auto-fixed import order).
- Also fixed in this phase:
  - `TellerConnectSdk` and `PlaidLinkSdk` refactored to use refs for SDK instance instead of state, eliminating `flushSync` inside `useEffect` async callbacks (source of 10x console warning on accounts page load).
  - SimpleFIN modal `connectionMount` was missing → fixed "Connection is not ready" error on connect.
  - SimpleFIN modal `connectionMount` was missing → fixed "Connection is not ready" error on connect.

---

## Phase 7 — Docs + cleanup

**Goal:** Architecture docs reflect the new model; stale references to a system-wide default provider are removed.

**Tasks:**

- Update [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md):
  - Replace the section that describes `DEFAULT_PROVIDER` as system-wide with: "Each user picks an active provider via the onboarding picker (or the AccountsPage empty state). `DEFAULT_PROVIDER` is no longer required and is ignored if set."
  - Note that switching is allowed only when the user has zero active connections.
- Update [CONTRIBUTING.md](CONTRIBUTING.md) and any `.env.example` notes that imply `DEFAULT_PROVIDER` is required — mark it optional / unused.
- Search the repo (`rg -i "DEFAULT_PROVIDER"`) and remove or update any remaining mentions in code comments, README files, or docs.
- Confirm the regenerated OpenAPI (`backend/openapi/`, `docs/OPENAPI.json`) is committed.

**Acceptance criteria:**

- [ ] `rg -i "DEFAULT_PROVIDER"` returns only intentional references in documentation that explain it is no longer required.
- [ ] `docs/ARCHITECTURE.md` matches the new model on a careful read.
- [ ] `CONTRIBUTING.md` and `.env.example` (if present) no longer suggest `DEFAULT_PROVIDER` is required.

---

## End-to-end verification (after all phases)

Run all of these manually before declaring done:

- [ ] Fresh boot with **no** provider credentials configured → app starts; SimpleFIN registers; picker shows SimpleFIN enabled, Teller + Plaid disabled.
- [ ] Fresh boot with Teller creds only → Teller + SimpleFIN enabled, Plaid disabled.
- [ ] Fresh boot with all three → all three enabled.
- [ ] Register → onboarding picker only → pick Teller → Continue → land on dashboard → /accounts shows "Add account" affordance.
- [ ] Register → onboarding picker only → Skip for now → /accounts shows picker → pick SimpleFIN → SimpleFIN token entry appears.
- [ ] Existing user with active Teller bank: `/providers/select { plaid }` returns 409.
- [ ] Same user disconnects last Teller bank → AccountsPage picker reappears → picks Plaid → `/providers/select` returns 200.
- [ ] `npm --prefix frontend test` and `cargo test --manifest-path backend/Cargo.toml --locked` both pass.
- [ ] `npm --prefix frontend run typecheck`, `npm --prefix frontend run lint`, and `cargo clippy --manifest-path backend/Cargo.toml --locked -- -D warnings` (or the project's clippy command) all clean.
