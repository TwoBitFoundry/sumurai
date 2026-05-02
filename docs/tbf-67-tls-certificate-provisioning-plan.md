# TBF-67 TLS Certificate Provisioning Implementation Plan

## Ticket

Linear: TBF-67, `[TM-010] Document and guard TLS certificate provisioning in production`

## Goal

Prevent a production deployment from silently serving a development self-signed TLS certificate, and make certificate provisioning, expiry validation, and operational response explicit enough that production operators cannot reasonably treat certbot as optional.

## Current State

- `nginx/entrypoint.sh` defaults `DOMAIN` to `localhost`, creates `/etc/letsencrypt/live/${DOMAIN}`, and generates a 1-day development self-signed RSA certificate only when local certificate material is missing.
- `nginx/entrypoint.sh` now includes runtime mode and certificate validation helpers, emits the detected runtime mode, and can be sourced safely under `SUMURAI_ENTRYPOINT_TEST=1`.
- `docker-compose.yml` defines `certbot` behind the optional `certbot` profile.
- `docker-compose.yml` now passes `ENVIRONMENT` into nginx.
- `nginx/nginx.conf.template` expects certificates at `/etc/letsencrypt/live/${DOMAIN}/fullchain.pem` and `/etc/letsencrypt/live/${DOMAIN}/privkey.pem`.
- `nginx/nginx.conf.template` now includes CSP, HSTS, XFO, content-type, and referrer-policy headers, but these do not change the certificate provisioning gap.
- `docs/sumurai-threat-model.md` tracks the production risk as TM-010.
- `README.md` documents Teller mTLS host-to-container certificate paths, but there is still no production TLS guide that marks ACME provisioning and renewal as required for nginx.
- `nginx/healthcheck.sh` validates certificate presence, production trust, production expiry, and nginx `/healthz`.
- `docker-compose.yml` now mounts and runs `nginx/healthcheck.sh` for nginx health.

## Best-Practice Principles

- Fail closed in production when certificate trust is unsafe; warn-only behavior is acceptable for local development.
- Treat `localhost`, `127.0.0.1`, and explicit development mode as the only self-signed certificate paths.
- Separate runtime startup validation from documentation so the system has a technical guard even if runbooks are missed.
- Validate the active certificate material directly with `openssl`; do not infer safety only from file presence.
- Make certificate expiry observable through both startup logs and container health status.
- Keep certbot optional for local development but documented as mandatory for production deployment and renewal.

## Implementation Steps

### 1. Define Production Detection

Add a small shell helper in `nginx/entrypoint.sh` that classifies the runtime as production when either:

- `ENVIRONMENT=production`, if already used by the deployer, or
- `DOMAIN` is neither `localhost`, `127.0.0.1`, nor empty.

Use `DOMAIN != localhost` as the default ticket-compatible path, while allowing an explicit production variable to avoid ambiguity in future deployment targets. The nginx service now passes `ENVIRONMENT`, so the helper can read the deployment mode without more compose changes.

Completed on this branch:

- Added `runtime_mode` in `nginx/entrypoint.sh` with an `ENVIRONMENT` override plus domain-based fallback.
- Gated the entrypoint main path behind `SUMURAI_ENTRYPOINT_TEST=1` so shell tests can source the script safely.
- Passed `ENVIRONMENT` through the nginx service in `docker-compose.yml`.
- Added shell coverage for localhost, loopback, empty domain, and explicit production env overrides.

### 2. Add Certificate Inspection Helpers

Add shell functions in `nginx/entrypoint.sh` to inspect the active certificate:

- `certificate_exists`: verifies both certificate and key files are present and non-empty.
- `certificate_is_self_signed`: compares issuer and subject or runs `openssl verify` against the system trust store and treats self-issued development certificates as unsafe in production.
- `certificate_expires_within_days 14`: uses `openssl x509 -checkend 1209600 -noout -in "${FULLCHAIN}"`.
- `log_certificate_status`: emits domain, certificate path, self-signed status, and days-to-expiry without printing private key material.

