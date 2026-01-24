![Sumurai](https://github.com/user-attachments/assets/3b1a9fe4-4dbd-4f9a-9183-1f52dcfd70ca)

# Sumurai

Personal finance dashboard. Self-hosted. Connects to your bank via Teller API, syncs transactions, shows where your money goes.

![Dashboard](docs/images/dashboard-hero.png)
![Dashboard extras](docs/images/dashboard-extras.png)

## About 3rd Party Financial Aggregators (eg. Teller)
While this app was built to securely handle your information once its received, we are not able to control how 3rd Party Aggregators use your data. To connect your account and transaction info securely, it requires consenting to the 3rd Party Aggregator's terms of service and data usage policy. 

You can read Teller's policy here: https://teller.io/legal

Be sure you are ok with the privacy trade-offs before connecting your accounts!

## Why This Exists

Most personal finance tools are either bloated with features you don't need, expensive for what they offer, or require extensive maintenance or upkeep to be useful. Sumurai is a focused alternative: track spending, set budgets, see where your money goes—without a subscription.

Built for individuals and small businesses who want financial visibility without the overhead.

## What It Does

- Links bank accounts via Teller API
- Syncs and categorizes transactions
- Tracks budgets by category
- Charts spending over time

![Transactions](docs/images/transactions.png)
![Budgets](docs/images/budgets.png)
![Accounts](docs/images/accounts.png)

## Quick Start

```bash
cp .env.example .env
# Edit .env: set JWT_SECRET, ENCRYPTION_KEY, POSTGRES_PASSWORD, Teller creds
./scripts/build-backend.sh
docker compose up -d --build
```

Open http://localhost:8080. Demo: `me@test.com` / `Test1234!`

See [CONTRIBUTING.md](CONTRIBUTING.md) for prerequisites and full setup.

## Architecture

React 19 + Next.js frontend, Rust (Axum) backend, PostgreSQL, Redis. JWT auth. Docker Compose deployment.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

## Security

Self-hosted. No vendor data path.

- Data stays in your PostgreSQL
- Bank credentials never stored (Teller uses short-lived tokens)
- Provider tokens encrypted (AES-256-GCM)
- Wipe everything: `docker compose down -v`

## Roadmap

- Financial reports and data export
- Balance and budget notifications
- Receipt uploads and search

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Open Source under Apache 2.0 License. See [LICENSE](LICENSE).
