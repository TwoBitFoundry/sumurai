# Contributing to Sumurai

Thanks for your interest in improving Sumurai! This guide helps you get set up quickly, follow the project workflow, and submit high‑quality PRs.

> Heads‑up: End‑to‑end validation happens only at `http://localhost:8080` via Nginx → backend proxy. Vite dev (`:5173`) is fine for UI iteration, but not for full flows.

## Prerequisites

- Node 20+ and npm 9+
- Rust (stable) and Cargo
- Docker and Docker Compose
- cross (for macOS → Linux backend builds)
- sqlx‑cli (for running migrations locally)
- OpenSSL

<details>
<summary>macOS (Homebrew)</summary>

```bash
brew install rustup-init
rustup-init
cargo install cross --git https://github.com/cross-rs/cross

brew install node@20
brew install --cask docker
brew install openssl
```

</details>

<details>
<summary>Windows (Chocolatey)</summary>

```powershell
choco install rustup.install -y
rustup-init -y
cargo install cross --git https://github.com/cross-rs/cross

choco install nodejs-lts -y
choco install docker-desktop -y
choco install openssl-light -y
```

</details>

<details>
<summary>Linux (Debian/Ubuntu)</summary>

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
. "$HOME/.cargo/env"
cargo install cross --git https://github.com/cross-rs/cross

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin openssl
```

</details>

## Getting Started

Clone your fork and create a feature branch:

```bash
git clone <your-fork-url>
cd sumurai
git checkout -b feat/my-change
```

### Full Stack (Docker)

The fastest way to boot everything:

```bash
./scripts/build-backend.sh           # cross‑compile backend (x86_64 Linux)
docker compose up -d --build         # frontend + backend + redis + postgres
# Open http://localhost:8080
```

E2E demo credentials:
- Username: `me@test.com`
- Password: `Test1234!`

### Frontend Development

```bash
cd frontend-next
npm install
npm run dev               # Next.js dev server on :3001
npm run build             # production build (static export to ./out)
npm test                  # unit tests (Jest + RTL)
```

Notes:
- Validate integrated flows at `http://localhost:8080` (Docker) or use `npm run dev` for local development.
- For E2E testing, use `docker compose up -d --build` to run the full stack with Nginx proxy.

### Backend Development

Run with local Redis (Redis is required; no in‑memory fallback):

```bash
docker compose up -d redis
REDIS_URL=redis://localhost:6379 cargo run
```

Common cargo commands:

```bash
cargo check
cargo test
RUST_BACKTRACE=1 cargo test some_test -- --nocapture
cargo build --release
```

### Database Migrations

Using a local Postgres instance:

```bash
# Example: adjust host/port/user/password as needed
DATABASE_URL=postgresql://postgres:password@localhost:5432/accounting \
  sqlx migrate run
```

### Repo Structure (quick tour)

- `frontend-next/` — React 19 + TypeScript + Next.js; Tailwind; Recharts
- `backend/` — Rust + Axum + SQLx; Redis caching; RLS policies
- `scripts/` — build helpers (e.g., `build-backend.sh`)
- `docs/` — images/diagrams used in README

See `README.md` for architecture details and endpoint mapping.

## Coding Standards

- TypeScript: keep types precise; prefer hooks and services per the existing patterns. Run `tsc -b` to type‑check.
- Rust: prefer small, testable units; follow trait‑based DI for services. Use idiomatic error handling.
- Formatting/Linting: use project defaults (e.g., `cargo fmt`, `cargo clippy`, TypeScript/ESLint if configured). Keep changes focused and minimal.
- Tests: write or update unit tests when changing business logic (frontend or backend). Aim for Given/When/Then clarity.
- Secrets: never commit real secrets or `.env` files. Redis is mandatory in all code paths.

## Branch, Commits, and PRs

- Branch from `main` and keep PRs small and focused.
- Commit style: Conventional Commits. Examples:
  - `feat: add budgets summary chart`
  - `fix: handle empty transaction lists`
  - `refactor: extract transaction filter utils`
  - Use `feat!:` or include a `BREAKING CHANGE:` section in the PR description for breaking changes.
