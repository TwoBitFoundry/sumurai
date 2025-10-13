# Sumaura — Personal Finance Dashboard

Sumaura is a full‑stack personal finance dashboard that connects to your bank via modern aggregators, syncs transactions, and visualizes spending with a modern, responsive UI.

**License**: Sustainable Use License – Community 1.0 (source-available, not OSI approved)

## Features

Comprehensive personal finance management with bank connectivity, transaction tracking, budgeting, and visual analytics.

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
Link bank accounts using Teller (self‑hosted) or Plaid (hosted) with on‑demand transaction syncing.

![Accounts](docs/images/accounts.png)

## Multi-Provider Support

Sumaura supports two providers so you can choose a self‑hosted Teller setup or use our hosted Plaid integration.

| Provider | Status | Highlights | Notes |
| --- | --- | --- | --- |
| **Teller** | ✅ Self‑hosted (private) | Supports ~7,000 US banks, mTLS security, parallelized balances | Recommended for private self‑hosting with bring‑your‑own API keys and full credential control. |
| **Plaid** | ✅ Hosted service | Supports ~12,000 institutions and richer categories/merchant data | Available via the official hosted service; not for public re‑hosting. |

- Set `DEFAULT_PROVIDER=teller` for self‑hosted deployments.

### Hosting Policy

- “Hosted” means operated by the Sumaura team for customers. Plaid is available via the official hosted service.
- “Self‑hosted” means private, non‑public deployments by the licensee. Teller supports bring‑your‑own API keys and is the recommended path.
- Public hosting or re‑hosting of this software is not permitted under the Sustainable Use License.
 - The hosted experience enables reliability, security posture, and data quality we can’t practically guarantee in self‑hosted setups (e.g., broader institution coverage, richer categorization via Plaid, proactive monitoring, and managed upgrades).

## At a Glance
Modern full-stack architecture with React frontend, Rust backend, PostgreSQL database, and Docker deployment.

### Architecture
Nginx-served SPA with Rust backend, PostgreSQL database, Redis cache, and multi-tenant Row-Level Security. See `docs/ARCHITECTURE.md` for the full diagram, data flow, caching, and RLS details.

- **Frontend**: React 18 + TypeScript + Vite, Tailwind CSS, Recharts
- **Backend**: Rust (Axum) + SQLx, PostgreSQL, Redis cache (required)
- **Auth**: JWT with refresh tokens
- **Deploy**: Nginx SPA + API proxy, Docker Compose

### Security & Privacy

Sumaura is designed to be self‑hosted with no vendor data path. With Teller, you keep full control of credentials (mTLS); Plaid is offered as a hosted option for broader coverage and richer categories. Redis caches are session‑scoped with automatic TTL expiry. There is no telemetry or third‑party analytics baked in.

- **Your Data Belongs to You:** user auth metadata, transactions, budgets, and derived analytics in your PostgreSQL instance.
- **Bank Credentials are Never Stored:** user credentials are not persisted; Plaid Link handles them in the browser and Teller uses short‑lived tokens with mTLS.
- **Secrets are Secure:** Provider access tokens are encrypted with AES‑256‑GCM using `ENCRYPTION_KEY`; Redis holds only short‑lived session data.
- **Delete Your Data Anytime:** run `docker compose down -v` to wipe containers/volumes, or `sqlx database reset -y` against your `DATABASE_URL`.


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
Configure JWT secrets and database connections. For private self‑hosting, use Teller.

1. Copy the sample environment file and edit it with your secrets:

   ```bash
   cp .env.example .env
   ```

   - Generate fresh values for `JWT_SECRET` and `ENCRYPTION_KEY` with `openssl rand -hex 32`.
   - For self‑hosting, no Plaid credentials are required. Set `DEFAULT_PROVIDER=teller`.

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
| `ENCRYPTION_KEY` | Yes | _none_ | 64 hex characters (32 bytes) for encrypting provider access tokens. Generate with `openssl rand -hex 32`. |
| `DEFAULT_PROVIDER` | Optional | `teller` | Choose which provider new users receive (`plaid` or `teller`). Defaults to `teller` for self-hosted scenarios. |
| `TELLER_APPLICATION_ID` | Yes (Teller) | _none_ | Your Teller application ID from the dashboard (used by Connect.js and backend). |
| `TELLER_CERT_PATH` | Yes (Teller) | `.certs/teller/certificate.pem` | Absolute or repo‑relative path to your Teller client certificate (PEM). Store in `.certs/` (gitignored). |
| `TELLER_KEY_PATH` | Yes (Teller) | `.certs/teller/private_key.pem` | Absolute or repo‑relative path to the Teller private key (PEM). Store in `.certs/` (gitignored). |
| `TELLER_ENV` | Optional (Teller) | `development` | Matches your Teller application environment (`sandbox`, `development`, `production`). Use `sandbox` for testing; `development` for real data in private self‑hosting. |

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
