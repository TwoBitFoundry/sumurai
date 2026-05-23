# Sumurai Architecture

This document describes the current runtime architecture, data flow, and major components in Sumurai. For setup and commands, see `README.md` and `CONTRIBUTING.md`.

## Overview

- Frontend: a static Next.js export built from `frontend/` and served by Nginx on port 8080.
- Backend: a Rust 1.95 Axum API in `backend/` with SQLx, JWT auth, Redis caching, and PostgreSQL persistence.
- Providers: Teller and Plaid are both supported through a shared provider registry.
- Observability: OpenTelemetry end to end. The OSS compose file turns off browser export and uses `OTEL_TRACES_EXPORTER=none`; dev compose uses console export; production compose (`docker-compose.prod.yml`) enables OTLP to Seq and the full nginx template for Seq UI and ingestion.
- Deployment: three standalone Compose files at the repo root (`docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.prod.yml`) so you pick the stack without merge overrides.

## Diagram

```mermaid
flowchart LR
  Browser["Browser (Next.js export)"] -->|SPA assets| Nginx["Nginx (8080)"]
  Browser -->|/api/*| Nginx
  Browser -->|/health| Nginx

  Nginx -->|proxy /api/*| Backend["Backend (Axum, 3000)"]
  Nginx -->|proxy /health| Backend

  Backend -->|cache| Redis[(Redis)]
  Backend -->|SQLx| Postgres[(PostgreSQL)]
  Backend -.->|OTLP when using prod compose| Seq["Seq"]
  Backend -.->|Teller / Plaid| Providers["External Aggregators"]

  subgraph "Typical compose network"
    Nginx
    Backend
    Redis
    Postgres
  end
```

## End-to-End Data Flow

1. The browser loads the exported frontend through Nginx.
2. The frontend validates the session with the backend and keeps auth state synchronized.
3. When a user connects a provider, the frontend opens the provider-specific flow for Teller, Plaid, or SimpleFIN.
4. The backend receives the provider token exchange, encrypts provider secrets, and stores them in PostgreSQL.
5. Sync services fetch accounts and transactions from the selected provider through the shared provider registry.
6. The backend normalizes transactions, updates the cache, and persists the latest state.
7. The dashboard reads analytics, budgets, and account data through `/api/*` endpoints.

## Provider Flow

- `DEFAULT_PROVIDER` determines the default provider shown by the app.
- The backend registers Teller, Plaid, and SimpleFIN implementations in a shared provider registry.
- The frontend uses provider-specific services and connect flows for each provider.
- `/api/providers/info`, `/api/providers/select`, `/api/providers/connect`, `/api/providers/status`, `/api/providers/accounts`, `/api/providers/sync-transactions`, and `/api/providers/disconnect` support the provider management UX.
- Provider credentials are encrypted before persistence and invalidated through cache cleanup when a connection is removed.

### SimpleFIN

- A user pastes a one-time setup token in the UI. The backend claims it against the SimpleFIN bridge and stores a single access URL per user under `simplefin_root_{user_id}` in encrypted provider credentials.
- One access URL backs many `provider_connections` rows: each financial institution in the bridge snapshot becomes `simplefin_{org_conn_id}` with its own accounts and transactions.
- Re-sync and connect reuse the stored access URL; the bridge response may still list institutions the user removed in Sumurai.
- `simplefin_hidden_orgs` records orgs the user disconnected. Sync and connect skip blocklisted `org_conn_id` values so disconnected institutions do not get new rows in `provider_connections`, `accounts`, or `transactions`, and no cache entries are keyed on that org.
- Manual SimpleFIN sync is rate-limited per user (Redis floor key, one hour) to respect bridge usage expectations.

## Frontend

- The frontend lives under `frontend/` and builds to a static `out/` directory.
- `frontend/src/App.tsx` coordinates authentication, onboarding, provider mismatch handling, and the authenticated app shell.
- `frontend/src/services/ApiClient.ts` centralizes API access with retry and auth refresh behavior.
- Provider-specific flows live in the frontend service and hook layer rather than in page components.
- OpenTelemetry instrumentation is configured in the browser and gated by `NEXT_PUBLIC_OTEL_*` flags.

## Backend

- `backend/src/main.rs` wires routes, middleware, providers, and shared application state.
- Business logic is separated into `backend/src/services/`.
- Domain models live in `backend/src/models/`.
- Tests live in `backend/src/tests/`.
- Middleware covers auth, IP banning, resource authorization, and telemetry.
- The backend uses Axum, SQLx, Redis, PostgreSQL, JWT access tokens, and OpenTelemetry; trace export targets depend on `OTEL_TRACES_EXPORTER` (none, console, or OTLP to a collector such as Seq in production compose).

## API Proxy

- Nginx serves the static frontend assets.
- Nginx proxies `/api/*` and `/health` to the backend container.
- The runtime container listens on port 8080 for the user-facing app.

## Caching

Redis is required for sessions, rate limiting, and request caches.

Current cache lifetimes in code:

- JWT/session validity follows the remaining JWT TTL
- Provider access tokens: 1 hour
- Account and bank connection metadata: 2 hours
- Recent transaction sync cache: 30 minutes
- Budgets cache: 5 minutes

Cache keys are namespaced by session, connection, and account identifiers so provider data stays isolated per user and connection.

## Database

- PostgreSQL stores users, accounts, transactions, budgets, provider connections, provider credentials, onboarding state, and related metadata.
- Migrations are applied with `sqlx migrate`.
- Row-level security enforces tenant isolation at the database layer.

## Multi-Tenancy

- The backend sets the authenticated user context after JWT validation.
- PostgreSQL RLS policies restrict reads and writes to the current user.
- The application role is not intended to bypass RLS.
- Redis cache keys are scoped to the session and provider context to prevent cross-user leakage.

## Development URLs

- Use `http://localhost:8080` for integrated validation through Nginx.
- Use `http://localhost:3001` for frontend-only development.
