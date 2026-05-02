# TBF-66 PII Telemetry Redaction Implementation Plan

## Goal

Remove raw email addresses from auth telemetry and backend auth failure logs while preserving enough correlation for debugging, abuse detection, and incident response.

## Source Ticket

Linear: TBF-66, `[TM-009] Remove email PII from OTLP traces and backend auth logs`

Threat model reference: `docs/sumurai-threat-model.md`, TM-009.

## Best-Practice Baseline

- Apply data minimization to telemetry: only emit fields needed for operation, debugging, and security monitoring.
- Treat email addresses as PII and keep them out of logs and trace attributes unless there is a documented legal, operational, and access-control reason.
- Prefer structured logs with stable non-PII fields over interpolated strings containing user input.
- Use OpenTelemetry semantic conventions where useful, but avoid raw `user.email`, `user.id`, or deprecated `enduser.id` when they contain identifiable values.
- Prefer a pseudonymous attribute such as `user.hash` or an opaque `session.id` when correlation is required.
- Do not rely only on collector-side redaction. Prevent sensitive values at source, then keep sanitizer settings enabled as defense in depth.

External guidance:

- OWASP Logging Cheat Sheet: sensitive personal data and some PII should usually be removed, masked, sanitized, hashed, or encrypted before being recorded in logs.
- OpenTelemetry sensitive data guidance: implementers are responsible for privacy compliance, and user identifiers should be deleted, hashed, or replaced with `user.hash` when raw values are sensitive.
- OpenTelemetry user attributes: `user.email` is explicitly available as a semantic attribute, while `user.hash` exists for anonymized correlation.

## Current State

- `frontend/src/services/authService.ts` no longer sets `auth.username` on login or registration spans.
- `frontend/tests/services/authService.test.ts` now asserts that submitted email values do not appear in auth span attributes.
- `backend/src/main.rs` now logs auth failures with structured fields and no email interpolation.
- Header and URL sanitization are enforced in the frontend telemetry pipeline and are not configurable through `NEXT_PUBLIC_*` environment variables, Docker build args, or compose build args.
- Existing frontend sanitization now covers headers, URLs, tokens, cards, SSNs, and email-like strings as a fallback.

## Implementation Approach

### Phase 1: Frontend Auth Span Pseudonymization

1. Replace `auth.username` on `AuthService.login` with a non-PII value.
2. Do not hash the submitted email client-side for failed login attempts. Email hashes are vulnerable to dictionary reversal because email address space is guessable.
3. Use an opaque per-attempt or per-browser auth correlation identifier for unauthenticated spans, such as `auth.attempt_id`.
4. After successful login or registration, if a stable user correlation value is required, derive it from the returned `user_id` and emit it only after the response is available as `user.hash` or `auth.user_hash`.
5. Keep `auth.method = password`.
6. Remove `auth.username` entirely unless a compatibility requirement is discovered. If compatibility exists, set it to a constant non-PII value such as `redacted`.

Recommended shape:

- Start span with `auth.method`.
- On success, set `user.hash` to a SHA-256 digest of the returned `user_id` plus a stable application-scoped salt if one already exists outside `.env`.
- If no safe salt source exists, use `user_id` only if it is already an opaque UUID and the telemetry access model permits linkable pseudonymous IDs. Prefer documenting this as linkable pseudonymous data.
- On failure, emit only `auth.result = failure` and `auth.failure_reason` values such as `invalid_credentials`, `server_error`, or `unknown_error`.

Files:

- `frontend/src/services/authService.ts`
- `frontend/tests/services/authService.test.ts`

Test updates:

- Update the login span test to assert that span attributes do not contain `auth.username` or the submitted email.
- Add a failure-path test that verifies failed login telemetry does not contain the email.
- Update the registration span test the same way.
- Keep the existing password exclusion test and extend it to assert no `email`, `user.email`, or `auth.username` value is present.

Status: completed

TDD log:

- `npm test -- --runTestsByPath tests/services/authService.test.ts` passed.

### Phase 2: Backend Auth Log Redaction

1. Replace interpolated email log messages in `backend/src/main.rs` with structured logs that avoid email.
2. For registration conflict or creation failure, log `user_id` if already generated, plus an auth outcome and error class. Do not log `req.email`.
3. For non-existent login user, log an auth failure event without a user identifier because no trusted user ID exists.
4. For login database errors before lookup, log the database error category and auth operation, but no email.
5. For invalid password, log the database user UUID from the fetched user record, not the submitted email.
6. Keep external responses unchanged so account enumeration behavior does not change.

Recommended structured fields:

- `auth_operation = "register" | "login"`
- `auth_result = "failure"`
- `failure_reason = "user_creation_failed" | "unknown_user" | "database_error" | "invalid_password"`
- `user_id = %user.id` only after a trusted user row exists
- `error = %e` only where the error does not contain raw request bodies or credentials

Files:

- `backend/src/main.rs`
- `backend/src/tests/auth_handlers_integration_tests.rs` or a focused backend test file under `backend/src/tests/`

