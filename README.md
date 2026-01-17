# Sumurai, Your Personal Finance Dashboard

Sumurai is a full‑stack personal finance dashboard that connects to your bank via modern aggregators, syncs transactions, and visualizes spending with a modern, responsive UI.

**License**: Sustainable Use License – Community 1.0 (source-available, not OSI approved)

## Features

Comprehensive personal finance management with bank connectivity, transaction tracking, budgeting, and visual analytics. Sumurai connects to your bank via Teller for real‑time transaction syncing and data aggregation.


## Roadmap

What's coming next:

- Financial reports (monthly health score, export your data, and more)
- Notifications and alerts (balances, unusual activity, budget thresholds)
- Receipt uploads (attach and search receipts for transactions)
- Agentic features: receipt matching, conversational insights about your data, and smart suggestions

## What You'll See

### Dashboard & Analytics

Track balances, recent activity, and deeper spending insights on a single dashboard page. Compare time periods, drill into categories, and explore daily trends with responsive charts and cards.

![Dashboard](docs/images/dashboard-hero.png)
![Dashboard extras](docs/images/dashboard-extras.png)

### Transactions Workspace
Advanced transaction management with search, filtering, and categorization across all connected bank accounts.

![Transactions](docs/images/transactions.png)

### Budget Tracking

Create and adjust category budgets, monitor progress, and quickly spot overspending or headroom.

![Budgets](docs/images/budgets.png)

### Connect Accounts
Link bank accounts using Teller with on‑demand transaction syncing.

![Accounts](docs/images/accounts.png)


## At a Glance
Modern full-stack architecture with React frontend, Rust backend, PostgreSQL database, and Docker deployment.

### Architecture
Nginx-served SPA with Rust backend, PostgreSQL database, Redis cache, and multi-tenant Row-Level Security. See `docs/ARCHITECTURE.md` for the full diagram, data flow, caching, and RLS details.

- **Frontend**: React 19 + TypeScript + Next.js, Tailwind CSS, Recharts
- **Backend**: Rust (Axum) + SQLx, PostgreSQL, Redis cache (required)
- **Auth**: JWT with refresh tokens
- **Deploy**: Nginx SPA + API proxy, Docker Compose

### Security & Privacy

Sumurai is designed to be self‑hosted with no vendor data path. With Teller, you keep full control of credentials via mTLS. Redis caches are session‑scoped with automatic TTL expiry. There is no telemetry or third‑party analytics baked in.

- **Your Data Belongs to You:** user auth metadata, transactions, budgets, and derived analytics in your PostgreSQL instance.
- **Bank Credentials are Never Stored:** user credentials are not persisted; Teller uses short‑lived tokens with mTLS.
- **Secrets are Secure:** Provider access tokens are encrypted with AES‑256‑GCM using `ENCRYPTION_KEY`; Redis holds only short‑lived session data.
- **Delete Your Data Anytime:** run `docker compose down -v` to wipe containers/volumes, or `sqlx database reset -y` against your `DATABASE_URL`.

### Hosting Policy

- "Self‑hosted" means private, non‑public deployments by the licensee. Teller supports bring‑your‑own API keys and is the recommended path.
- Public hosting or re‑hosting of this software is not permitted under the Sustainable Use License.


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
Most configuration has sensible defaults. Only a few secrets require setup:

1. Copy the sample environment file and generate required secrets:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and fill in the required values (marked in the file):

   - `JWT_SECRET`: Generate with `openssl rand -hex 32`
   - `ENCRYPTION_KEY`: Generate with `openssl rand -hex 32`
   - `POSTGRES_PASSWORD`: Use anything for local dev (e.g., `password`)
   - `SEQ_PASSWORD`: Use anything for local dev (e.g., `ChangeMe123!`)
   - `SEQ_API_KEY`: Use anything for local dev (e.g., `test-api-key`)
   - `TELLER_APPLICATION_ID`: Get from your Teller dashboard
   - `TELLER_CERT_PATH` & `TELLER_KEY_PATH`: Path to your Teller certificates

   Other variables have defaults and only need to be set if you want to override them.