Use structured, prominent log lines for production warnings, for example prefixing with `TLS_PROVISIONING_WARNING` or `TLS_PROVISIONING_ERROR`.

Completed on this branch:

- Added certificate existence, self-signed, expiry-window, and status logging helpers in `nginx/entrypoint.sh`.
- Added path overrides for testable certificate inspection without touching `/etc/letsencrypt`.
- Added shell coverage using generated self-signed and CA-signed certificates.

### 3. Preserve Development Bootstrapping

Keep the current self-signed fallback only for local development. Update the shell flow so:

- If certificate files are missing and runtime is development, generate the 1-day self-signed certificate.
- If certificate files are missing and runtime is production, exit non-zero with instructions to provision a real certificate before starting nginx.
- If certificate files exist but are self-signed in production, log a prominent error and exit non-zero.
- If certificate files exist but expire within 14 days in production, log a prominent error and exit non-zero.
- If certificate files expire within 14 days in development, log a warning but continue.

Completed on this branch:

- Added `validate_tls_certificate` to preserve local bootstrapping while failing closed in production.
- Production startup now fails for missing, self-signed, and soon-expiring certificate material.
- Development startup still generates a 1-day self-signed certificate when certificate material is missing.

### 4. Mark Development-Only Self-Signed Generation

Make the development-only intent visible at the point of risk while respecting the repository instruction to avoid adding source comments. Prefer explicit function names, guard variables, and log text such as `Generating development self-signed certificate for ${DOMAIN}` over adding new code comments. If strict ticket interpretation requires a source annotation, keep it to the smallest possible existing line edit.

Completed on this branch:

- Renamed the generation path to `generate_development_self_signed_certificate`.
- Updated startup output to `Generating development self-signed certificate for ${DOMAIN}`.

### 5. Add a Runtime Healthcheck Script

Create an nginx-owned healthcheck script under `nginx/`, for example `nginx/healthcheck.sh`, and mount it into the nginx container from `docker-compose.yml`.

The script should:

- Read the same `DOMAIN`, `CERT_DIR`, `FULLCHAIN`, and production detection inputs as `entrypoint.sh`.
- Return unhealthy when certificate files are missing.
- Return unhealthy in production when the active certificate is self-signed.
- Return unhealthy when the certificate expires within 14 days.
- Continue checking `http://127.0.0.1/healthz` so nginx process health remains covered.

Wire the nginx service healthcheck to call this script instead of only fetching `/healthz`.

Completed on this branch:

- Added `nginx/healthcheck.sh` using the same certificate helpers as startup validation.
- Wired the nginx Compose healthcheck to call `/etc/nginx/healthcheck.sh`.
- Added shell coverage for missing, self-signed, soon-expiring, and long-lived production certificate healthcheck outcomes.

### 6. Document Production Certificate Provisioning

Add `docs/DEPLOYMENT.md` or a focused `docs/PRODUCTION_TLS.md` if a full deployment guide is not desired yet. The document should include:

- Production TLS is required before exposing Sumurai to users.
- `certbot` is optional only as a Compose profile mechanism, not optional for production operation.
- Nginx server certificates are distinct from Teller mTLS client certificates documented in `README.md`.
- Required inputs: `DOMAIN`, public DNS pointing to the host, ports 80 and 443 reachable for ACME HTTP-01, and persistent `certbot-etc` / `certbot-var` volumes.
- Initial issuance workflow using the existing certbot container profile.
- Renewal workflow and operator responsibility for scheduling renewal.
- How to verify the deployed certificate chain and expiry with `openssl s_client` and `openssl x509`.
- Expected failure behavior when production starts with missing, self-signed, or soon-expiring certificates.

Update `README.md` Quick Start or Security sections to link to the production TLS guide and make local-only behavior distinct from production.

### 7. Add Tests and Static Validation

Add shell-level tests for `nginx/entrypoint.sh` and the healthcheck behavior. Prefer a lightweight test harness in `nginx/tests/` or `scripts/` using temporary directories and generated certificates so tests do not require real ACME calls.

Cover:

