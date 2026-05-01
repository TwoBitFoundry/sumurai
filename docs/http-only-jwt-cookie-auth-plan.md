# HttpOnly JWT Cookie Auth Backend Completion Plan

## Summary
Complete the backend side of the cookie-auth design so the JWT is stored only as the value of an httpOnly cookie named `auth_token`. The backend should set the cookie on login, register, and refresh; read it for protected routes, refresh, and logout; clear it on logout; and stop returning the JWT in JSON responses.

## Phase 1: Cookie Contract And Configuration
- Add the Rust `cookie` crate to `backend/Cargo.toml`, then run `cargo update` so `backend/Cargo.lock` uses current compatible versions.
- Extend backend config in `backend/src/config.rs` with:
  - `AUTH_COOKIE_SAME_SITE`, required, allowed values `Strict` and `Lax`
- Add a config getter for the same-site value. Derive the cookie `Secure` attribute from the mode, with `Strict` in production and `Lax` in dev. Reject missing or invalid `AUTH_COOKIE_SAME_SITE` values during config loading.
- Implement a small auth-cookie helper near the auth boundary, preferably in `backend/src/models/auth.rs` or a new backend auth utility module:
  - Build `Set-Cookie` for a JWT token value.
  - Build a clearing cookie with the same name/path and an expired or max-age-zero value.
  - Parse the JWT from a raw `Cookie` header.
  - Use `HttpOnly`, `Path=/`, `SameSite` from config, `Secure` derived from the same-site mode, and `Max-Age` derived from the JWT expiry.
  - Treat missing, empty, malformed, or duplicate unusable cookie values as no auth token.
- Keep the helper independent from business logic. It should not validate JWT signatures or touch Redis; that remains in `AuthService` and middleware.
- Update compose configuration:
  - Main `docker-compose.yml`: `AUTH_COOKIE_SAME_SITE=Strict`.
  - Add `docker-compose.dev.yml`: `AUTH_COOKIE_SAME_SITE=Lax`.
- Do not read or write `.env` files.

Acceptance criteria:
- `Config::from_env_provider` accepts valid `Strict`/`Lax` values and fails when `AUTH_COOKIE_SAME_SITE` is missing.
- Config tests cover valid cookie settings and missing or invalid `AUTH_COOKIE_SAME_SITE` failures.
- Cookie helper tests prove generated auth cookies include `auth_token=<jwt>`, `HttpOnly`, `Path=/`, configured `SameSite`, secure when strict, and a positive max-age.
- Cookie helper tests prove the clearing cookie clears the same cookie name/path and is expired or max-age-zero.
- Cookie helper tests prove parsing returns the JWT value from `Cookie: auth_token=<jwt>` and returns none for missing or empty values.
- Main compose and dev compose expose different secure/same-site defaults exactly as specified.

Completion notes:
- Added the `cookie` dependency and refreshed `Cargo.lock`.
- Extended backend config with the auth cookie mode setting.
- Simplified the auth cookie surface to one required mode env with `Strict` for production and `Lax` for dev.
- Added an auth-cookie helper for issuing, clearing, and parsing the cookie value.
- Updated compose defaults and test fixtures to supply the new config values.

TDD log:
- `cargo test auth_cookie_tests`
- `cargo test config_tests`
- `cargo check`
- `cargo test`
- `cargo fmt`

## Phase 2: Auth Endpoint Cookie Issuance
- Update `AuthResponse` in `backend/src/models/auth.rs`:
  - Remove the `token` field from serialized JSON and OpenAPI schema examples.
  - Keep `user_id`, `expires_at`, and `onboarding_completed`.
- Update login and register handlers in `backend/src/main.rs` to:
  - Generate/cache JWTs exactly as they do now.
  - Return `Set-Cookie: auth_token=<jwt>` with configured attributes.
  - Return only `user_id`, `expires_at`, and `onboarding_completed` in JSON.
  - Continue attaching the encrypted token hash to telemetry from the generated JWT.
- Update refresh handler to:
  - Read the current JWT from the auth cookie.
  - Validate refresh eligibility using existing refresh validation and session-cache checks.
  - Generate/cache a new JWT.
  - Return a replacement auth cookie and updated metadata.
  - Use the generated token's actual `expires_at` for both response metadata and cookie max-age.
