# Sumurai

Personal finance dashboard. Self-hosted. Connects to your bank via Teller or Plaid, syncs transactions, and shows where your money goes.

<img width="1257" height="931" alt="image" src="https://github.com/user-attachments/assets/50d30e23-224c-4182-9dae-e7d8da8b75c5" />

## Privacy Disclosure for 3rd Party Financial Aggregators

While this app is designed to handle your information securely after it is received, 3rd party aggregators still control how their own services collect and process your data. Sumurai uses external financial aggregation APIs, including Teller and Plaid, to connect accounts and sync transactions. Using those services requires accepting their terms of service and privacy policies.

Teller policy: [https://teller.io/legal](https://teller.io/legal)

Plaid policy: [https://plaid.com/legal/#consumers](https://plaid.com/legal/#consumers)

Review the provider trade-offs before connecting real financial accounts.

## Why This Exists

Sumurai exists because there are not a lot of free, simple, and modern budgeting apps out there. We wanted a Bring Your Own Key (BYOK) self-hosted option that people can build a community around and decide its direction.

## What It Does

- Connects accounts through Teller or Plaid
- Syncs and categorizes transactions
- Tracks budgets by category
- Charts spending, balances, and net worth over time

<img width="1478" height="870" alt="image" src="https://github.com/user-attachments/assets/ed35ee89-0e4b-461c-adf7-5401f3ef6021" />
<img width="1477" height="872" alt="image" src="https://github.com/user-attachments/assets/704860a2-e206-4a9e-832b-67ae8dfd3338" />
<img width="1477" height="870" alt="image" src="https://github.com/user-attachments/assets/b3b34a07-09c1-4736-b0d2-694ab3dda215" />
<img width="1476" height="871" alt="image" src="https://github.com/user-attachments/assets/18721bc8-1191-4edb-8679-01129b65a98e" />
<img width="1476" height="871" alt="image" src="https://github.com/user-attachments/assets/1e7bf41f-7cd4-4857-9add-f925b2d62ce5" />

## Quick Start

The default `docker-compose.yml` is the **OSS-oriented** stack: prebuilt app images, Teller as the default provider, strict auth cookies, and no Seq service. Set the variables Compose marks as required (see `.env.example`), then:

```bash
docker compose up -d --build
```

For **local development** with images built from this repo (console-friendly telemetry, relaxed cookies):

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

For **production-style** hosting with Seq and OTLP (public HTTP/HTTPS, different defaults), use `docker-compose.prod.yml` and [docs/PRODUCTION_TLS.md](docs/PRODUCTION_TLS.md).

Optional ngrok is available in the standard and development Compose files only. It tunnels to the internal `nginx` service over HTTPS, and you need to enable the `ngrok` profile. Set `NGROK_AUTHTOKEN` in your environment or `.env` first:

```bash
docker compose --profile ngrok up -d --build
```

```bash
docker compose -f docker-compose.dev.yml --profile ngrok up -d --build
```

When `NGROK_URL` is set, it is automatically added to the backend CORS allowlist for the compose stack.

Open [http://localhost:8080](http://localhost:8080). Demo credentials: `me@test.com` / `Test1234!`

For UI-only iteration:

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server runs at [http://localhost:3001](http://localhost:3001).

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, validation, and workflow details.

### Teller certificate paths

`TELLER_CERT_PATH` and `TELLER_KEY_PATH` are host paths to the PEM files you mount for Teller mTLS. Docker Compose mounts those files into the backend container at `/etc/teller/certificate.pem` and `/etc/teller/private_key.pem`.

If you need local placeholders, create PEM files under `.certs/teller/` on your machine.

## Sandbox Credentials

Use these provider test credentials for local sandbox flows:

- Teller
  - Username: `username`
  - Password: `password`
- Plaid
  - Username: `user_good`
  - Password: `pass_good`

If a sandbox provider prompts for 2FA, click through with empty fields.

## Supported Platforms

Sumurai is intended to run on any host where Docker Compose is available, including macOS, Linux, and Windows. For browser access, use a modern desktop browser such as Chrome, Edge, Firefox, or Safari.

## Architecture

The app is a static Next.js export served by Nginx on port 8080, with `/api/*` and `/health` proxied to the Rust backend.

- Frontend: Next.js 16, React 19, TypeScript, Tailwind, Recharts, Biome, Jest, and browser OpenTelemetry (enabled per compose via `NEXT_PUBLIC_OTEL_*`)
- Backend: Rust 1.95, Axum, SQLx, Redis, PostgreSQL, JWT auth, provider integrations, and OpenTelemetry tracing (export mode is set per environment; production compose sends OTLP to Seq)
- Deployment: standalone Docker Compose files—default OSS (`docker-compose.yml`), local dev builds (`docker-compose.dev.yml`), or production with Seq (`docker-compose.prod.yml`); each includes nginx, frontend, backend, Postgres, and Redis
- Providers: Teller and Plaid through a shared provider registry

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the deeper system breakdown.

## Security

Self-hosted. Data stays in your PostgreSQL database.

- Bank credentials are not stored directly
- Provider tokens are encrypted with AES-256-GCM
- Redis is required for sessions, cache, and rate limiting
- Production nginx TLS requires a publicly trusted certificate and renewal schedule
- Wipe local data with `docker compose down -v`

## Roadmap

- Financial reports and data export
- Balance and budget notifications
- Receipt uploads and search

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Source available under the Sustainable Use License v1.0. See [LICENSE](LICENSE).