- Open a PR when ready; CI should be green before requesting review.
- Merge strategy: squash‑and‑merge on `main`.
- Releases: created automatically on `main` via semantic‑release; do not push tags manually.

### PR Checklist

- [ ] Feature/bug has a linked issue (or a brief rationale in the PR)
- [ ] Follows existing patterns and style; minimal blast radius
- [ ] Includes tests for changed business logic (if applicable)
- [ ] Builds and runs locally (`docker compose up -d --build` works)
- [ ] No secrets or credentials committed; docs updated if user‑facing behavior changed

## Troubleshooting

- Logs: `docker compose logs -f <service>`
- Reset local data: `docker compose down -v` (removes volumes)
- Common gotchas:
  - Backend fails fast without Redis; start Redis first for local runs.
  - Validate E2E only at `http://localhost:8080` (SPA + API proxy).

## Environment Variables

Everything reads from `.env`. Most variables have defaults in `docker-compose.yml`.

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| **Core Secrets** | | | |
| `JWT_SECRET` | Yes | — | 32+ hex chars. `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | Yes | — | 64 hex chars. `openssl rand -hex 32` |
| `POSTGRES_PASSWORD` | Yes | — | Any value for local dev |
| `SEQ_PASSWORD` | Yes | — | Any value for local dev |
| `SEQ_API_KEY` | Yes | — | Any value for local dev |
| **Teller** | | | |
| `TELLER_APPLICATION_ID` | Yes | — | From Teller dashboard |
| `TELLER_CERT_PATH` | Yes | — | Path to client cert (PEM). Store in `.certs/` |
| `TELLER_KEY_PATH` | Yes | — | Path to private key (PEM). Store in `.certs/` |
| **Optional** | | | |
| `CORS_ALLOWED_ORIGINS` | No | `http://localhost:8080` | Comma-separated origins |
| `DOMAIN` | No | `localhost` | Hostname for nginx and Let's Encrypt |
| `SSL_PORT` | No | `8443` | HTTPS port (use 443 in production) |
| `LE_EMAIL` | No | — | Email for Let's Encrypt |
| `DATABASE_URL` | No | Computed | Override for non-Docker databases |
| `REDIS_URL` | No | `redis://redis:6379` | Override for external Redis |
| `POSTGRES_USER` | No | `postgres` | Database user |
| `POSTGRES_DB` | No | `accounting` | Database name |
| `DEFAULT_PROVIDER` | No | `teller` | Bank data provider |
| `TELLER_ENV` | No | `sandbox` | `sandbox`, `development`, or `production` |
| `BACKEND_RUST_LOG` | No | `info` | Rust log level |

## Teller Setup

1. Create a Teller developer account at https://teller.io.
2. Download the mTLS certificate and private key. Store in `.certs/teller/` (gitignored).
3. Set `TELLER_APPLICATION_ID`, `TELLER_CERT_PATH`, and `TELLER_KEY_PATH` in `.env`.
4. Set `TELLER_ENV` (`sandbox`, `development`, `production`).
5. Launch Teller Connect from the Connect tab to link accounts.

For sandbox testing, use Teller's documented test credentials. Ensure localhost origins are allowed in your Teller dashboard.

## HTTPS with Let's Encrypt

1. Set `DOMAIN` and `LE_EMAIL` in `.env`.
2. Start the stack:
   ```bash
   docker compose up -d --build
   ```
3. Request a certificate:
   ```bash
   docker compose run --rm -e DOMAIN=$DOMAIN -e LE_EMAIL=$LE_EMAIL certbot \
     certonly --webroot -w /var/www/certbot \
     -d $DOMAIN --email $LE_EMAIL --agree-tos --no-eff-email
   ```
4. Restart nginx:
   ```bash
   docker compose restart nginx
   ```
5. Access via `https://$DOMAIN:8443`.

## License and Contributions

By contributing, you agree your contributions are licensed under the project’s license (Apache 2.0). See `LICENSE` for details.

If you’re unsure about scope or approach, open a draft PR early or start a discussion in the issue to align before implementation.
