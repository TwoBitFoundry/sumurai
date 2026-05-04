Sumurai

# Sumurai

Personal finance dashboard. Self-hosted. Connects to your bank via Teller API, syncs transactions, shows where your money goes.

Dashboard
Dashboard extras

## Privacy Disclosure for 3rd Party Financial Aggregators

While this app was built to securely handle your information once its received, we are not able to control how 3rd Party Aggregators use your data. This app requires the use of 3rd Party Financial Aggregators API (eg. Teller) to securely connect your accounts and transaction data while keeping them in sync. To do so requires consenting to the 3rd Party Aggregator's terms of service and data usage policy. Please be aware this is a privacy trade-off to allow the tool to be more useful.

You can read Teller's policy here: [https://teller.io/legal](https://teller.io/legal)

Be sure you are ok with the privacy trade-offs before connecting your accounts!

## Why This Exists

Most personal finance tools are either bloated with features you don't need, expensive for what they offer, or require extensive maintenance or upkeep to be useful. Sumurai is a focused alternative: track spending, set budgets, see where your money goes—without a subscription.

Built for individuals and small businesses who want financial visibility without the overhead.

## What It Does

- Links bank accounts via Teller API
- Syncs and categorizes transactions
- Tracks budgets by category
- Charts spending over time

Transactions
Budgets
Accounts

## Quick Start

```bash
cp .env.example .env
# Edit .env: set JWT_SECRET, ENCRYPTION_KEY, POSTGRES_PASSWORD, Teller creds
docker compose up -d --build
```

Open [http://localhost:8080](http://localhost:8080). Demo: `me@test.com` / `Test1234!`

See [CONTRIBUTING.md](CONTRIBUTING.md) for prerequisites and full setup.

For production deployments, provision nginx server TLS before exposing Sumurai to users and run with `docker-compose.production.yml`. See [Production TLS](docs/PRODUCTION_TLS.md).

### Teller certificate paths (Docker)

In `.env`, `TELLER_CERT_PATH` and `TELLER_KEY_PATH` are **paths on your host** to the PEM files (for example `./.certs/teller/certificate.pem` and `./.certs/teller/private_key.pem`). Docker Compose mounts those files into the backend container at `**/etc/teller/certificate.pem`** and `**/etc/teller/private_key.pem`**, and the backend reads those in-container paths. If you need local dev placeholders, create PEM files under `.certs/teller/`.

## Architecture

React 19 + Next.js frontend, Rust (Axum) backend, PostgreSQL, Redis. JWT auth. Docker Compose deployment.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

## Security

Self-hosted. No vendor data path.

- Data stays in your PostgreSQL
- Bank credentials never stored (Teller uses short-lived tokens)
- Provider tokens encrypted (AES-256-GCM)
- Production nginx TLS requires a publicly trusted certificate and renewal schedule
- Wipe everything: `docker compose down -v`

## Roadmap

- Financial reports and data export
- Balance and budget notifications
- Receipt uploads and search

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Open Source under Apache 2.0 License. See [LICENSE](LICENSE).