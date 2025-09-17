# Sumaura — Personal Finance Dashboard

Sumaura is a full‑stack personal finance dashboard that connects to your bank via Plaid, syncs transactions, and visualizes spending with a modern, responsive UI.

**License**: Sustainable Use License – Community 1.0 (source-available, not OSI approved)

## Features

Comprehensive personal finance management with bank connectivity, transaction tracking, budgeting, and visual analytics.

### Dashboard & Analytics

Track balances, recent activity, and deeper spending insights on a single dashboard page. Compare time periods, drill into categories, and explore daily trends with responsive charts and cards.

![Dashboard](docs/images/dashboard-hero.png)
![Dashboard extras](docs/images/dashboard-extras.png)

### Transactions Workspace
Advanced transaction management with search, filtering, and categorization across all connected bank accounts.

Search, filter, and inspect synced transactions across all linked accounts, merchants, and categories.

![Transactions](docs/images/transactions.png)

### Budget Tracking

Create and adjust category budgets, monitor progress, and quickly spot overspending or headroom.

![Budgets](docs/images/budgets.png)

### Plaid Connection flow
Secure bank account linking through Plaid with sandbox testing and on-demand transaction syncing.

![Connect](docs/images/connect.png)

### At a Glance
Modern full-stack architecture with React frontend, Rust backend, PostgreSQL database, and Docker deployment.

- **Frontend**: React 18 + TypeScript + Vite, Tailwind CSS, Recharts
- **Backend**: Rust (Axum) + SQLx, PostgreSQL, Redis cache (required)
- **Auth**: JWT with refresh tokens
- **Deploy**: Nginx SPA + API proxy, Docker Compose

## Getting Started

Quick setup guide for local development with Docker Compose and required toolchain installation.

### Prerequisites

Install the toolchain below for your platform, then restart your shell.

<details>
<summary>macOS (Homebrew)</summary>

```bash
# Rust + cargo
brew install rustup-init
rustup-init
cargo install cross --git https://github.com/cross-rs/cross

# Node.js 20
brew install node@20

# Docker Desktop (includes Compose v2)
brew install --cask docker

# OpenSSL
brew install openssl
```

</details>

<details>
<summary>Windows (Chocolatey)</summary>

```powershell
# Run in an elevated PowerShell prompt

# Rust + cargo
choco install rustup.install -y
rustup-init -y
cargo install cross --git https://github.com/cross-rs/cross

# Node.js 20
choco install nodejs-lts -y

# Docker Desktop (includes Compose v2)
choco install docker-desktop -y

# OpenSSL
choco install openssl-light -y
```

</details>

<details>
<summary>Linux (Debian/Ubuntu)</summary>

```bash
# Rust + cargo
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
. "$HOME/.cargo/env"
cargo install cross --git https://github.com/cross-rs/cross

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Docker + Compose v2
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin

# OpenSSL
sudo apt-get install -y openssl
```

</details>

### Setting Up the Environment Variables
Configure Plaid credentials, JWT secrets, and database connections for local development.

1. Copy the sample environment file and edit it with your secrets:

   ```bash
   cp .env.example .env
   ```

   - Generate fresh values for `JWT_SECRET` and `ENCRYPTION_KEY` with `openssl rand -hex 32`.
   - Retrieve Plaid sandbox credentials (`PLAID_CLIENT_ID`, `PLAID_SECRET`) from the Plaid Dashboard.

2. Build and start the stack:

   ```bash
   ./scripts/build-backend.sh
   docker compose up -d --build
   ```

3. Browse to http://localhost:8080 and sign in with `me@test.com` / `Test1234!`.

To stop everything: `docker compose down`. To remove data volumes: `docker compose down -v`.

### Environment Variables

Everything reads from `.env`. The defaults below match `.env.example` and the Docker Compose configuration. Override as needed for your environment.

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}` | Backend connection string used at startup and for migrations. |
| `REDIS_URL` | Yes | `redis://redis:6379` | Backend cache store; the app fails fast if Redis is unreachable. |
| `POSTGRES_USER` | Yes | `postgres` | Seeds the Postgres container and feeds `DATABASE_URL`. |
| `POSTGRES_PASSWORD` | Yes | `password` | Same as above—change for any shared environment. |
| `POSTGRES_DB` | Yes | `accounting` | Database created by the container; referenced in `DATABASE_URL`. |
| `JWT_SECRET` | Yes (non-local) | _none_ | 32+ character secret for signing access/refresh tokens. Generate with `openssl rand -hex 32`. |
| `ENCRYPTION_KEY` | Yes (Plaid) | _none_ | 64 hex characters (32 bytes) for encrypting Plaid access tokens. Generate with `openssl rand -hex 32`. |
| `PLAID_CLIENT_ID` | Yes (Plaid) | _none_ | Obtain from the Plaid Dashboard. Required even for sandbox testing. |
| `PLAID_SECRET` | Yes (Plaid) | _none_ | Obtain from the Plaid Dashboard. |
| `PLAID_ENV` | Optional | `sandbox` | Choose `sandbox`, `development`, or `production`. |

