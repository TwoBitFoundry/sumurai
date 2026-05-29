# Add Passkey Sign-In as an OSS-Friendly Auth Option

## Context

Sumurai's auth today is email + password (Argon2) → HS256 JWT in an httpOnly cookie → Redis session cache → tightly coupled to Postgres RLS via `SET app.current_user_id`. Clean and well-secured, but missing modern sign-in options.

Sumurai is OSS, and self-hosters shouldn't have to bring API keys or extra infrastructure. That rules out hosted IdPs (Clerk, WorkOS, Auth0), magic links (SMTP), social login (OAuth apps), and SMS 2FA (Twilio). It leaves two zero-friction additions: **passkeys (WebAuthn)** and **TOTP 2FA** — pure crypto + DB, no external services.

This plan covers **passkeys only**. Goal: users enroll one or more passkeys on their account and sign in with them as an alternative to password. Password login stays as the baseline. WorkOS AuthKit for production is deferred but not precluded — the JWT-cookie shape here remains compatible with a future JWKS-based middleware swap.

## Approach

Add WebAuthn as a parallel credential type. User record stays in the `users` table; a new `webauthn_credentials` table stores one row per enrolled authenticator. After a successful passkey ceremony, issue a JWT via the existing `AuthService::generate_token()` ([backend/src/services/auth_service.rs:49](backend/src/services/auth_service.rs)) and set the existing `auth_token` cookie — meaning [auth_middleware.rs](backend/src/auth_middleware.rs), RLS coupling, session cache, refresh flow, and frontend `ApiClient` are all unchanged.

