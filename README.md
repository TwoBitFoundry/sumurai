# Sumaura — Personal Finance Dashboard

Sumaura is a full‑stack personal finance dashboard that connects to your bank via Plaid, syncs transactions, and visualizes spending with a modern, responsive UI.

- Frontend: React 18 + TypeScript + Vite, Tailwind CSS, Recharts
- Backend: Rust (Axum) + SQLx, PostgreSQL, Redis cache (required)
- Auth: JWT with refresh tokens
- Deploy: Nginx SPA + API proxy, Docker Compose

## At a Glance

```bash
./scripts/build-backend.sh && docker compose up -d --build && echo "Open http://localhost:8080"
```

## Features

- Plaid bank connection (Link modal), multi‑account support
- Transaction sync, categorization, search and filters
- Analytics: current month spending, categories, daily and monthly trends
- Budgets: create, update, delete with category mapping
- Robust caching and RLS‑backed multi‑tenant isolation

## Repo Structure

- `frontend/` — React 18 + TypeScript + Vite; Tailwind; Recharts
- `backend/` — Rust + Axum + SQLx; Redis caching; RLS policies
- `scripts/` — build helpers (e.g., `build-backend.sh`)
- `docs/` — images/diagrams used in README

### Screenshots

<details>
<summary>Show screenshots</summary>

- Dashboard: ![Dashboard](docs/images/dashboard-hero.png) ![Dashboard extras](docs/images/dashboard-extras.png)
- Transactions: ![Transactions](docs/images/transactions.png)
- Budgets: ![Budgets](docs/images/budgets.png)
- Connect: ![Connect](docs/images/connect.png)

</details>

## Security & Privacy

- **Self‑hosted by default:** There is no vendor‑hosted backend. When you run with Docker Compose, all data stays within your infrastructure (PostgreSQL + Redis on your host). We do not collect or transmit your data to any external server we control.
- **No bank credentials stored:** Plaid Link runs in the browser; your banking credentials never pass through the backend and are never stored anywhere.
- **Encrypted secrets at rest:** Plaid access tokens are encrypted with AES‑256‑GCM using `ENCRYPTION_KEY` (64‑char hex). Keys are environment‑scoped and never committed to the repo or images.
- **Session‑scoped caching:** Redis caches are namespaced to a user session and TTL‑aligned to JWTs. On logout/expiry, caches become invalid and are purged automatically by TTL.
- **Strong isolation:** PostgreSQL Row‑Level Security (RLS) enforces per‑user data isolation; services run as non‑root containers.
- **No telemetry:** The app ships with zero tracking, analytics, or third‑party beacons.

### Data Storage Policy

- **Stored (within your environment):** minimal user auth data, transactions, budgets, and derived analytics required for the product features. All persisted in your PostgreSQL when self‑hosting.
- **Never stored:** bank credentials (handled by Plaid Link), raw Plaid passwords, or your data on third‑party servers we operate.
- **Encrypted tokens:** Plaid access tokens only, encrypted at rest; short‑lived session data in Redis (e.g., link sessions, mappings) with conservative TTLs.
- **Purge options:** remove all local data with `docker compose down -v`, or drop tables/migrate reset via `sqlx database reset -y` using your `DATABASE_URL`.

### Production Hardening (recommended)

- Run behind HTTPS (TLS) via a reverse proxy/ingress; set secure cookies.
- Rotate `JWT_SECRET` and `ENCRYPTION_KEY` periodically; store secrets in a vault.
- Restrict egress to only Plaid endpoints; monitor outbound traffic.
- Use a dedicated DB role with least privilege and enforce RLS.
- Enable scheduled data retention policies per your compliance needs.

## Environment Variables
The default `docker-compose.yml` provides sensible defaults. Override via your shell env if needed.

Required at runtime:

- `DATABASE_URL` (compose default: `postgresql://postgres:password@postgres:5432/accounting`)
- `REDIS_URL` (compose default: `redis://redis:6379`)
- `JWT_SECRET` (set in real deployments; not required for local E2E demo)

Optional (Plaid):

- `PLAID_CLIENT_ID`, `PLAID_SECRET` (defaults provided for sandbox)
- `PLAID_ENV` = `sandbox|development|production` (default: `sandbox`)
- `ENCRYPTION_KEY` 64‑char hex for AES‑256‑GCM (default dev key provided in compose)


## Run with Docker

Prerequisites: Docker and Docker Compose. For the fastest backend image build, use the prebuilt Linux binary.

1) Build backend binary (Linux x86_64):

```bash
./scripts/build-backend.sh
```

2) Start everything (frontend, backend, Redis, PostgreSQL):

```bash
docker compose up -d --build
```

3) Open: http://localhost:8080 (E2E creds: `me@test.com` / `Test1234!`)

4) Common variations:

```bash
# Backend stack only (API + DB + Redis)
docker compose up -d backend redis postgres

# Frontend only (proxies /api → backend)
docker compose up -d frontend

# Database migrations (inside backend image)
docker compose run --rm backend sqlx migrate run
```

5) Stop services:

```bash
docker compose down          # stop
docker compose down -v       # stop and remove volumes (data)
```

## Troubleshooting

- Check logs: `docker compose logs -f <service>`
- Reset local data: `docker compose down -v`


## Architecture

- SPA served by Nginx on 8080, proxying to a Rust (Axum) backend.
- Data: PostgreSQL for persistence and Redis for caching (required).
- Multi‑tenancy enforced via PostgreSQL Row‑Level Security (RLS).

See `docs/ARCHITECTURE.md` for the full diagram, data flow, caching, and RLS details.

## Multi‑Tenancy

- Tenant isolation is enforced via PostgreSQL RLS; details in `docs/ARCHITECTURE.md`.

## API Highlights

- Public: `GET /health`
- Auth: `POST /api/auth/(login|register|refresh|logout)`
- Transactions: `GET /api/transactions` (filter by date range, category, search)
- Plaid: Link token, exchange, accounts, sync, status, disconnect, clear synced data
- Analytics: current month, categories, daily spending, monthly totals

## Development (Local)

See `CONTRIBUTING.md` for full local setup, including:
- Frontend: dev server, tests, type‑checking
- Backend: running with local Redis, tests
- Migrations: running sqlx locally

## Contributing

We welcome focused PRs. Please read `CONTRIBUTING.md` for setup, coding standards, Conventional Commits, and the PR checklist.

## License

Sustainable Use License – Community 1.0 (SUL‑Community‑1.0).

- SPDX: `LicenseRef-SUL-Community-1.0`
- Full terms: see `LICENSE`
- Note: source‑available; not an OSI‑approved open‑source license