- Update logout handler to:
  - Read the JWT from the auth cookie.
  - Validate and invalidate that token's `jti`.
  - Clear JWT-scoped cache data.
  - Return a clearing `Set-Cookie` header.
  - Preserve current behavior of clearing transaction cache on logout.
- Return `401` from refresh/logout when the auth cookie is missing or invalid.

Acceptance criteria:
- Login success response has status `200`, includes `Set-Cookie`, and the JSON body has no `token` property.
- Register success response has status `200`, includes `Set-Cookie`, and the JSON body has no `token` property.
- Refresh with a valid auth cookie returns status `200`, sets a replacement cookie, and returns updated metadata with no `token` property.
- Refresh with no auth cookie returns `401`.
- Logout with a valid auth cookie invalidates the current `jti`, clears JWT-scoped cache data, returns status `200`, and includes a clearing `Set-Cookie`.
- Logout with no auth cookie returns `401`.
- Existing session-validity and JWT-token cache writes still use the generated JWT `jti` and current TTL.

## Phase 3: Cookie-Only Middleware Enforcement
- Replace bearer-only extraction in `backend/src/auth_middleware.rs` with cookie-only extraction.
- Protected routes should authenticate only from `Cookie: auth_token=<jwt>`.
- Authorization headers alone should no longer authenticate.
- Preserve current error behavior for missing, empty, malformed, expired, wrong-secret, cache-invalid, or cache-error sessions.
- Keep existing trace token hashing and `AuthContext` attachment behavior after extracting the cookie value.
- Rename or replace helper functions/tests so the public test language refers to auth cookies, not bearer headers.
- Keep all tenancy and resource authorization behavior unchanged after `AuthContext` is attached.

Acceptance criteria:
- A protected route with a valid `Cookie: auth_token=<jwt>` and valid session cache returns success.
- A protected route with only `Authorization: Bearer <jwt>` returns `401`.
- A protected route with missing cookie returns `401` and the existing missing-auth error shape.
- A protected route with malformed, tampered, expired, wrong-secret, or cache-invalid cookie returns `401`.
- Middleware still inserts `AuthContext` with the expected `user_id` and `jwt_id` for valid cookie requests.
- Existing resource authorization tests continue to prove tenant boundaries after converting authenticated requests to cookies.

## Phase 4: API Types, Docs, And Tests
- Update backend test fixtures in `backend/src/tests/test_fixtures.rs` to create authenticated requests with `Cookie: auth_token=<jwt>`.
- Update all backend tests that build authenticated requests manually to use the cookie header.
- Update auth handler, auth middleware, integration, budget, balances overview, and security tests that currently assume bearer headers.
- Keep frontend tests out of scope unless backend API type changes break shared expectations.
- Add or update tests for:
  - Login/register set the cookie and do not return `token` in JSON.
  - Refresh reads the cookie and sets a replacement cookie.
  - Logout reads the cookie and returns a clearing cookie.
  - Protected routes accept valid auth cookies.
  - Missing/invalid cookies reject with `401`.
  - Authorization headers alone reject with `401`.
- Run `cargo test` and `cargo check`.

Acceptance criteria:
- `cargo check` passes.
- `cargo test` passes.
- No test depends on `Authorization` for authenticated backend requests except explicit negative tests proving bearer auth is rejected.
- OpenAPI schema/examples no longer document a `token` field in auth responses.
- No `.env` file is read or written.
- `git diff` shows the implementation scoped to backend auth/config/tests, compose configuration, and the saved plan if retained.

## Assumptions
- Cookie name is `auth_token`.
- The JWT itself is the cookie value.
- Strict mode uses `Secure=true`; Lax mode uses `Secure=false`.
- Backend auth is cookie-only after this change; bearer auth is not retained.
- Production uses `SameSite=Strict` and `Secure=true`.
- Local development uses the dev compose override with `SameSite=Lax` and `Secure=false`.
- No `.env` files are read or written.

## Risks
- Cookie attribute mismatches can make local dev appear unauthenticated even when login succeeds.
- Removing bearer auth requires updating all backend tests and any API clients that still depend on Authorization headers.
- `SameSite=Strict` is intentionally tight for production and may require revisiting only if production frontend/API deployment becomes cross-site.

## Next Actions
- Implement the cookie helper and config first, with tests around cookie formatting/parsing.
- Convert auth endpoints next so login/register/refresh/logout define the public contract.
- Convert middleware and fixtures last so protected-route tests validate the end-to-end cookie flow.
