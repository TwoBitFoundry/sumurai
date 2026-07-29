# Cloudflare + Hostinger Production Go-Live — MPRD

Status: Ready for implementation
Owner: Kody Buss
Last updated: 2026-07-28

## Goal

Launch the complete Sumurai application at `https://sumurai.app` with Cloudflare
in front of the Hostinger VPS and nginx as the only public application ingress.
The agent performs every automatable repository, server, Cloudflare, Hostinger,
Paddle, and verification task. Human-only actions are listed once at the end.

## Confirmed Requirements

- Cloudflare is authoritative and its Edge Certificate is Active.
- The Hostinger VPS has not served production users. Its current containers and
  named volumes may be wiped once before launch.
- Deploy `docker-compose.prod.yml`.
- Pull and deploy the rolling `latest` frontend and backend images; do not pin a
  release tag.
- Use `https://sumurai.app` as the canonical URL and redirect `www` to the apex.
- Keep nginx as the only public ingress.
- The browser must reach `/api/*` through nginx for the full application to work.
  Backend port `3000` remains private and Axum continues to enforce
  authentication, authorization, tenancy, and rate limiting.
- Keep `/docs*`, `/api-docs*`, `/seq*`, and `/ingest/otlp*` private.
- Keep `/healthz` public.
- Use Cloudflare Full (strict) with a Let's Encrypt certificate on the origin.
- Do not read, print, write, or commit `.env` files.
- Do not add tests for nginx, Docker Compose, Cloudflare, Certbot, systemd, or
  other framework behavior.
- Add automated tests only if implementation changes Rust or TypeScript business
  logic. No business-logic changes are expected.
- Do not add source comments.

## Required Runtime Values

- `DOMAIN=sumurai.app`
- `APP_ORIGIN=https://sumurai.app`
- `SUMURAI_IMAGE_TAG=latest`
- `HTTP_PORT=80`
- `HTTPS_PORT=443`

Existing secrets remain in the current server-side secret mechanism. The agent
may run Compose with those values but must not inspect or print them.

## Minimal Risk Controls

Only these controls are required for the first launch:

1. Replace the parked DNS target with the correct VPS IPv4.
2. Provision and verify origin TLS before enabling the Cloudflare proxy.
3. Make the nginx route boundary exact: application API public through nginx;
   documentation and observability private.
4. Trust Cloudflare client-IP headers only from Cloudflare networks.
5. Bypass Cloudflare cache for application API and operational routes.
6. Restrict the origin firewall after proxied traffic works.
7. Complete one end-to-end browser and Paddle webhook check before accepting
   users.

Postpone Cloudflare Tunnel, Authenticated Origin Pulls, IPv6, HSTS preload,
aggressive WAF challenges, and advanced caching until after the initial launch.

---

## Phase 1 — Prepare the Repository

**Goal:** Make the existing production stack work correctly behind Cloudflare
without changing business behavior.

### Tasks

- Add an nginx include containing Cloudflare's current published IPv4 and IPv6
  networks as trusted proxy sources.
- Configure nginx to restore `CF-Connecting-IP` only from those trusted sources.
- Replace upstream `X-Forwarded-For` and `X-Real-IP` with the trusted client
  address instead of appending an untrusted chain.
- Proxy `/api/*` to private `backend:3000`.
- Ensure the application route does not also expose `/api-docs*`.
- Keep these routes private or blocked publicly:
  - `/docs*`
  - `/api-docs*`
  - `/seq*`
  - `/ingest/otlp*`
- Preserve the existing nginx authentication volumetric fuse and Axum security
  controls.
- Keep only nginx ports `80` and `443` published.
- Add an origin fallback redirect from `www.sumurai.app` to
  `https://sumurai.app`, preserving the path and query.
- Make production CORS use the canonical application origin.
- Update `docs/PRODUCTION_TLS.md` with the final deployment and renewal commands.
- Do not touch test files because this phase changes no business logic.

### Acceptance Criteria

- [x] Native nginx configuration validation succeeds.
- [x] Quiet Compose validation succeeds without printing secrets.
- [x] Only nginx publishes host ports.
- [x] `/api/*` reaches the private backend without a private-network nginx gate.
- [x] Documentation and observability routes remain blocked publicly.
- [x] Nginx sends one trusted client address to Axum.
- [x] `www` redirects to the canonical apex.
- [x] No test files or business-logic files change.

