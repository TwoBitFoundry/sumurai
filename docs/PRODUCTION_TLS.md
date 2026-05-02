# Production TLS

Production deployments must provision a publicly trusted nginx server certificate before Sumurai is exposed to users. Local development may use the generated 30-day self-signed certificate, but production startup now fails when nginx would serve missing, self-signed, or soon-expiring certificate material.

This guide covers nginx server TLS only. Teller mTLS client certificates are separate backend credentials mounted from `TELLER_CERT_PATH` and `TELLER_KEY_PATH` as described in the README.

## Required Inputs

- `DOMAIN`: public DNS name for the Sumurai deployment.
- DNS `A` or `AAAA` record pointing `DOMAIN` to the deployment host.
- Inbound ports `80` and `443` reachable from the public internet for ACME HTTP-01 validation and HTTPS traffic.
- `docker-compose.production.yml`: production override that sets `ENVIRONMENT=production`, `SSL_PORT=443`, and public host ports `80` and `443`.
- Persistent Docker volumes `certbot-etc` and `certbot-var`.
- An operator-owned renewal schedule.

## Initial Issuance

Start from a host where DNS and firewall rules already route `DOMAIN` to the deployment host.

```bash
DOMAIN=app.example.com HTTP_PORT=80 docker compose --profile certbot run --rm --publish 80:80 --entrypoint certbot certbot certonly --standalone --email ops@example.com --agree-tos --no-eff-email -d app.example.com
```

After issuance, start nginx:

```bash
DOMAIN=app.example.com docker compose -f docker-compose.yml -f docker-compose.production.yml up -d nginx
```

If production certificate material is missing, nginx exits non-zero before serving traffic.

## Renewal

Certbot is optional only as a compose profile mechanism. Certificate renewal is required production operations work.

With nginx running, use the ACME webroot served from `/.well-known/acme-challenge/`:

```bash
DOMAIN=app.example.com docker compose --profile certbot run --rm --entrypoint certbot certbot renew --webroot --webroot-path /var/www/certbot
DOMAIN=app.example.com docker compose -f docker-compose.yml -f docker-compose.production.yml restart nginx
```

Use the host scheduler appropriate for the deployment environment. The schedule must keep the `certbot-etc` and `certbot-var` volumes intact between runs.

If nginx is stopped for recovery and renewal cannot use webroot, use certbot standalone while nginx is stopped and port 80 is free.

## Verification

Verify the deployed chain:

```bash
openssl s_client -connect app.example.com:443 -servername app.example.com -showcerts </dev/null
```

Verify the active certificate expiry:

```bash
openssl s_client -connect app.example.com:443 -servername app.example.com </dev/null 2>/dev/null | openssl x509 -noout -issuer -subject -enddate
```

Verify local container health:

```bash
DOMAIN=app.example.com docker compose -f docker-compose.yml -f docker-compose.production.yml ps nginx
```

Verify compose renders the production port mapping:

```bash
DOMAIN=app.example.com docker compose -f docker-compose.yml -f docker-compose.production.yml config
```

## Failure Behavior

Production nginx startup fails when certificate files are missing, self-signed, or expire within 14 days.

The nginx container healthcheck reports unhealthy when production certificate material is missing, self-signed, or expires within 14 days. Healthcheck logs use `TLS_PROVISIONING_ERROR` with the domain, certificate path, and reason.

Development deployments using `DOMAIN=localhost` may generate a 30-day self-signed certificate for local bootstrapping. That path is not acceptable for production traffic.