2. Build and start the stack:

   ```bash
   ./scripts/build-backend.sh
   docker compose up -d --build
   ```

3. Browse to http://localhost:8080 (nginx entry point) and sign in with `me@test.com` / `Test1234!`.

Ingress map (nginx):
- UI: `http://localhost:8080/`
- API docs (public): `http://localhost:8080/docs`
- Seq UI (public): `http://localhost:8080/seq`
- OTLP ingest (public endpoint routed to Seq): `http://localhost:8080/ingest/otlp`
- API routes remain internal-only; they are reachable from the compose network (for docs "Try it out" use) but not exposed publicly.
- Database (`postgres`) and cache (`redis`) are only reachable on the internal Docker network; connect via `docker compose exec` if you need CLI access.
 - HTTPS: Configure `DOMAIN` and run Let's Encrypt issuance (see below); HTTPS is exposed on `https://<DOMAIN>:8443` by default.

To stop everything: `docker compose down`. To remove data volumes: `docker compose down -v`.

### Environment Variables

Everything reads from `.env`. Most variables have sensible defaults set in `docker-compose.yml`. Override as needed for your environment.

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| **Core Secrets** | | | |
| `JWT_SECRET` | Yes | _none_ | 32+ hex character secret for signing access/refresh tokens. Generate with `openssl rand -hex 32`. |
| `ENCRYPTION_KEY` | Yes | _none_ | 64 hex characters for encrypting provider access tokens. Generate with `openssl rand -hex 32`. |
| `POSTGRES_PASSWORD` | Yes | _none_ | Database password. Can be any value for local dev. |
| `SEQ_PASSWORD` | Yes | _none_ | Seq service password for first-run setup. Can be any value for local dev. |
| `SEQ_API_KEY` | Yes | _none_ | API key for OpenTelemetry telemetry. Can be any value for local dev. |
| **Teller Integration** | | | |
| `TELLER_APPLICATION_ID` | Yes | _none_ | Your Teller application ID from the dashboard. |
| `TELLER_CERT_PATH` | Yes | _none_ | Path to Teller client certificate (PEM). Store in `.certs/` (gitignored). |
| `TELLER_KEY_PATH` | Yes | _none_ | Path to Teller private key (PEM). Store in `.certs/` (gitignored). |
| **Optional Configuration (override defaults if needed)** | | | |
| `CORS_ALLOWED_ORIGINS` | No | `http://localhost:8080` | Comma-separated list of allowed origins for backend CORS. Keep tight; add additional hosts only as needed. |
| `DOMAIN` | No | `localhost` | Public hostname used by nginx and Let's Encrypt certificates. |
| `SSL_PORT` | No | `8443` | External HTTPS port published by nginx (use 443 in production). |
| `LE_EMAIL` | No | _none_ | Email for Let's Encrypt registration (needed when issuing certs). |
| `DATABASE_URL` | No | `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}` | Computed from other env vars; override for non-Docker databases. |
| `REDIS_URL` | No | `redis://redis:6379` | Backend cache store; override for external Redis. |
| `POSTGRES_USER` | No | `postgres` | Database user for the Postgres container. |
| `POSTGRES_DB` | No | `accounting` | Database name created by Postgres container. |

### Enabling HTTPS with Let's Encrypt

1) Set `DOMAIN` and `LE_EMAIL` in your `.env` (e.g., `example.com`).
2) Start the stack (HTTP will work with a self-signed cert initially):
   ```bash
   docker compose up -d --build
   ```
3) Request a real certificate (HTTP-01 challenge via nginx):
   ```bash
   docker compose run --rm -e DOMAIN=$DOMAIN -e LE_EMAIL=$LE_EMAIL certbot \
     certonly --webroot -w /var/www/certbot \
     -d $DOMAIN --email $LE_EMAIL --agree-tos --no-eff-email
   ```
   (Use `--staging` first if you want to avoid rate limits.)
4) Restart nginx to load the issued cert:
   ```bash
   docker compose restart nginx
   ```