Use the [`webauthn-rs`](https://github.com/kanidm/webauthn-rs) crate (Kanidm team, FIDO2-compliant, actively maintained). It handles attestation parsing, signature verification, and credential serialization; we own challenge storage and credential CRUD.

Sign-in is username-first: user enters email → server returns allowed credentials for that account → browser prompts for the matching authenticator. Resident-key / discoverable-credential flow is a possible follow-up.

---

## Phase 1 — Backend data layer

**Goal:** A new `webauthn_credentials` table exists with RLS, plus a model and repository methods to read/write credentials inside the existing tx-with-`set_config` pattern.

**Tasks**
- Add `webauthn-rs` to [backend/Cargo.toml](backend/Cargo.toml) via `cargo add`; verify pinned version is current latest.
- Create migration `036_webauthn_credentials.sql` with: `id UUID PK`, `user_id UUID FK → users(id) ON DELETE CASCADE`, `credential_id BYTEA UNIQUE`, `passkey JSONB NOT NULL` (serialized webauthn-rs `Passkey`), `name TEXT NOT NULL`, `created_at TIMESTAMPTZ`, `last_used_at TIMESTAMPTZ NULL`. Index on `user_id`.
- Enable RLS on the table mirroring the pattern in `backend/migration/src/m20260528_000001_init.rs`: policy `user_id = current_setting('app.current_user_id', true)::uuid`.
- Add `WebAuthnCredential` model to [backend/src/models/auth.rs](backend/src/models/auth.rs).
- Add repository methods to [backend/src/services/repository_service.rs](backend/src/services/repository_service.rs):
  - `insert_webauthn_credential(...)`
  - `list_webauthn_credentials_for_user(user_id)`
  - `find_webauthn_credentials_by_credential_ids(ids)`
  - `update_webauthn_credential_counter_and_last_used(id, sign_count)`
  - `delete_webauthn_credential(user_id, id)`
  - All wrapped in the existing `set_config('app.current_user_id', ...)` tx pattern.

**Acceptance**
- [ ] Migration applies cleanly forward against a fresh DB and against an existing dev DB.
- [ ] Repository tests in `backend/src/tests/` confirm CRUD round-trips for credentials.
- [ ] Repository tests confirm RLS scoping: user A cannot read, update, or delete user B's credentials even when explicitly trying.
- [ ] `cargo build --manifest-path backend/Cargo.toml --locked` succeeds.
- [ ] `cargo test --manifest-path backend/Cargo.toml --locked webauthn` passes.

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
- [ ] Service tests cover: successful registration ceremony, successful auth ceremony, rejected replay (challenge already consumed), rejected unknown credential, rejected sign-counter regression.
- [ ] Cache tests confirm challenges are single-use (second `take_*` returns `None`) and expire at TTL.
- [ ] No service method bypasses `webauthn-rs` for crypto — verification is delegated, not reimplemented.

---

## Phase 3 — Passkey registration endpoints

**Goal:** An authenticated user can enroll, list, rename(-via-recreate-is-fine), and delete passkeys via HTTP endpoints.

**Tasks**
- Add handlers to [backend/src/main.rs](backend/src/main.rs) (handlers live in `main.rs` per existing pattern), behind the auth middleware:
  - `POST /auth/passkey/register/begin` → calls `WebAuthnService::begin_registration` with the user's existing credential IDs as exclusions; returns `{ session_id, challenge }`.
  - `POST /auth/passkey/register/finish` with body `{ session_id, response, name }` → pops challenge, verifies, inserts credential row.
  - `GET /auth/passkey` → returns `[{ id, name, created_at, last_used_at }]`.
  - `DELETE /auth/passkey/:id` → removes a credential the user owns.
- Wire routes in the existing router builder in [main.rs](backend/src/main.rs).
- Add OpenAPI annotations matching the existing style.

**Acceptance**
- [ ] Integration tests in `backend/src/tests/` cover begin → finish enrollment, listing, deletion, and the cross-user case (user A cannot delete user B's credential — should 404 or 403, not succeed).
- [ ] Hitting the endpoints without an auth cookie returns 401 from the existing middleware.
- [ ] Enrollment refuses to register a credential whose `credential_id` already exists for any user (unique index).
- [ ] OpenAPI regenerates without manual hand-edits.

---

## Phase 4 — Passkey login endpoints

**Goal:** An unauthenticated user can sign in with a previously-enrolled passkey and receive the same `auth_token` cookie as a password login.

**Tasks**
- Add handlers to [main.rs](backend/src/main.rs), **outside** the auth middleware (public routes, same group as `login_user`):
  - `POST /auth/passkey/login/begin` with body `{ email }` → looks up user, fetches their credentials, calls `begin_authentication`, stores challenge under a fresh session ID, returns `{ session_id, challenge }`.
  - `POST /auth/passkey/login/finish` with body `{ session_id, response }` → pops challenge, verifies, updates sign counter and `last_used_at`, issues JWT via `AuthService::generate_token()`, sets `auth_token` cookie via `build_auth_cookie`, returns the same response shape as `login_user`.
- For unknown emails: return the same shape as for known emails (with a synthetic challenge or generic error) to avoid user enumeration. Match the privacy posture of the existing password login.

**Acceptance**
- [ ] Integration tests cover: happy-path login, rejected replay, rejected wrong-user credential, rejected unknown credential, sign-counter regression rejected.
- [ ] On success, response sets `auth_token` cookie with the same flags as the password path (HttpOnly, Secure, SameSite — confirm against `build_auth_cookie`).
- [ ] After passkey login, an authenticated request to an arbitrary protected endpoint succeeds (proves middleware + RLS still work).
- [ ] Unknown-email behavior does not leak account existence (response timing and shape comparable to known-email).

---

## Phase 5 — Frontend types + service layer

**Goal:** Frontend has typed API methods and WebAuthn ceremony helpers ready for UI consumption.

**Tasks**
- Regenerate [docs/OPENAPI.json](docs/OPENAPI.json) and [frontend/src/types/api.ts](frontend/src/types/api.ts) per the existing pipeline.
- Add `frontend/src/utils/webauthnEncoding.ts` with base64url ↔ `ArrayBuffer` converters used to adapt server JSON to the browser WebAuthn API.
- Add `frontend/src/services/passkeyService.ts` alongside [authService.ts](frontend/src/services/authService.ts), going through [ApiClient](frontend/src/services/ApiClient.ts) (do not bypass — per [CLAUDE.md](CLAUDE.md)):
  - `beginRegistration()`, `finishRegistration(response, name)`
  - `beginLogin(email)`, `finishLogin(sessionId, response)`
  - `list()`, `remove(id)`
  - Each method wraps the `navigator.credentials.create()` / `.get()` call and the server round-trips.

**Acceptance**
- [ ] Bun tests in `frontend/tests/` cover each service method with `navigator.credentials` and `ApiClient` mocked at the boundary per [sumurai-testing-policy](.agents/skills/).
- [ ] Encoding utility tests cover round-trip on known WebAuthn fixtures.
- [ ] Frontend type-check passes against regenerated `api.ts`.

---

## Phase 6 — Sign-in UI

**Goal:** A user with an enrolled passkey can sign in from the login screen without typing a password.

**Tasks**
- Locate the existing login page (under `frontend/src/features/` or `pages/` — confirm during impl).
- Add a "Sign in with a passkey" button under (or beside) the password form. Click flow:
  1. If email field is empty, focus it.
  2. Call `passkeyService.beginLogin(email)`.
  3. Trigger `navigator.credentials.get()` with the returned challenge.
  4. Call `passkeyService.finishLogin(sessionId, response)`.
  5. On success, route to the post-login destination (mirror the existing password-login redirect).
- Error states: ceremony cancelled by user, no passkey enrolled for this email, network error, sign-counter rejection. Surface via the existing toast system.
- Compose with shared primitives per [sumurai-frontend-design-system](.agents/skills/).

**Acceptance**
- [ ] Storybook entry for the login page shows password + passkey states (default, error, loading).
- [ ] Manual: signing in with a passkey on a real authenticator (Touch ID / Windows Hello / hardware key) lands on the dashboard.
- [ ] Cancelling the browser prompt shows a non-blocking toast, does not log the user out, leaves the form usable.
- [ ] Password login still works unchanged.

---

## Phase 7 — Settings UI for passkey management

**Goal:** Users can see, name, enroll, and remove their passkeys from a Security section in Settings.

**Tasks**
- Add a "Security" section to the existing settings page composing existing primitives.
- List view: each enrolled passkey shows name, created date, last-used date, remove action.
- Empty state: "No passkeys enrolled. Add one to sign in without a password."
- Add-passkey flow:
  1. Prompt user for a friendly name (default: best-effort from `navigator.userAgent` / platform hint).
  2. Call `passkeyService.beginRegistration()`.
  3. Trigger `navigator.credentials.create()`.
  4. Call `passkeyService.finishRegistration(response, name)`.
  5. Refresh the list.
- Remove flow: confirm dialog → `passkeyService.remove(id)` → refresh.

**Acceptance**
- [ ] Storybook entries cover: empty state, one passkey, multiple passkeys, mid-enrollment, error after cancellation.
- [ ] Manual: enrolling a second passkey under a different name shows both; `last_used_at` updates after subsequent sign-ins.
- [ ] Removing a passkey causes future sign-in with that credential to fail (server-side rejection).

---

## Phase 8 — End-to-end verification and OSS-friction check

**Goal:** The full flow works on a fresh OSS deployment with no third-party setup, and the change is documented.

**Tasks**
- Run the suites:
  - `npm --prefix frontend test`
  - `cargo test --manifest-path backend/Cargo.toml --locked`
  - Storybook smoke per [sumurai-testing-policy](.agents/skills/).
- E2E manual against `http://localhost:8080` (NOT `:3001` — bypasses Nginx per [CLAUDE.md](CLAUDE.md)):
  1. `docker compose up` on a fresh clone (or `git clean`-equivalent state).
  2. Register a new account with password.
  3. Settings → Security → enroll a passkey.
  4. Sign out, sign in with the passkey.
  5. Enroll a second passkey, sign in with each.
  6. Remove one; confirm it can no longer be used to sign in.
  7. Confirm RLS still scopes: a sibling user's accounts/transactions are not visible.
- OSS-friction check: confirm no new env vars, API keys, or external services are required to use passkey auth. If RP ID needs configuration (it shouldn't beyond the existing origin var), document it in [CONTRIBUTING.md](CONTRIBUTING.md).
- Update [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) auth section to describe the parallel credential model.

**Acceptance**
- [ ] All test suites green.
- [ ] Full E2E manual flow passes on a fresh clone with no extra env config.
- [ ] [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) updated; if cache TTLs changed, the Caching section reflects it.
- [ ] [CONTRIBUTING.md](CONTRIBUTING.md) updated only if a new config step is genuinely required (likely none).

---

## Out of scope (explicit)

- TOTP 2FA — same OSS-friendly properties, worth a follow-up plan.
- Magic links, social login — violate the no-keys OSS constraint.
- Passwordless / passkey-primary flow — password stays as the baseline this iteration.
- WorkOS AuthKit production swap — deferred; JWT-cookie shape here remains compatible.
- Cross-device passkey sync handling beyond what the OS/browser provides natively.
