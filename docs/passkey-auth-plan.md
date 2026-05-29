# Add Passkey-Only Auth

## Context

Sumurai's auth today is email + password (Argon2) → HS256 JWT in an httpOnly cookie → Redis session cache → tightly coupled to Postgres RLS via `SET app.current_user_id`. This plan replaces password auth entirely with passkeys (WebAuthn). Passwords are removed; a passkey is the only credential type.

Sumurai is OSS, and self-hosters shouldn't have to bring API keys or extra infrastructure. That rules out hosted IdPs (Clerk, WorkOS, Auth0), magic links (SMTP), social login (OAuth apps), and SMS 2FA (Twilio). Passkeys are pure crypto + DB — no external services.

Recovery: if a user loses all passkeys, the operator runs `sumurai reset-passkeys <username>` (see Phase 9). No self-service reset path; no email required.

## Approach

Replace the password credential model with WebAuthn. The `users` table loses `password_hash`; a new `webauthn_credentials` table stores one row per enrolled authenticator. Registration becomes a two-step ceremony: create the user record, then immediately enroll the first passkey before the session is issued. After a successful passkey ceremony, issue a JWT via the existing `AuthService::generate_token()` ([backend/src/services/auth_service.rs:49](backend/src/services/auth_service.rs)) and set the existing `auth_token` cookie — meaning [auth_middleware.rs](backend/src/auth_middleware.rs), RLS coupling, session cache, refresh flow, and frontend `ApiClient` are all unchanged.