5) Access over HTTPS: `https://$DOMAIN:8443` (adjust port mapping if you bind 443 directly).
| `DEFAULT_PROVIDER` | No | `teller` | Provider for bank data aggregation. |
| `TELLER_ENV` | No | `sandbox` | Teller environment: `sandbox`, `development`, or `production`. |
| `PLAID_CLIENT_ID` | No | `mock_client_id` | Plaid client ID (only if using Plaid). |
| `PLAID_SECRET` | No | `mock_secret` | Plaid secret (only if using Plaid). |
| `PLAID_ENV` | No | `sandbox` | Plaid environment: `sandbox` or `production`. |
| `BACKEND_RUST_LOG` | No | `info` | Rust log level filter for backend (e.g., `info`, `debug`). |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | No | `http/protobuf` | OpenTelemetry protocol. |
| `OTEL_STARTUP_TEST_SPAN` | No | `0` | Set to `1` to emit a test span verifying Seq connectivity. |

### Provider-Specific Setup

#### Teller (Self-Hosted)

1. Create a Teller developer account at https://teller.io and add an application in the dashboard (bring your own API keys).
2. Download the mTLS certificate (`certificate.pem`) and private key (`private_key.pem`). Store them under `.certs/teller/` (this path is gitignored) or another secure, non‑tracked location.
3. Set `DEFAULT_PROVIDER=teller`, `TELLER_APPLICATION_ID`, and point `TELLER_CERT_PATH` / `TELLER_KEY_PATH` at the PEM files (mount them into the backend container when using Docker).
4. Pick the correct API environment with `TELLER_ENV` (`sandbox`, `development`, `production`).
5. Launch Teller Connect from the **Connect** tab to link accounts and trigger syncs via the unified sync service.

### Self-Hosting Checklist

1. Confirm Docker Compose, PostgreSQL, and Redis are available (either via `docker compose up` or external services).
2. Copy `.env.example` to `.env`, fill in JWT/ENCRYPTION secrets, and set `DEFAULT_PROVIDER=teller` for new users.
3. Run `./scripts/build-backend.sh` followed by `docker compose up -d --build` to rebuild the Axum binary for Linux and start the stack.
4. Store Teller PEM files securely and mount them for the backend container when using Teller.
5. Verify inbound HTTPS termination at your reverse proxy (nginx, Traefik, Caddy) before exposing the SPA publicly.

## Testing with Teller Sandbox
Use Teller’s sandbox to validate end‑to‑end flows in a private self‑hosted setup.

- Prerequisites
  - Set `DEFAULT_PROVIDER=teller` in `.env`.
  - Ensure `TELLER_ENV=sandbox` for sandbox testing.
  - Obtain sandbox application credentials from your Teller dashboard and configure your Connect.js integration (bring‑your‑own keys).
  - For self‑hosting with real data, set `TELLER_ENV=development` and use your development Teller application credentials.

- Launch the stack
  ```bash
  ./scripts/build-backend.sh
  docker compose up -d --build
  ```

- Open the app at `http://localhost:8080`
  - Sign in with the demo credentials from AGENTS.md.
  - Go to the Connect tab and launch Teller Connect.
  - Choose a sandbox institution and complete the flow using Teller’s documented sandbox test users.

- Verify data
  - Accounts appear under Accounts/Connect views once enrollment succeeds.
  - Use `Sync transactions` to pull sandbox transactions; inspect the Dashboard, Transactions, and Analytics tabs.

- Tips
  - If Connect.js does not load, confirm your app is served at `http://localhost:8080` and that your Teller dashboard allows localhost origins for sandbox.
  - Check backend logs for TLS/mTLS errors when hitting Teller APIs; verify `TELLER_CERT_PATH` and `TELLER_KEY_PATH` are mounted and readable by the container.
  - Set `RUST_BACKTRACE=1` and `RUST_LOG=debug` when troubleshooting backend requests.

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

## Contributing

We welcome focused PRs from the community. Start with `CONTRIBUTING.md` for tooling setup, style guides, and the review checklist.

## License

- SPDX: `LicenseRef-SUL-Community-1.0`
- Full terms: see `LICENSE`
- Note: source‑available; not an OSI‑approved open‑source license