Test updates:

- Add or extend backend tests around auth failures to ensure responses are unchanged.
- Add a log-capture unit or integration test only if the current test harness already supports tracing capture. If not, keep verification at code review plus repository search level to avoid introducing broad test infrastructure for a narrow logging fix.

Status: completed

TDD log:

- `cargo test auth_redaction_tests` passed.
- `cargo test` passed.

### Phase 3: Non-Configurable Sanitizer Enforcement

1. Keep header and URL sanitization as hardcoded telemetry behavior, not as environment-derived configuration.
2. Ensure the frontend Dockerfile does not define sanitizer `ARG` or `ENV` entries.
3. Ensure compose files do not pass sanitizer build args.
4. Always call span attribute sanitization from fetch and XHR instrumentation.
5. Consider also enforcing `NEXT_PUBLIC_OTEL_CAPTURE_BODIES=false` and `NEXT_PUBLIC_OTEL_BLOCK_SENSITIVE_ENDPOINTS=true` in the same production path because they protect the same telemetry boundary.
6. Do not read or write `.env` files.

Files:

- `frontend/src/observability/telemetry.ts`
- `frontend/Dockerfile`
- `docker-compose.yml`
- Any production-specific compose file if one is later discovered

Validation:

- Verify no references remain to sanitizer environment variables or sanitizer config fields in frontend source, Dockerfile, compose, or docs.
- Run Docker compose config rendering with placeholder environment values, without reading `.env`.
- Confirm rendered frontend build args no longer expose header or URL sanitizer controls.

Status: completed

TDD log:

- `npm test -- --runTestsByPath tests/services/authService.test.ts tests/observability/telemetry.test.ts tests/observability/telemetry.integration.test.ts` passed.
- `docker compose --env-file /dev/null -f docker-compose.yml config` rendered without sanitizer build args.

### Phase 4: Defense-in-Depth Sanitization

1. Add email pattern redaction to `frontend/src/observability/sanitization.ts` so accidental string attributes cannot export raw email.
2. Redact email-like values to `[EMAIL_REDACTED]`.
3. Keep this as a safety net, not the primary fix. The primary fix remains preventing `AuthService` from setting email attributes.

Files:

- `frontend/src/observability/sanitization.ts`
- `frontend/tests/observability/sanitization.test.ts`

Test updates:

- Add tests for direct email strings.
- Add tests for strings that contain both an email and existing token patterns.
- Add tests that URL sanitization does not preserve email in query values if query values are processed by string redaction fallback.

Status: completed

TDD log:

- `npm test -- --runTestsByPath tests/observability/sanitization.test.ts` passed.

### Phase 5: Verification and Release

Run local verification:

- `cd frontend && npm test -- --runTestsByPath tests/services/authService.test.ts tests/observability/sanitization.test.ts`
- `cd frontend && npm run lint`
- `cargo test`
- `cargo check`
- A repository search that excludes fixtures and docs where appropriate: no production code path should contain `auth.username` with email, `user.email` telemetry, or logging statements that interpolate `req.email`.

Status: partially complete

TDD log:

- `npm run lint` passed.
- `cargo check` passed.
- `cargo test` passed.
- Repository searches verified sanitizer toggles were removed from frontend code and build config.
- Deployment and Seq post-deployment checks remain pending because they require a deployed environment.

Run deployment verification:

- Deploy the build containing the change.
- Execute failed and successful login and registration flows with a known test email.
- Query Seq for the known test email across recent traces, logs, and event properties.
- Query Seq for common auth attributes: `auth.username`, `user.email`, `user.hash`, `auth.user_hash`, `auth.failure_reason`.
- Confirm no raw email appears in frontend traces or backend auth failure logs.
- Document the Seq query result in the ticket before closing it.

## Acceptance Criteria Mapping

- Replace `auth.username` email attribute: covered by Phase 1 and frontend tests.
- Redact backend auth failure logs: covered by Phase 2 and code search verification.
- Remove OTEL sanitizer flags as configurable options and keep sanitization always enabled: covered by Phase 3.
- Run Seq query post-deployment: covered by Phase 5.

## Risks and Tradeoffs

- Hashing emails is not sufficient anonymization because likely email values can be guessed and compared offline.
- Hashing UUID user IDs is better than hashing emails, but still linkable across events. Treat it as pseudonymous data, not anonymous data.
- Removing user correlation entirely improves privacy but makes incident triage harder. The balanced approach is no identifier before authentication and pseudonymous correlation only after a trusted user ID exists.
- Removing sanitizer configurability eliminates a runtime escape hatch. That is intentional for compliance-sensitive telemetry because header and URL sanitization should always be enabled.

## Definition of Done

- No frontend auth span includes a submitted email value.
- Backend auth failure logs do not include `req.email`.
- Header and URL sanitization cannot be disabled through frontend environment variables, Docker build args, or compose build args.
- Focused frontend and backend tests pass.
- Seq post-deployment verification finds no raw email values from the exercised auth flows.