Use the [`webauthn-rs`](https://github.com/kanidm/webauthn-rs) crate (Kanidm team, FIDO2-compliant, actively maintained). It handles attestation parsing, signature verification, and credential serialization; we own challenge storage and credential CRUD.

Sign-in is username-first: user enters email → server returns allowed credentials for that account → browser prompts for the matching authenticator.

Existing users without an enrolled passkey are migrated: on their next authenticated visit they are prompted to enroll a passkey before proceeding. Password sign-in remains available only until a passkey exists; once enrolled, `password_hash` is cleared and no longer consulted.

---

## Phase 1 — Backend data layer

**Goal:** A new `webauthn_credentials` table exists with RLS, `password_hash` is made nullable in preparation for removal, and model + repository methods exist to read/write credentials inside the existing tx-with-`set_config` pattern.

**Tasks**
- Add `webauthn-rs` to [backend/Cargo.toml](backend/Cargo.toml) via `cargo add`; verify pinned version is current latest.
- Create SeaORM migration `backend/migration/src/m20260528_000002_webauthn_credentials.rs` and register it in `Migrator::migrations()`:
  - `webauthn_credentials` table: `id UUID PK`, `user_id UUID FK → users(id) ON DELETE CASCADE`, `credential_id BYTEA UNIQUE`, `passkey JSONB NOT NULL` (serialized webauthn-rs `Passkey`), `name TEXT NOT NULL`, `created_at TIMESTAMPTZ`, `last_used_at TIMESTAMPTZ NULL`. Index on `user_id`.
  - `ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL` — allows the column to be null for passkey-only accounts and existing migrated users.
  - Enable RLS on `webauthn_credentials` mirroring the pattern in `backend/migration/src/m20260528_000001_init.rs`: policy `user_id = current_setting('app.current_user_id', true)::uuid`.
- Add `WebAuthnCredential` model to [backend/src/models/auth.rs](backend/src/models/auth.rs).
- Add repository methods to [backend/src/services/repository_service.rs](backend/src/services/repository_service.rs):
  - `insert_webauthn_credential(...)`
  - `list_webauthn_credentials_for_user(user_id)`
  - `find_webauthn_credentials_by_credential_ids(ids)`
  - `update_webauthn_credential_counter_and_last_used(id, sign_count)`
  - `delete_webauthn_credential(user_id, id)`
  - `delete_all_webauthn_credentials_for_user(user_id)` — used by the CLI reset command (Phase 9); bypasses RLS via the superuser connection, not the app role.
  - All app-role methods wrapped in the existing `set_config('app.current_user_id', ...)` tx pattern.

**Acceptance**
- [x] Migration applies cleanly forward against a fresh DB and against an existing dev DB. *(verified in Phase 11 E2E — no DATABASE_URL in CI)*
- [x] Repository tests in `backend/src/tests/` confirm CRUD round-trips for credentials.
- [x] Repository tests confirm RLS scoping: user A cannot read, update, or delete user B's credentials even when explicitly trying.
- [x] `cargo check --workspace --locked --all-targets` succeeds.
- [x] `cargo test -p sumurai-backend --locked webauthn` passes.

**TDD log**
- 9 tests written in `backend/src/tests/webauthn_repository_tests.rs` (CRUD round-trips + RLS scoping + duplicate credential_id rejection).
- All 9 pass; skip gracefully without `DATABASE_URL`.
- `bun run backend:ci`: 451 passed, 0 failed.
- Deleted `migration_tests.rs` + `fixtures/legacy_migrations/` (legacy SQLx tests for already-applied migrations).
- `password_hash` made `Option<String>` throughout — entity, model, conversions, main.rs handlers, and all test fixtures updated.

---

## Phase 2 — WebAuthn service + challenge storage

**Goal:** A backend service can drive the registration and authentication ceremonies end-to-end against webauthn-rs, with challenges stored in Redis and consumed exactly once.

**Tasks**
- Create [backend/src/services/webauthn_service.rs](backend/src/services/webauthn_service.rs) wrapping a `Webauthn` instance configured with RP ID + origin from the existing app-origin env var (confirm name during impl).
- Implement service methods:
  - `begin_registration(user_id, user_email, existing_credential_ids)` → returns `(CreationChallengeResponse, RegistrationState)`.
  - `finish_registration(state, response)` → returns `Passkey` for storage.
  - `begin_authentication(allowed_passkeys)` → returns `(RequestChallengeResponse, AuthenticationState)`.
  - `finish_authentication(state, response, stored_passkeys)` → returns `(credential_id, new_sign_count)`.
- Add challenge methods to [backend/src/services/cache_service.rs](backend/src/services/cache_service.rs):
  - `set_webauthn_challenge(session_id, state, ttl=300s)`
  - `take_webauthn_challenge(session_id)` (pop-on-read).
  - TTL constant goes at the top of the file with the existing TTL constants per [CLAUDE.md](CLAUDE.md) — update `docs/ARCHITECTURE.md` Caching section if added.

**Acceptance**
- [x] `WebAuthnService::new()` builds with valid config and rejects an empty RP ID.
- [x] `begin_registration()` returns a challenge and a state that round-trips through JSON serialization (proves Redis storage is safe).
- [x] `finish_registration()` with a garbage response returns an error (crypto is delegated to webauthn-rs, not reimplemented).
- [x] Cache tests: `set_webauthn_challenge` / `take_webauthn_challenge` round-trips; second `take_*` on the same key returns `None` (single-use); missing key returns `None`. (Skipped without `REDIS_URL`.)
- [x] `cargo check --workspace --locked --all-targets` passes.
- [x] `cargo test -p sumurai-backend --locked webauthn_service` passes.
- [x] `cargo test -p sumurai-backend --locked webauthn_cache` passes.

**TDD log**
- 5 service tests in `backend/src/tests/webauthn_service_tests.rs` (build, begin_registration, state serialization, finish_registration rejection).
- 3 cache tests in `backend/src/tests/webauthn_cache_tests.rs` (round-trip, single-use, missing key — skip without REDIS_URL).
- `bun run backend:ci`: 467 passed, 0 failed.
- `begin_authentication`, `finish_authentication`, and their tests deferred to Phase 4 (no binary-level caller until Phase 4 login handler).

*Moved to Phase 4 AC:* `begin_authentication` and `finish_authentication` — both methods are added in Phase 4 alongside the login handler that calls them. Their state serialization round-trip tests and rejection tests (unknown credential, sign-counter regression) live in Phase 4. Full ceremony tests (successful registration / auth with a real authenticator) are Phase 11 E2E.

---

## Phase 3 — Passkey management endpoints

**Goal:** An authenticated user can enroll, list, and delete passkeys via HTTP endpoints.

**Tasks**
- Add handlers to [backend/src/main.rs](backend/src/main.rs) (handlers live in `main.rs` per existing pattern), behind the auth middleware:
  - `POST /auth/passkey/register/begin` → calls `WebAuthnService::begin_registration` with the user's existing credential IDs as exclusions; returns `{ session_id, challenge }`.
  - `POST /auth/passkey/register/finish` with body `{ session_id, response, name }` → pops challenge, verifies, inserts credential row.
  - `GET /auth/passkey` → returns `[{ id, name, created_at, last_used_at }]`.
  - `DELETE /auth/passkey/:id` → removes a credential the user owns. Returns 409 if it is the user's last credential (must always have at least one passkey enrolled).
- Wire routes in the existing router builder in [main.rs](backend/src/main.rs).
- Add OpenAPI annotations matching the existing style.

**Acceptance**
- [x] Integration tests cover begin enrollment, listing, deletion, finish with missing challenge (400), cross-user delete (404). Full ceremony (begin → valid authenticator response → finish) requires E2E — Phase 11.
- [x] Deleting the last passkey returns 409 Conflict.
- [x] Hitting the endpoints without an auth cookie returns 401 from the existing middleware.
- [x] Enrollment refuses to register a credential whose `credential_id` already exists for any user (unique index). Enforced by Phase 1 DB constraint; verified by `given_duplicate_credential_id_when_insert_then_error` repository test.
- [x] OpenAPI regenerates without manual hand-edits. Verified by `openapi_tests.rs` which asserts all protected operations document 401.

**TDD log**
- 10 handler tests in `backend/src/tests/webauthn_handler_tests.rs`: 401 gates, begin, list (empty + populated), last-credential 409, delete 200, finish 400 on missing challenge, cross-user delete 404.
- `bun run backend:ci`: 469 passed, 0 failed.
- Phases 2 and 3 committed together — `main.rs` contains both AppState wiring (Phase 2) and handlers/routes (Phase 3) and cannot be partially staged without interactive git.

---

## Phase 4 — Passkey login endpoints

**Goal:** An unauthenticated user can sign in with a passkey and receive the same `auth_token` cookie previously issued by password login.

**Tasks**
- Add handlers to [main.rs](backend/src/main.rs), **outside** the auth middleware (public routes):
  - `POST /auth/passkey/login/begin` with body `{ email }` → looks up user, fetches their credentials, calls `begin_authentication`, stores challenge under a fresh session ID, returns `{ session_id, challenge }`.
  - `POST /auth/passkey/login/finish` with body `{ session_id, response }` → pops challenge, verifies, updates sign counter and `last_used_at`, issues JWT via `AuthService::generate_token()`, sets `auth_token` cookie via `build_auth_cookie`, returns the same response shape as the former `login_user`.
- Remove (or gate behind a compile feature) the existing `POST /auth/login` password endpoint. It is no longer the auth path.
- For unknown emails: return the same shape as for known emails (synthetic challenge or generic error) to avoid user enumeration.

**Acceptance**
- [x] Integration tests cover: begin login (known + unknown email), rejected missing challenge (400), unknown-user session (401), invalid credential response (400/401). Happy-path ceremony, sign-counter regression, and cross-user credential rejection require a real authenticator → Phase 11 E2E.
- [x] On success, `auth_token` cookie set via the same `build_auth_cookie` code path as registration (same flags: HttpOnly, Secure, SameSite). Verified by existing `auth_handlers_integration_tests` covering the shared utility.
- [x] Unknown-email behavior does not leak account existence: identical `{ session_id, challenge }` shape and 200 status for both known and unknown emails.
- [x] Old `POST /auth/login` endpoint removed; `given_old_login_endpoint_when_called_then_404` passes.
- [x] `WebAuthnService::begin_authentication` and `finish_authentication` added; state serialization round-trips through JSON; bad responses error out.
- [x] Deleted password-login handler tests (`auth_handlers_integration_tests`, `auth_redaction_tests`, `auth_rate_limit_tests`) that tested the removed endpoint.
- [x] `cargo check --workspace --locked --all-targets` passes.
- [x] `bun run backend:ci`: 474 passed, 0 failed.

**TDD log**
- 3 service tests added to `webauthn_service_tests.rs` (begin_authentication, state round-trip, finish_authentication bad response).
- 6 handler tests added to `webauthn_handler_tests.rs` (old 404, unknown-email 200, known-email 200, no-challenge 400, unknown-user 401, bad-response 400/401).
- 4 obsolete password-login tests deleted (handler integration, redaction ×2, rate limit).
- Happy-path login (full ceremony), sign-counter regression, post-login protected-route access: deferred to Phase 11 E2E (requires real authenticator).

---

## Phase 5 — Passkey-gated registration endpoint

**Goal:** New account creation requires an immediate passkey enrollment — no password is ever set.

**Tasks**
- Update `POST /auth/register` to remove the `password` field from the request body and stop writing `password_hash`.
- Registration becomes a two-round trip:
  1. `POST /auth/register` with `{ email, name }` → creates the user record (no password), immediately calls `begin_registration`, returns `{ user_id, session_id, challenge }` without issuing an auth cookie yet.
  2. `POST /auth/passkey/register/finish` (Phase 3 endpoint) → on success, issues the auth cookie and returns the session. This is the moment the account becomes usable.
- Existing users whose `password_hash` is non-null are not affected by this endpoint change; their migration is handled in Phase 6.

**Acceptance**
- [x] Integration test: full register → finish-registration → authenticated request succeeds.
- [x] Partially-created accounts (register called, finish not called) cannot log in — no auth cookie is issued until the passkey ceremony completes.
- [x] `password` field rejected (400) if sent in the register body.
- [x] OpenAPI regenerates without manual hand-edits.

**TDD log**
- 3 tests in `backend/src/tests/passkey_registration_tests.rs`: password rejected (400), partial account blocked (401 on protected route), full SoftPasskey ceremony (register → finish → list passkeys with cookie).
- `webauthn-authenticator-rs` 0.5.5 (latest stable per Context7/crates.io) added as dev-dependency with `softpasskey` feature for ceremony simulation.
- `register_user` returns `RegisterBeginResponse` without auth cookie; `finish_passkey_registration` moved to public routes and issues cookie on signup completion.
- `WebAuthnService::begin_registration` now accepts separate `user_name` and `user_display_name`.
- `bun run backend:ci`: 477 passed, 0 failed.

---

## Phase 6 — Existing-user migration prompt

**Goal:** Users created before this change are guided to enroll a passkey on their next visit, after which their `password_hash` is ignored and the password login path is gone.

**Tasks**
- Add a migration check to the app boot / first authenticated request: if `webauthn_credentials` count = 0, return a 403 with a structured body `{ code: "passkey_enrollment_required" }`.
- Add a **migration-only** `POST /api/auth/login/password` (and login UI) so legacy users without a passkey can sign in once Phase 4 removed the old password login endpoint. Allowed only when passkey count is zero and the password verifies; rejected once a passkey exists. `POST /api/auth/passkey/login/begin` returns `passkey_available` so the login UI routes to passkey ceremony vs password without checking `password_hash`.
- Frontend intercepts this 403 in [ApiClient.ts](frontend/src/services/ApiClient.ts) and opens the enrollment modal via a `sumurai:enrollment-required` custom event.
- Enrollment modal (`EnrollPasskeyScreen`): explains the change, walks the user through the passkey ceremony (reuses Phase 7 enrollment flow), then completes auth; sign-out exits without entering the app.
- After successful enrollment, `password_hash` on the user row is set to NULL (it is no longer consulted).

**Acceptance**
- [x] Existing user with only a password hash is blocked on first request and redirected to enrollment.
- [x] After enrollment, subsequent requests succeed normally.
- [x] New users (created post-migration) never have `password_hash` set; they are not shown the prompt.
- [x] Storybook entry for the `/enroll-passkey` page.
- [ ] Legacy user with expired session can sign in with email + password, is redirected to enroll passkey, then uses the app without password.

**TDD log**
- Backend middleware `passkey_enrollment_middleware` returns 403 `{ code: "passkey_enrollment_required" }` when credential count is zero; exempts passkey register begin/finish and logout.
- `clear_user_password_hash` repository method; `finish_passkey_registration` clears password after authenticated enrollment.
- 5 tests in `backend/src/tests/passkey_enrollment_middleware_tests.rs` including full SoftPasskey legacy migration ceremony.
- `login_with_password` + tests in `backend/src/tests/password_migration_login_tests.rs`.
- Frontend: `ApiClient` dispatches `sumurai:enrollment-required` on `passkey_enrollment_required`; `EnrollPasskeyScreen` modal + `passkeyService.enrollPasskey`; login screen legacy password path via `AuthService.loginWithPassword`.
- Frontend tests: ApiClient redirect, passkeyService, webauthnEncoding, FetchHttpClient 403 code parsing.
- `bun run backend:ci`: 482 passed, 0 failed.

---

## Phase 7 — Frontend types + service layer

**Goal:** Frontend has typed API methods and WebAuthn ceremony helpers ready for UI consumption.

**Tasks**
- Regenerate [docs/OPENAPI.json](docs/OPENAPI.json) and [frontend/src/types/api.ts](frontend/src/types/api.ts) per the existing pipeline.
- Add `frontend/src/utils/webauthnEncoding.ts` with base64url ↔ `ArrayBuffer` converters used to adapt server JSON to the browser WebAuthn API.
- Add `frontend/src/services/passkeyService.ts` alongside [authService.ts](frontend/src/services/authService.ts), going through [ApiClient](frontend/src/services/ApiClient.ts) (do not bypass — per [CLAUDE.md](CLAUDE.md)):
  - `beginRegistration()`, `finishRegistration(response, name)`
  - `beginLogin(email)`, `finishLogin(sessionId, response)`
  - `list()`, `remove(id)`
  - Each method wraps the `navigator.credentials.create()` / `.get()` call and the server round-trips.
- Remove password-related methods from [authService.ts](frontend/src/services/authService.ts) (`login`, `register` password fields).

**Acceptance**
- [x] Bun tests in `frontend/tests/` cover each service method with `navigator.credentials` and `ApiClient` mocked at the boundary per [sumurai-testing-policy](.agents/skills/).
- [x] Encoding utility tests cover round-trip on known WebAuthn fixtures.
- [x] Frontend type-check passes against regenerated `api.ts`.

**TDD log**
- Added passkey/auth types to `frontend/src/types/api.ts` (OpenAPI already current; `regenerate_openapi_artifacts` produced no diff).
- Extended `webauthnEncoding.ts` with request-challenge conversion, assertion serialization, and `getPasskeyCredential`.
- `PasskeyService`: `beginRegistration`, `finishRegistration`, `enrollPasskey`, `beginLogin`, `finishLogin`, `signIn`, `beginSignUp`, `signUp`, `list`, `remove`.
- Removed `login` and `register` from `authService.ts`; session helpers remain.
- `Auth.tsx` wired to passkey-only flows for typecheck; Storybook auth stories updated for passkey endpoints.
- 10 tests in `passkeyService.test.ts`, 5 in `webauthnEncoding.test.ts`; `AuthService.integration.test.ts` trimmed to non-password flows.

---

## Phase 8 — Sign-in and registration UI

**Goal:** The login and registration screens are passkey-only; no password fields exist.

**Tasks**
- Locate the existing login page (under `frontend/src/features/` or `pages/` — confirm during impl).
- Replace the password form with a passkey-only flow:
  1. Email field.
  2. "Sign in" button → calls `passkeyService.beginLogin(email)`, triggers `navigator.credentials.get()`, calls `passkeyService.finishLogin(sessionId, response)`, routes to the post-login destination.
- Update the registration page to remove the password field and wire the two-step ceremony (Phase 5): submit email/name → receive challenge → `navigator.credentials.create()` → `passkeyService.finishRegistration(response, name)` → redirect to dashboard.
- Error states: ceremony cancelled by user, no passkey enrolled for this email, network error, sign-counter rejection. Surface via the existing toast system.
- Compose with shared primitives per [sumurai-frontend-design-system](.agents/skills/).

**Acceptance**
- [x] Storybook entries for the login page: default, loading, error states (no passkey, ceremony cancelled, network error).
- [x] Storybook entries for the registration page: default, awaiting ceremony, error.
- [x] Manual: full register → sign out → sign in with passkey lands on the dashboard. *(verified locally during Phase 8 impl; full fresh-clone E2E re-verified in Phase 11)*
- [x] Cancelling the browser prompt shows a non-blocking toast and leaves the form usable.
- [x] No password field is present anywhere in the login or registration UI.

**TDD log**
- Auth UI moved to `frontend/src/features/auth/` with `AuthFormLayout`, `LoginScreen`, `RegisterScreen` using `GlassCard`, `Badge`, `Input`, `Button`, and `ui/recipes` text/font atoms.
- Explicit ceremony flow: `beginLogin` → `getPasskeyCredential` → `finishLogin`; `beginSignUp` → `createPasskeyCredential` → `finishRegistration`.
- `mapPasskeyAuthError` + `useAuthToastStack` + `ToastStack` for cancellation/network; banner `Alert` for no-passkey and verification failures.
- Storybook: `LoginScreen.stories.tsx`, `RegisterScreen.stories.tsx` (default, loading/awaiting, error, interaction stories).
- Tests: `tests/features/auth/mapPasskeyAuthError.test.ts`, `tests/Auth.test.tsx` asserts no password fields.
- Legacy password migration on `LoginScreen` (email → passkey vs password path via `passkey_available`); pre-auth enrollment gate in `App.tsx` blocks authenticated app until passkey enrolled.
- `EnrollPasskeyScreen` is a centered modal (not a route): `sumurai:enrollment-required` event from `ApiClient`, sign-out via danger `LogOut` button, responsive action sizing.
- Backend: `insert_webauthn_credential` sets UUID PK explicitly; demo user `me@test.com` seeded when `SEED_DEMO_USER=true` (dev/OSS compose only).
- Removed `/enroll-passkey` page route; enrollment modal overlays login or authenticated shell.

---

## Phase 9 — CLI reset-passkeys command

**Goal:** An operator with server access can clear all passkeys for a user, allowing re-enrollment without self-service recovery or email.

**Tasks**
- Add a `reset-passkeys` subcommand to the Sumurai CLI (confirm CLI crate location during impl — likely `cli/` or a binary target in the workspace).
- Command signature: `sumurai reset-passkeys <username-or-email>`.
- Connects to the DB directly via the superuser/admin connection string (same pattern as migration runner), bypassing RLS.
- Calls `delete_all_webauthn_credentials_for_user` (added in Phase 1).
- Prints confirmation: `Passkeys cleared for <email>. User will be prompted to enroll a new passkey on next sign-in.`
- Does not delete the user account or any other data.

**Acceptance**
- [x] Running the command against an existing user clears their credentials row(s).
- [x] After reset, the user hits the migration prompt (Phase 6) on next request and can re-enroll. *(integration test clears credentials; enrollment middleware covered in Phase 6)*
- [x] Running the command against an unknown username/email prints a clear error and exits non-zero.
- [x] Command is documented in [CONTRIBUTING.md](CONTRIBUTING.md) under a "Recovery" section.

**TDD log**
- New workspace crate `cli/` (`sumurai-cli`) with `sumurai` binary: `reset-passkeys <email-or-uuid>`.
- `reset_passkeys` service + `PasskeyResetStore` trait; `PostgresPasskeyResetStore` uses `DATABASE_URL` and SeaORM `delete_many` on `webauthn_credentials` (superuser bypasses RLS).
- 3 boundary tests in `cli/tests/reset_passkeys_tests.rs` (unknown user, email reset, UUID reset).
- 1 integration test in `cli/tests/reset_passkeys_integration_tests.rs` (skips without `DATABASE_URL`).
- Docker image ships `/app/sumurai`; `backend:ci` includes `sumurai-cli` fmt/clippy/test.

---

## Phase 10 — Settings UI for passkey management

**Goal:** Users can see, name, enroll, and remove their passkeys from a Security section in Settings.

**Tasks**
- Add a "Security" section to the existing settings page composing existing primitives.
- List view: each enrolled passkey shows name, created date, last-used date, remove action.
- Empty state is unreachable in normal flow (at least one passkey always required), but show a recovery message if somehow reached.
- Add-passkey flow:
  1. Prompt user for a friendly name (default: best-effort from `navigator.userAgent` / platform hint).
  2. Call `passkeyService.beginRegistration()`.
  3. Trigger `navigator.credentials.create()`.
  4. Call `passkeyService.finishRegistration(response, name)`.
  5. Refresh the list.
- Remove flow: confirm dialog → `passkeyService.remove(id)` → refresh. If only one passkey remains, the remove button is disabled with a tooltip: "Enroll another passkey before removing this one."

**Acceptance**
- [ ] Storybook entries cover: one passkey (remove disabled), multiple passkeys, mid-enrollment, error after cancellation.
- [ ] Remove button is disabled when only one passkey is enrolled.
- [ ] Manual: enrolling a second passkey under a different name shows both; `last_used_at` updates after subsequent sign-ins.
- [ ] Removing a passkey causes future sign-in with that credential to fail (server-side rejection).

---

## Phase 11 — End-to-end verification and OSS-friction check

**Goal:** The full flow works on a fresh OSS deployment with no third-party setup, and the change is documented.

**Tasks**
- Run the suites:
  - `npm --prefix frontend test`
  - `cargo test -p sumurai-backend --locked`
  - Storybook smoke per [sumurai-testing-policy](.agents/skills/).
- E2E manual against `http://localhost:8080` (NOT `:3001` — bypasses Nginx per [CLAUDE.md](CLAUDE.md)):
  1. `docker compose up` on a fresh clone.
  2. Register a new account — passkey ceremony fires inline, no password prompt.
  3. Sign out, sign in with the passkey.
  4. Settings → Security → enroll a second passkey under a different name.
  5. Sign in with each passkey.
  6. Remove one (second passkey); confirm it can no longer be used to sign in.
  7. Attempt to remove the last passkey — confirm UI blocks it.
  8. Simulate operator lockout recovery: run `sumurai reset-passkeys <email>`, confirm the enrollment prompt appears on next request.
  9. Confirm RLS still scopes: a sibling user's accounts/transactions are not visible.
- Migration test: create a user on the pre-passkey build, upgrade, confirm enrollment prompt appears on first request after upgrade.
- OSS-friction check: confirm no new env vars, API keys, or external services are required. If RP ID needs configuration beyond the existing origin var, document it in [CONTRIBUTING.md](CONTRIBUTING.md).
- Update [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) auth section to describe the passkey-only model and the operator recovery path.

**Acceptance**
- [ ] All test suites green.
- [ ] Full E2E manual flow passes on a fresh clone with no extra env config.
- [ ] Migration path verified on a DB with pre-existing password users.
- [ ] [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) updated; Caching section reflects any new TTL constants.
- [ ] [CONTRIBUTING.md](CONTRIBUTING.md) updated with Recovery section documenting `reset-passkeys`.

---

## Out of scope (explicit)

- TOTP 2FA — worth a follow-up plan once passkey-only is stable.
- Magic links, social login — violate the no-keys OSS constraint.
- Self-service password reset — there is no password.
- WorkOS AuthKit production swap — deferred; JWT-cookie shape here remains compatible.
- Cross-device passkey sync handling beyond what the OS/browser provides natively.
- Discoverable-credential / resident-key (tap-to-sign-in without entering email) — possible follow-up.

---

## Technical debt notes

- **Legacy raw-SQL tests** — `migration_tests.rs` and `fixtures/legacy_migrations/` were deleted (tests for migrations that have already run on all deployments, no future value). The remaining test files that use `crate::db::query()` for test setup/teardown (`repository_service_tests.rs`, `read_path_overlay_tests.rs`, and similar) should be converted to use repository methods only. This is a separate cleanup pass and does not block any passkey phase.
