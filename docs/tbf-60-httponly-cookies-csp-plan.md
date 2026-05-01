# TBF-60 HttpOnly Auth Cookies And CSP

## Summary

Migrate Sumurai auth to one `sumurai_session` cookie per Sumurai user account while keeping the current signed JWT and Redis-backed `jti` session validity model. Remove browser-readable auth token storage, then add CSP allowlists for Teller and Plaid so the browser blocks unexpected scripts, frames, and SDK network calls.

## Phase 1: Backend Cookie Auth

- Status: complete
- Add cookie helpers for `sumurai_session`: create, clear, and parse.
- Use `HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=<ttl>` on login, register, and refresh.
- Change auth JSON responses to return only non-secret metadata: `user_id`, `expires_at`, and `onboarding_completed`.
- Update protected-route middleware, logout, and refresh to read the JWT from the cookie instead of `Authorization`.
- On refresh, validate the current cookie, generate a replacement JWT, store the new `jti`, invalidate the old `jti`, and set a replacement cookie.

### TDD Log

- `cargo test auth_middleware_tests -- --nocapture`
- `cargo test auth_handlers_integration_tests -- --nocapture`
- `cargo test`
- Result: all backend tests passed after migrating auth to cookies.

## Phase 2: Frontend Cookie Transport

- Update `FetchHttpClient` to send `credentials: "same-origin"` on all app API calls.
- Remove Authorization header injection from `ApiClient`.
- Keep 401 recovery, but have it call `/auth/refresh`, retry once with cookies, and never store returned tokens.
- Remove `auth_token` and `refresh_token` usage from `AuthService`, `BrowserStorageAdapter`, `Auth`, `App`, and `SessionManager`.
- Drive authenticated UI state from login/register/refresh metadata and protected API validation.

## Phase 3: CSP, Teller, And Plaid

- Add nginx `Content-Security-Policy` with explicit provider allowlists.
- Include Teller in `script-src`: `https://cdn.teller.io`.
- Include Plaid Link in CSP: `script-src` for `https://cdn.plaid.com`, `frame-src` for Plaid Link frame origins, and `connect-src` for app API origins plus Plaid/Teller browser SDK endpoints.
- Preserve required app allowances for self-hosted scripts, styles, API connections, images, and fonts.
- Add `integrity` and `crossOrigin="anonymous"` behavior to the dynamically-created Teller script.
- Do not add SRI to Plaid through `react-plaid-link` unless the implementation replaces the library loader with a controlled script loader; CSP is the required Plaid control for this ticket.

## Phase 4: Tests And Verification

- Backend tests cover cookie attributes, logout clearing, protected-route authentication, and refresh rotation.
- Frontend tests cover no token storage, credentialed API requests without `Authorization`, metadata-driven auth flows, and Teller script integrity attributes.
- Config checks assert nginx CSP includes Teller and Plaid allowlists.
- Run `cargo test`, `npm test`, and focused lint/type checks.

## Assumptions

- “Per account” means per Sumurai user account.
- Linked financial account authorization remains unchanged.
- No new package is required.
- OpenAPI should be updated from bearer auth to cookie auth for app routes.

## Risks

- Teller’s unversioned CDN script may change, which can invalidate a static SRI hash unless the script URL is pinned or the hash is maintained.
- Plaid Link may require additional documented frame or connect origins depending on environment.
- Strict cookies require same-site deployment through nginx; local direct cross-origin backend calls need the existing proxied `/api` path or explicit dev handling.

## Next Actions

- Implement backend cookie helpers and route changes first.
- Update frontend fetch/auth behavior against the new response contract.
- Add CSP and provider script controls.
- Update tests around the new cookie contract and run verification.