### Implementation Notes

- Added Cloudflare's published IPv4 and IPv6 networks as nginx real-IP trust
  sources and replaced forwarded address chains with the restored client address.
- Derived production application and CORS origins from `DOMAIN`.
- Kept infrastructure verification native; no repository tests were added.

### TDD Log

- Red: one-off configuration assertions confirmed the missing Cloudflare include,
  trusted forwarded address, and `www` TLS redirect.
- Green: the focused existing nginx configuration contracts, `nginx -t`, quiet
  Compose validation, and a rendered Compose port assertion passed.
- Refactor: updated both TLS hosts to nginx's current HTTP/2 directive and
  re-ran native validation without warnings.

## Phase 2 — Wipe and Deploy the Clean Origin

**Goal:** Replace the unused deployment with a clean production stack using
`latest`.

### Tasks

- Confirm the SSH target is the unused Sumurai production VPS.
- Remove only the Sumurai production project's containers, networks, and named
  volumes:

  ```bash
  docker compose -f docker-compose.prod.yml down -v --remove-orphans
  ```

- Do not run a host-wide Docker prune or remove unrelated Docker resources.
- Pull the current `latest` frontend and backend images.
- Record the resolved image digests for the deployment record.
- In Cloudflare DNS, temporarily configure:

  | Type | Name | Content | Proxy |
  |---|---|---|---|
  | A | `@` | Hostinger VPS IPv4 | DNS only |
  | CNAME | `www` | `sumurai.app` | DNS only |

- Delete stale Hover or conflicting apex/`www` web records.
- Leave IPv6 disabled for the first launch.
- Issue a Let's Encrypt certificate for both hostnames:

  ```bash
  DOMAIN=sumurai.app docker compose -f docker-compose.prod.yml --profile certbot run --rm --publish 80:80 --entrypoint certbot certbot certonly --standalone --email <ACME_EMAIL> --agree-tos --no-eff-email -d sumurai.app -d www.sumurai.app
  ```

- Start `docker-compose.prod.yml` with `SUMURAI_IMAGE_TAG=latest`.
- Allow the backend to create and migrate the fresh PostgreSQL database.
- Install a twice-daily host systemd timer that runs Certbot webroot renewal and
  gracefully reloads nginx.
- Run one Certbot renewal dry-run.

### Acceptance Criteria

- [ ] Only the intended Sumurai project was deleted.
- [ ] Fresh PostgreSQL, Redis, migration, Seq, and certificate volumes exist.
- [ ] The database contains the current migrated schema.
- [ ] The deployed application images resolve from `latest`.
- [ ] The certificate is valid for both apex and `www`.
- [ ] Direct origin `/healthz` returns `200` with valid TLS.
- [ ] Direct origin SPA requests return `200`.
- [ ] Protected `/api/*` requests reach Axum rather than nginx's network `403`.
- [ ] Documentation and observability remain blocked.
- [ ] All services are healthy or running as appropriate.
- [ ] Certbot dry-run succeeds.

## Phase 3 — Configure Cloudflare and Lock Down Hostinger

**Goal:** Move public traffic to the verified origin and prevent direct-origin
bypass.

### Tasks

- Set Cloudflare SSL/TLS mode to Full (strict).
- Change the apex and `www` records to Proxied.
- Enable Always Use HTTPS after Full (strict) succeeds.
- Add a `301` redirect from `www.sumurai.app` to `https://sumurai.app` that
  preserves path and query.
- Add a cache-bypass rule for:
  - `/api/*`
  - `/healthz`
  - `/docs*`
  - `/api-docs*`
  - `/seq*`
  - `/ingest/otlp*`
- Do not enable Cache Everything.
- Do not place interactive Cloudflare challenges on `/api/auth/*` or the Paddle
  webhook.
- Purge any parked-page cache.
- Configure the Hostinger managed firewall:
  - Allow the actual SSH port only from the administrator's trusted IP.
  - Allow ports `80` and `443` only from Cloudflare's published networks.
  - Do not expose backend, PostgreSQL, Redis, or Seq ports.
- Keep the active SSH session open until a second connection succeeds under the
  new firewall policy.
- Configure Paddle's production webhook as:
  `https://sumurai.app/api/billing/webhooks/paddle`.
- Send a signed Paddle test event.

### Acceptance Criteria

