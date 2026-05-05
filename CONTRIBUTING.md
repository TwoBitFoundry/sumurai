# Contributing to Sumurai

Thanks for helping improve Sumurai. This guide covers the current workflow, local validation commands, and the conventions used in this repository.

> Heads-up: end-to-end validation happens at `http://localhost:8080` through Nginx. The frontend dev server at `http://localhost:3001` is for UI iteration only.

## Prerequisites

- Node 24.10+ and npm 10+
- Rust stable and Cargo
- Docker and Docker Compose
- `sqlx-cli`
- OpenSSL

## Getting Started

Clone your fork and create a feature branch:

```bash
git clone <your-fork-url>
cd sumurai
git checkout -b feat/my-change
```

## Full Stack

Start the production-like stack:

```bash
docker compose up -d --build
```

For source-built local development, use the development compose override:

```bash
docker compose -f docker-compose.yml -f docker-compose.development.yml up -d --build
```

Demo credentials:

- Username: `me@test.com`
- Password: `Test1234!`

## Frontend Development

```bash
cd frontend
npm install
npm run dev
npm run build
npm test
```

Notes:

- `npm run dev` starts the Next.js dev server on `http://localhost:3001`.
- Use the Docker stack at `http://localhost:8080` to validate integrated flows.
- Supported local host platforms are macOS, Linux, and Windows through Docker Compose.

## Backend Validation

Use Cargo commands for backend changes:

```bash
cargo check --manifest-path backend/Cargo.toml
cargo test --manifest-path backend/Cargo.toml
cargo fmt --manifest-path backend/Cargo.toml --all --check
cargo clippy --manifest-path backend/Cargo.toml --all-targets --no-deps -- -D warnings
```

## Database Migrations

If you need to run migrations manually against a Postgres instance:

```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/accounting \
  sqlx migrate run
```

## Repository Layout

- `frontend/` - Next.js 16, React 19, TypeScript, Tailwind, Biome, Jest, Recharts
- `backend/` - Rust 1.95, Axum, SQLx, Redis, PostgreSQL, provider integrations, OpenTelemetry
- `docs/` - architecture, screenshots, compliance, and reference documents

## Coding Standards

- TypeScript: keep types precise, follow the existing hooks and service patterns, and use `tsc -b` for type checks.
- Rust: keep units small and testable, prefer idiomatic error handling, and use `cargo fmt` and `cargo clippy`.
- Tests: keep them in the existing test folders and update them when business logic changes.
- Secrets: never commit real secrets or `.env` files.

## Branches, Commits, and PRs

- Branch from `main` and keep PRs focused.
- Use Conventional Commits, for example `feat: add budgets summary chart` or `fix: handle empty transactions`.
- Use `feat!:` or `BREAKING CHANGE:` for breaking changes.
- Keep CI green before requesting review.
- Merge strategy is squash-and-merge on `main`.

## PR Checklist

- Feature or bug has a linked issue or a short rationale
- Code follows the existing patterns and keeps the blast radius small
- Tests were added or updated where needed
- The relevant validation commands pass locally
- No secrets or credentials were committed

## Troubleshooting

- Use `docker compose logs -f <service>` for logs.
- Use `docker compose down -v` to reset local data.
- Redis is required for the backend to start in Docker.
- Validate end-to-end behavior only through the Nginx-backed stack at `http://localhost:8080`.

## Environment Variables

The stack reads configuration from the environment. The most important variables are below.

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `JWT_SECRET` | Yes | — | 32+ hex chars. Generate with `openssl rand -hex 32`. |
| `ENCRYPTION_KEY` | Yes | — | 64 hex chars. Generate with `openssl rand -hex 32`. |
| `POSTGRES_PASSWORD` | Yes | — | Database password for Docker Compose. |
| `SEQ_PASSWORD` | Yes | — | Seq admin password. |
| `SEQ_API_KEY` | Yes | — | Seq ingestion key. |
| `TELLER_APPLICATION_ID` | Yes | — | Teller application ID. |
| `TELLER_CERT_PATH` | Yes | — | Host path to the Teller client cert PEM. |
| `TELLER_KEY_PATH` | Yes | — | Host path to the Teller private key PEM. |
| `DEFAULT_PROVIDER` | No | `teller` | Bank data provider selected by default. |
| `TELLER_ENV` | No | `sandbox` | `sandbox`, `development`, or `production`. |
| `PLAID_CLIENT_ID` | No | `mock_client_id` | Plaid client ID used by the backend. |
| `PLAID_SECRET` | No | `mock_secret` | Plaid secret used by the backend. |
| `PLAID_ENV` | No | `sandbox` | Plaid environment. |
| `CORS_ALLOWED_ORIGINS` | No | `http://localhost:8080` | Browser origins allowed to call the API with credentials. |
| `DOMAIN` | No | `localhost` | Hostname used by nginx and Let's Encrypt. |
| `SSL_PORT` | No | `8443` | HTTPS port for local TLS. |
| `LE_EMAIL` | No | — | Email for Let's Encrypt. |
| `NEXT_PUBLIC_API_BASE` | No | `/api` | Frontend API base path. |
| `NEXT_PUBLIC_OTEL_ENABLED` | No | `true` | Frontend OpenTelemetry toggle. |
| `NEXT_PUBLIC_OTEL_SERVICE_NAME` | No | `sumurai-frontend` | Frontend telemetry service name. |
| `NEXT_PUBLIC_OTEL_SERVICE_VERSION` | No | `1.0.0` | Frontend telemetry service version. |
| `NEXT_PUBLIC_OTEL_CAPTURE_BODIES` | No | `false` | Capture request/response bodies in frontend telemetry. |
| `NEXT_PUBLIC_OTEL_BLOCK_SENSITIVE_ENDPOINTS` | No | `true` | Redact sensitive endpoints from frontend telemetry. |

## Authentication Rate Limiting

Login and register under `/api/auth/` are rate limited in the Axum backend with progressive lockouts after repeated 429s. Nginx also applies a looser edge limit on `/api/auth` so only unusually high request rates are rejected before proxying to the backend.

## Teller Setup

1. Create a Teller developer account at [https://teller.io](https://teller.io).
2. Download the mTLS certificate and private key.
3. Set `TELLER_CERT_PATH` and `TELLER_KEY_PATH` to the host paths for those PEM files.
4. Set `TELLER_APPLICATION_ID` and `TELLER_ENV`.
5. Launch Teller Connect from the UI to link accounts.

## Sandbox Credentials

Use these provider test credentials for local sandbox flows:

- Teller
  - Username: `username`
  - Password: `password`
- Plaid
  - Username: `user_good`
  - Password: `pass_good`

If a sandbox provider prompts for 2FA, click through with empty fields.

For sandbox testing, allow the local origin in your Teller dashboard.

## HTTPS with Let's Encrypt

See [docs/PRODUCTION_TLS.md](docs/PRODUCTION_TLS.md) for the current production TLS workflow.

## License and Contributions

By contributing, you agree your contributions are licensed under the project’s license. See `LICENSE` for details.

If you are unsure about scope or approach, open a draft PR early or start a discussion in the issue tracker.