- Local `DOMAIN=localhost` generates a self-signed certificate when missing.
- Production non-local domain with missing certificate fails.
- Production non-local domain with self-signed certificate fails.
- Production non-local domain with a certificate expiring within 14 days fails.
- Non-local domain with a certificate valid beyond 14 days passes startup validation.
- Healthcheck returns non-zero for self-signed or soon-expiring production certificates.

Also validate Compose wiring with:

```bash
docker compose -f docker-compose.yml config >/dev/null
```

### 8. Operational Verification

Before closing the ticket:

- Run the shell test suite.
- Run Compose config validation.
- Start the nginx service in local mode and confirm `/healthz` is healthy with a generated development certificate.
- Simulate production mode with generated self-signed material and confirm startup or healthcheck failure.
- Confirm the deployment guide does not instruct operators to store secrets or private key contents in docs.

## Files Expected To Change

- `nginx/entrypoint.sh`
- `nginx/healthcheck.sh`
- `docker-compose.yml`
- `README.md`
- `docs/DEPLOYMENT.md` or `docs/PRODUCTION_TLS.md`
- `.env.example`, if documenting a new non-secret production indicator is needed
- `nginx/tests/` or a repository script test file

## Risks And Mitigations

- Production deployments using private internal domains may be classified as production by `DOMAIN != localhost`. Mitigate with an explicit `ALLOW_SELF_SIGNED_TLS=true` escape hatch only for non-public test environments, and ensure the default remains fail-closed.
- `openssl verify` behavior depends on available CA bundles inside the nginx image. Mitigate by also checking issuer/subject equality and by installing required CA certificates if absent.
- Healthcheck failures can trigger restart loops. Mitigate with actionable logs that identify whether the cause is missing files, self-signed material, or impending expiry.
- ACME issuance requires port 80 reachability. Mitigate by documenting DNS and firewall prerequisites before the certbot command.

## Definition Of Done

- Production startup fails when a non-local domain would serve missing, self-signed, or soon-expiring certificate material.
- Nginx healthcheck reports unhealthy when the active production certificate is self-signed or expires within 14 days.
- Local development still boots without pre-provisioned certificates.
- Production TLS documentation clearly states certbot provisioning and renewal are required.
- The self-signed generation path is marked development-only without adding unnecessary source comments.
- Tests cover certificate classification, expiry validation, and Compose healthcheck wiring.

## TDD Log

### Production Detection

- `sh nginx/tests/entrypoint_runtime_detection_test.sh`
- `env POSTGRES_PASSWORD=test SEQ_PASSWORD=test JWT_SECRET=test ENCRYPTION_KEY=test TELLER_APPLICATION_ID=test TELLER_CERT_PATH=/tmp/cert.pem TELLER_KEY_PATH=/tmp/key.pem DOMAIN=localhost SSL_PORT=8443 ENVIRONMENT=development docker compose -f docker-compose.yml config >/dev/null`
- Result: passed

### Certificate Inspection Helpers

- `sh nginx/tests/entrypoint_certificate_helpers_test.sh`
- `sh nginx/tests/entrypoint_runtime_detection_test.sh`
- Result: passed

### Startup Validation And Development Self-Signed Guard

- `sh nginx/tests/entrypoint_startup_validation_test.sh`
- `sh nginx/tests/entrypoint_certificate_helpers_test.sh`
- `sh nginx/tests/entrypoint_runtime_detection_test.sh`
- Result: passed

### Runtime Healthcheck

- `sh nginx/tests/healthcheck_test.sh`
- `sh nginx/tests/entrypoint_startup_validation_test.sh`
- `sh nginx/tests/entrypoint_certificate_helpers_test.sh`
- `sh nginx/tests/entrypoint_runtime_detection_test.sh`
- `env POSTGRES_PASSWORD=test SEQ_PASSWORD=test JWT_SECRET=test ENCRYPTION_KEY=test TELLER_APPLICATION_ID=test TELLER_CERT_PATH=/tmp/cert.pem TELLER_KEY_PATH=/tmp/key.pem DOMAIN=localhost SSL_PORT=8443 ENVIRONMENT=development docker compose -f docker-compose.yml config >/dev/null`
- Result: passed
