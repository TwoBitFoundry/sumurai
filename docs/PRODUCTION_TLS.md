# Production TLS

Production deployments must provision a publicly trusted nginx server certificate before Sumurai is exposed to users. Local development may use the generated 30-day self-signed certificate, but production startup fails when nginx would serve missing, self-signed, or soon-expiring certificate material.

This guide covers nginx server TLS only.

## Required Inputs

- `DOMAIN=sumurai.app`.
- `APP_ORIGIN=https://sumurai.app`.
- `SUMURAI_IMAGE_TAG=latest`.
- `HTTP_PORT=80`.
- `HTTPS_PORT=443`.
- DNS `A` record for the apex pointing to the deployment host and a `www` CNAME pointing to the apex, both set to DNS only during issuance.
- Inbound ports `80` and `443` reachable from the public internet for ACME HTTP-01 validation and HTTPS traffic.
- `docker-compose.prod.yml`: production compose stack (production settings, public host ports `80` and `443`).
- Persistent Docker volumes `certbot-etc` and `certbot-var`.
- The existing server-side secret injection mechanism.
- A twice-daily systemd renewal timer.

## Initial Issuance

Start from the production host after the apex and `www` records resolve directly to its IPv4 address.

```bash
DOMAIN=sumurai.app APP_ORIGIN=https://sumurai.app SUMURAI_IMAGE_TAG=latest HTTP_PORT=80 HTTPS_PORT=443 docker compose -f docker-compose.prod.yml --profile certbot run --rm --publish 80:80 --entrypoint certbot certbot certonly --standalone --email <ACME_EMAIL> --agree-tos --no-eff-email -d sumurai.app -d www.sumurai.app
```

Pull the rolling application images and start the production stack:

```bash
DOMAIN=sumurai.app APP_ORIGIN=https://sumurai.app SUMURAI_IMAGE_TAG=latest HTTP_PORT=80 HTTPS_PORT=443 docker compose -f docker-compose.prod.yml pull frontend backend
DOMAIN=sumurai.app APP_ORIGIN=https://sumurai.app SUMURAI_IMAGE_TAG=latest HTTP_PORT=80 HTTPS_PORT=443 docker compose -f docker-compose.prod.yml up -d
```

If production certificate material is missing, nginx exits non-zero before serving traffic.

## Renewal

Certbot is optional only as a compose profile mechanism. Certificate renewal is required production operations work.

With nginx running, use the ACME webroot served from `/.well-known/acme-challenge/`, then gracefully reload nginx:

```bash
DOMAIN=sumurai.app APP_ORIGIN=https://sumurai.app SUMURAI_IMAGE_TAG=latest HTTP_PORT=80 HTTPS_PORT=443 docker compose -f docker-compose.prod.yml --profile certbot run --rm --entrypoint certbot certbot renew --webroot --webroot-path /var/www/certbot
DOMAIN=sumurai.app APP_ORIGIN=https://sumurai.app SUMURAI_IMAGE_TAG=latest HTTP_PORT=80 HTTPS_PORT=443 docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

Install a systemd oneshot service that runs both renewal commands from the Sumurai deployment directory through the existing server-side secret injection mechanism. Pair it with a timer using `OnCalendar=*-*-* 00,12:00:00`, `RandomizedDelaySec=1h`, and `Persistent=true`. Enable it with:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sumurai-certbot-renew.timer
sudo systemctl start sumurai-certbot-renew.service
sudo systemctl status sumurai-certbot-renew.timer --no-pager
```

Verify the renewal path before relying on the timer:

```bash
DOMAIN=sumurai.app APP_ORIGIN=https://sumurai.app SUMURAI_IMAGE_TAG=latest HTTP_PORT=80 HTTPS_PORT=443 docker compose -f docker-compose.prod.yml --profile certbot run --rm --entrypoint certbot certbot renew --dry-run --webroot --webroot-path /var/www/certbot
```

The schedule must preserve the `certbot-etc` and `certbot-var` volumes.

If nginx is stopped for recovery and renewal cannot use webroot, use certbot standalone while nginx is stopped and port 80 is free.

## Verification

Verify the deployed chain:

```bash
openssl s_client -connect sumurai.app:443 -servername sumurai.app -showcerts </dev/null
```

Verify the active certificate expiry:

```bash
openssl s_client -connect sumurai.app:443 -servername sumurai.app </dev/null 2>/dev/null | openssl x509 -noout -issuer -subject -ext subjectAltName -enddate
```

Verify local container health:

```bash
DOMAIN=sumurai.app APP_ORIGIN=https://sumurai.app SUMURAI_IMAGE_TAG=latest HTTP_PORT=80 HTTPS_PORT=443 docker compose -f docker-compose.prod.yml ps
```

Verify compose renders the production port mapping:

```bash
DOMAIN=sumurai.app APP_ORIGIN=https://sumurai.app SUMURAI_IMAGE_TAG=latest HTTP_PORT=80 HTTPS_PORT=443 docker compose -f docker-compose.prod.yml config --quiet
```

## Failure Behavior

Production nginx startup fails when certificate files are missing, self-signed, or expire within 14 days.

The nginx container healthcheck reports unhealthy when production certificate material is missing, self-signed, or expires within 14 days. Healthcheck logs use `TLS_PROVISIONING_ERROR` with the domain, certificate path, and reason.

Development deployments using `DOMAIN=localhost` may generate a 30-day self-signed certificate for local bootstrapping. That path is not acceptable for production traffic.
