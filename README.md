# Sumurai

Personal finance dashboard. Self-hosted. Connects to your bank via Teller or Plaid, syncs transactions, and shows where your money goes.

## Privacy Disclosure for 3rd Party Financial Aggregators

While this app is designed to handle your information securely after it is received, 3rd party aggregators still control how their own services collect and process your data. Sumurai uses external financial aggregation APIs, including Teller and Plaid, to connect accounts and sync transactions. Using those services requires accepting their terms of service and privacy policies.

Teller policy: [https://teller.io/legal](https://teller.io/legal)

Review the provider trade-offs before connecting real financial accounts.

## Why This Exists

Most personal finance tools are either bloated, expensive, or hard to maintain. Sumurai is a focused alternative for tracking spending, setting budgets, and understanding cash flow without a subscription.

## What It Does

- Connects accounts through Teller or Plaid
- Syncs and categorizes transactions
- Tracks budgets by category
- Charts spending, balances, and net worth over time

## Quick Start

Provide the required environment variables referenced by `docker-compose.yml` and start the stack:

```bash
docker compose up -d --build
```

For source-built local development, use the development override:

```bash
docker compose -f docker-compose.yml -f docker-compose.development.yml up -d --build
```

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

- Frontend: Next.js 16, React 19, TypeScript, Tailwind, Recharts, Biome, Jest, and browser OpenTelemetry
- Backend: Rust 1.95, Axum, SQLx, Redis, PostgreSQL, JWT auth, provider integrations, and OpenTelemetry export to Seq
- Deployment: Docker Compose with nginx, frontend, backend, Postgres, Redis, Seq, and certbot
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