**Plaid API setup:** Get sandbox credentials at https://dashboard.plaid.com and review the mock-data guide at https://plaid.com/docs/sandbox/.

## Testing with Plaid Mock Data
Use Plaid sandbox environment with mock institutions and transactions for development testing.

- Set `PLAID_ENV=sandbox` in `.env`.
- Launch the app and connect any sandbox institution via Plaid Link using `user_good` / `pass_good`.
- Use the Connect tab to sync transactions; mock data flows through the normal analytics and budget views.
- When ready for live data, swap to production credentials and update `PLAID_ENV`.

## Run with Docker
Flexible Docker Compose commands for running individual services or the complete stack.

Once the stack is running, these variations come in handy:

```bash
# Backend stack only (API + DB + Redis)
docker compose up -d backend redis postgres

# Frontend only (proxies /api → backend)
docker compose up -d frontend

# Database migrations (inside backend image)
docker compose run --rm backend sqlx migrate run
```

Stop services with `docker compose down`. Append `-v` to remove data volumes.

## Troubleshooting
Common solutions for Docker issues, environment variables, and service connectivity problems.

- Check logs: `docker compose logs -f <service>`
- Reset local data: `docker compose down -v`
- Backend exits immediately with `JWT_SECRET` error → define it in `.env` (see Environment Variables).


## Security & Privacy

Sumaura is designed to be self-hosted with no vendor data path. Plaid credentials stay on the client, encrypted access tokens live in your database, and Redis caches are session-scoped with automatic TTL expiry. There is no telemetry or third-party analytics baked in.

<details>
<summary>Data storage policy (what stays where)</summary>

- **Stored locally:** user auth metadata, transactions, budgets, and derived analytics in your PostgreSQL instance.
- **Never stored:** bank usernames/passwords (Plaid Link handles them in the browser) or any data on our servers.
- **Encrypted secrets:** Plaid access tokens are encrypted with AES-256-GCM using `ENCRYPTION_KEY`; Redis holds only short-lived session data.
- **Purge options:** run `docker compose down -v` to wipe containers/volumes, or `sqlx database reset -y` against your `DATABASE_URL`.

</details>

<details>
<summary>Production hardening checklist</summary>

- Terminate TLS in a reverse proxy/ingress and enforce secure cookies.
- Rotate `JWT_SECRET` and `ENCRYPTION_KEY`; store them in a secrets manager.
- Restrict outbound traffic to Plaid endpoints and audit outbound logs.
- Run Postgres with least-privilege roles and keep RLS enforced.
- Define retention policies that match your compliance requirements.

</details>

## Architecture
Nginx-served SPA with Rust backend, PostgreSQL database, Redis cache, and multi-tenant Row-Level Security.

- SPA served by Nginx on 8080, proxying to a Rust (Axum) backend.
- Data: PostgreSQL for persistence and Redis for caching (required).
- Multi‑tenancy enforced via PostgreSQL Row‑Level Security (RLS).

See `docs/ARCHITECTURE.md` for the full diagram, data flow, caching, and RLS details.

### Multi‑Tenancy
PostgreSQL Row-Level Security ensures complete data isolation between users.

- Tenant isolation is enforced via PostgreSQL RLS; details in `docs/ARCHITECTURE.md`.

### Repo Structure
Organized codebase with separate frontend, backend, build scripts, and documentation directories.

- `frontend/` — React 18 + TypeScript + Vite; Tailwind; Recharts
- `backend/` — Rust + Axum + SQLx; Redis caching; RLS policies
- `scripts/` — build helpers (e.g., `build-backend.sh`)
- `docs/` — images/diagrams used in README

## Development (Local)

See `CONTRIBUTING.md` for full local setup, including:
- Frontend dev server, tests, and type-checking commands
- Backend workflows (Redis/Postgres, `cargo` tasks, sqlx migrations)
- CI expectations, Conventional Commits, and pull-request checklist

## Contributing

We welcome focused PRs from the community. Start with `CONTRIBUTING.md` for tooling setup, style guides, and the review checklist.

## License

- SPDX: `LicenseRef-SUL-Community-1.0`
- Full terms: see `LICENSE`
- Note: source‑available; not an OSI‑approved open‑source license