- [ ] Public DNS returns Cloudflare addresses.
- [ ] `https://sumurai.app` loads without Cloudflare `52x` errors.
- [ ] Cloudflare uses Full (strict) successfully.
- [ ] HTTP redirects once to the HTTPS apex.
- [ ] `www` redirects once while preserving path and query.
- [ ] `/healthz` returns `200` through Cloudflare.
- [ ] API responses report `CF-Cache-Status: DYNAMIC` or `BYPASS`.
- [ ] Hover content is no longer served.
- [ ] Direct-origin public traffic is rejected after firewall activation.
- [ ] A second SSH connection succeeds from the approved source.
- [ ] The signed Paddle webhook succeeds.

## Phase 4 — Validate and Establish the Production Baseline

**Goal:** Confirm the live product works, then mark the environment as
non-disposable.

### Tasks

- Run a browser smoke check through `https://sumurai.app`:
  - Load the SPA.
  - Complete passkey registration and login.
  - Load authenticated accounts, budgets, and transactions.
  - Read billing status.
  - Log out and log in again.
- Confirm authenticated API responses are not cached.
- Review nginx, backend, PostgreSQL, Redis, and Seq health and logs.
- Record:
  - Git revision
  - Resolved `latest` image digests
  - Origin certificate issuer, hostnames, and expiration
  - Cloudflare DNS and TLS settings
  - Hostinger firewall policy
  - Certbot timer status
- Take the first Hostinger snapshot and PostgreSQL backup after the smoke check
  passes.
- From this point forward:
  - Production data is not disposable.
  - Never run `docker compose down -v`.
  - Future deployments must preserve volumes.

### Acceptance Criteria

- [ ] The complete browser journey succeeds.
- [ ] Passkey login works after a fresh browser session.
- [ ] Authenticated data loads through nginx.
- [ ] Paddle webhook processing updates billing state.
- [ ] No authenticated API response is served from Cloudflare cache.
- [ ] All services remain healthy.
- [ ] The certificate renewal timer is enabled.
- [ ] The deployment record is complete.
- [ ] The first post-launch snapshot and PostgreSQL backup are verified.
- [ ] The operator approves the public launch.

## Validation Policy

- Do not create repository tests for infrastructure configuration.
- Use native validation:
  - nginx configuration validation
  - quiet Compose validation
  - certificate inspection
  - DNS and HTTP checks
  - `curl --resolve` origin checks
  - container health and logs
  - browser smoke checks
  - Paddle signed test delivery
- If a Rust or TypeScript business-logic change becomes necessary, add only the
  smallest boundary-focused business test in the existing test folders.

## Agent Execution Boundary

The agent performs all automatable work in this document, including repository
changes, the scoped VPS wipe, deployment, certificate commands, Cloudflare
configuration, Hostinger firewall configuration, Paddle webhook configuration,
and validation. Dashboard actions require the operator to authenticate first,
but authentication does not transfer execution ownership to the operator.

## References

- [Cloudflare Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/)
- [Cloudflare proxy status](https://developers.cloudflare.com/dns/proxy-status/)
- [Cloudflare visitor IP restoration](https://developers.cloudflare.com/support/troubleshooting/restoring-visitor-ips/restoring-original-visitor-ips/)
- [Cloudflare cache guidance](https://developers.cloudflare.com/cache/troubleshooting/dynamic-content-and-login-issues/)
- [Hostinger VPS DNS](https://support.hostinger.com/en/articles/1583227-how-to-point-a-domain-to-your-vps)
- [Hostinger VPS firewall](https://www.hostinger.com/support/8172641-how-to-use-a-managed-vps-firewall-at-hostinger/)

## Manual Actions Remaining After Agent Work

These are the only actions the operator must perform personally:

- [ ] Authenticate to Hostinger, Cloudflare, and Paddle and complete MFA when the
      agent requests access. Never paste passwords, private keys, recovery codes,
      or API tokens into chat.
- [ ] Complete passkey enrollment and login using the required physical device or
      biometric prompt.
- [ ] Complete a real financial institution's consent and MFA flow if a live bank
      connection is included in final verification.
- [ ] Approve any billing check that could create a real Paddle charge.
- [ ] Visually confirm the authenticated application contains the expected
      accounts, budgets, transactions, settings, and billing state.
- [ ] Give final approval for `sumurai.app` to remain publicly available.
