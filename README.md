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

Screenshots (add your images under `docs/images/`):

- Dashboard: ![Dashboard](docs/images/dashboard.png)
- Transactions: ![Transactions](docs/images/transactions.png)
- Budgets: ![Budgets](docs/images/budgets.png)
- Analytics: ![Analytics](docs/images/analytics.png)

## Security & Privacy

- **Self‑hosted by default:** There is no vendor‑hosted backend. When you run with Docker Compose, all data stays within your infrastructure (Postgres + Redis on your host). We do not collect or transmit your data to any external server we control.
- **No bank credentials stored:** Plaid Link runs in the browser; your banking credentials never pass through the backend and are never stored anywhere.
- **Encrypted secrets at rest:** Plaid access tokens are encrypted with AES‑256‑GCM using `ENCRYPTION_KEY` (64‑char hex). Keys are environment‑scoped and never committed to the repo or images.
- **Session‑scoped caching:** Redis caches are namespaced to a user session and TTL‑aligned to JWTs. On logout/expiry, caches become invalid and are purged automatically by TTL.
- **Strong isolation:** PostgreSQL Row‑Level Security (RLS) enforces per‑user data isolation; services run as non‑root containers.
- **No telemetry:** The app ships with zero tracking, analytics, or third‑party beacons.

### Data Storage Policy

- **Stored (within your environment):** minimal user auth data, transactions, budgets, and derived analytics required for the product features. All persisted in your Postgres when self‑hosting.
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

2) Start everything (frontend, backend, Redis, Postgres):

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

### Diagram

```mermaid
flowchart LR

  A["Browser (React SPA)"] -->|SPA assets| B["Nginx (8080)"]
  A -->|/health| B
  A -->|/api/&#42;| B

  B -->|proxy /health| C["Backend (Axum, 3000)"]
  B -->|proxy /api/&#42;| C

  C -->|cache &#40;required&#41;| D[(Redis)]
  D --> C
  C -->|SQLx| E[(PostgreSQL)]
  E --> C

  C -.->|Plaid API| F["Plaid"]
  A -->|Plaid Link SDK| F

  subgraph "Docker Compose Network"
    B
    C
    D
    E
  end
```

### End‑to‑End Data Flow

1. Frontend requests `link_token` → opens Plaid Link.
2. Browser receives `public_token` → sends to backend `/api/plaid/exchange-token`.
3. Backend exchanges for `access_token`, encrypts (AES‑256‑GCM), stores, and seeds initial sync (cursor cached; transactions inserted into Postgres).
4. Frontend polls `/api/plaid/status` and reads accounts via `/api/plaid/accounts`.
5. Analytics requests compute over Postgres (optionally using the transaction cache for speed) and return aggregated results.

### Frontend

- SPA built with Vite and served by Nginx on port 8080.
- HTTP via a centralized `ApiClient` with retry + auto token refresh; domain services: `TransactionService`, `PlaidService`, `AnalyticsService`, `BudgetService`.
- Plaid integration with `react-plaid-link`; the browser receives a `link_token`, opens Link, and returns a short‑lived `public_token` which the backend exchanges.
- State via React hooks and custom hooks: `usePlaidConnection` (single) and `usePlaidConnections` (multi) to track connection status, accounts, and sync progress.
- Charts with Recharts; Tailwind CSS for styling.

### Backend

- Axum + SQLx service layout with trait‑based DI for testability.
- Auth with JWT access/refresh; middleware validates tokens and current user, backed by Redis for session cache.
- Plaid endpoints: link token generation, token exchange, accounts fetch, transaction sync, status, disconnect, and data clear. Plaid access tokens are encrypted using AES‑256‑GCM and stored server‑side.
- Analytics endpoints compute spending summaries and time‑series over transactions stored in Postgres (some results may leverage the transaction cache for speed).

### API Proxy

- Nginx serves static assets and proxies `GET /health` and `/api/*` to the backend at `backend:3000` inside the Compose network.

### Caching (Redis)

- Keys and intent:
  - `jwt:{jti}`: JWT session/allowlist with TTL matching token expiry (auth middleware checks).
- Invalidation:
  - On JWT expiry/logout: session‑scoped keys expire by TTL.
  - On Plaid disconnect or “clear synced data”: delete item‑scoped tokens, mappings, and transaction cache for the user/item.

### Database (PostgreSQL)

- Core tables include users, accounts, transactions, budgets, and Plaid items/tokens.
- RLS policies restrict every query to `current_setting('app.current_user_id')` to enforce per‑user isolation.
- Migrations managed by `sqlx migrate` and executed on container start.

## Multi‑Tenancy

- **Enforcement:** PostgreSQL Row‑Level Security (RLS) policies restrict every read/write to the authenticated user. Policies are defined per table (e.g., `transactions`, `accounts`, `budgets`) using `user_id = current_setting('app.current_user_id', true)::uuid`.
- **Request scoping:** After JWT validation, the backend sets `SET LOCAL app.current_user_id = '<uuid>';` for the request context so that all SQLx queries automatically obey RLS policies (no special query filters required).
- **Least privilege:** The application uses a DB role that cannot bypass RLS. Admin‑level access is never used by the API.
- **Caching isolation:** Redis keys are namespaced by session and/or user (e.g., `jwt:{jti}`) and by Plaid item where applicable. TTLs align with session lifetime so cached data cannot leak across users.
- Tenant‑safe analytics: All aggregations run against RLS‑protected views/tables, ensuring cross‑tenant queries are not possible even for summary data.

## API Highlights

- Public: `GET /health`
- Auth: `POST /api/auth/(login|register|refresh|logout)`
- Transactions: `GET /api/transactions` (filter by date range, category, search)
- Plaid: Link token, exchange, accounts, sync, status, disconnect, clear synced data
- Analytics: current month, categories, daily spending, monthly totals

## Development (Local)

Frontend (in `frontend/`):

```bash
cd frontend
npm install
npm run build         # or: npm run dev (port 5173)
npm test              # unit tests (Vitest + RTL)
npm run test:ui       # UI test runner
```

Backend (in repository root):

```bash
cargo check
cargo test
cargo build --release

# Run with local Redis
docker compose up -d redis
REDIS_URL=redis://localhost:6379 cargo run
```

Migrations (from `backend/`):

```bash
# Example local DB URL
DATABASE_URL=postgresql://postgres:password@localhost:5432/accounting \
  sqlx migrate run
```

## Contributing

Issues and PRs are welcome! Please keep changes focused, write clear commit messages, and add tests for business logic where it makes sense.

## License

Sustainable Use License – Community 1.0 (SUL‑Community‑1.0).

- SPDX: `LicenseRef-SUL-Community-1.0`
- Full terms: see `LICENSE`
- Note: source‑available; not an OSI‑approved open‑source license
