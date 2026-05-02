# TBF-62 Security Response Headers Implementation Plan

## Ticket Context

Linear issue: TBF-62, `[TM-005] Add security response headers to nginx`

Threat model reference: `docs/sumurai-threat-model.md`, TM-005. The current HTTPS nginx server block in `nginx/nginx.conf.template` terminates TLS and proxies all browser-facing routes, but it does not set HSTS, clickjacking, MIME-sniffing, referrer, or CSP headers.

## Goals

- Add the security headers required by TBF-62 at the nginx HTTPS edge.
- Keep headers on nginx-generated errors and upstream responses.
- Defer CSP changes because CSP support is being handled in another branch.
- Avoid moving security policy into frontend code because nginx is the common browser-facing boundary for frontend, backend docs, Seq, and health responses.
- Verify the production nginx response, not only static config syntax.

## Assumptions

- `nginx/nginx.conf.template` is the correct deployment source because `docker-compose.yml` mounts it into the nginx container and renders it through `nginx/entrypoint.sh`.
- The HTTPS `server` block is the only place for HSTS. The HTTP block should keep redirect and ACME behavior without emitting HSTS.
- CSP implementation and validation will be merged from the separate CSP branch rather than duplicated here.

## Recommended Header Policy

Add this policy at HTTPS `server` scope in `nginx/nginx.conf.template`:

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer" always;
```

Rationale:

- Use `always` so nginx applies the headers to successful responses and nginx-generated errors.
- Keep `Strict-Transport-Security` scoped to HTTPS with a one-year `max-age` and `includeSubDomains`, matching ticket acceptance.
- Use `X-Frame-Options: DENY` for clickjacking defense in this branch; CSP `frame-ancestors` belongs to the separate CSP branch.
- Use `X-Content-Type-Options: nosniff` for MIME confusion defense.
- Use `Referrer-Policy: no-referrer` because the ticket explicitly requires the strictest privacy posture.

## Implementation Sequence

1. Edit `nginx/nginx.conf.template`.
2. Add the `add_header` block immediately after TLS settings in the HTTPS `server` block and before shared proxy headers.
3. Keep the HTTP `server` block unchanged except for existing redirects and ACME challenge handling.
4. Run nginx config validation through the rendered compose configuration.
5. Build or restart the production nginx container path.
6. Verify headers from a real HTTPS response with `curl -k -I https://localhost:${SSL_PORT:-8443}/healthz` or the configured production domain.
7. Verify at least one proxied frontend route and one nginx-generated denied or missing route include the same header set.
8. Confirm this branch does not add or overwrite `Content-Security-Policy`, leaving that header to the CSP branch.

## Verification Checklist

- [x] `nginx -t` passes against rendered configuration.
- [x] `Strict-Transport-Security` is present only on HTTPS responses and exactly includes `max-age=31536000; includeSubDomains`.
- [x] `X-Frame-Options: DENY` is present.
- [x] `X-Content-Type-Options: nosniff` is present.
- [x] `Referrer-Policy: no-referrer` is present.
- [x] `Content-Security-Policy` is not introduced by this branch.
- [ ] A browser smoke test can load the dashboard/login route after the nginx header change.
- [x] No `.env` files are read or edited.

## Risks And Mitigations

- `Referrer-Policy: no-referrer` may remove analytics/referrer context. Mitigation: accept this for financial privacy unless product requirements explicitly need `strict-origin-when-cross-origin`.
- HSTS with `includeSubDomains` can affect every subdomain after first visit. Mitigation: confirm all production subdomains support HTTPS before rollout.
- Applying headers at `server` scope also affects `/docs/`, `/seq/`, and `/ingest/otlp`. Mitigation: this is acceptable for browser-facing edge defense; if a non-browser client breaks, override only that location with documented justification.

## Rollout Notes

- Deploy first to staging or a non-primary production domain.
- Inspect login, dashboard load, and API-docs load for unexpected response-header side effects.
- After validation, deploy to production and capture response headers as ticket evidence.
- Do not add `preload` to HSTS in this ticket; it requires a separate readiness check for every subdomain and submission lifecycle.
- Do not add `X-XSS-Protection`; modern guidance prefers CSP and disabling that legacy browser filter if explicitly configured.
- Do not add CSP in this ticket; reconcile the separate CSP branch after this header-only change lands.

## Implementation Log

- Added the four required non-CSP `add_header` directives to the HTTPS nginx server block.
- Rendered `nginx/nginx.conf.template` with explicit throwaway `DOMAIN` and `SSL_PORT` values and confirmed header placement in the rendered config.
- Confirmed `Content-Security-Policy` is absent from `nginx/nginx.conf.template`.
- Did not add automated tests because this change is nginx configuration rather than business logic.
- `nginx -t` passed in `nginx:1.27-alpine` against the rendered config with temporary certificate files and standalone host aliases for compose upstreams.
- Browser smoke verification remains pending because the production stack was not started.

## Sources

- TBF-62: `https://linear.app/twobitfoundry/issue/TBF-62/tm-005-add-security-response-headers-to-nginx`
- OWASP HTTP Security Response Headers Cheat Sheet: `https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html`
- OWASP Clickjacking Defense Cheat Sheet: `https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html`
