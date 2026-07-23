# Sumurai Architecture

Authoritative reference for runtime architecture, data flow, API surface, caching, and database schema. For setup and env vars see `CONTRIBUTING.md`. For design tokens see `DESIGN.md`. For agent guardrails see `AGENTS.md`.

---

## Overview

Sumurai is a personal finance aggregator. Users connect one financial provider (Plaid, SimpleFIN, or DIY/self-managed); the app syncs accounts and transactions, and provides analytics and budgets. Legacy Teller connections may still appear in the UI (with icon); sync fails, and disconnect still works. Demo mode seeds SimpleFIN sample data.

```mermaid
flowchart LR
    Browser["Browser\n(Next.js SPA)"]

    subgraph "Docker network"
        Nginx["Nginx\n:8080"]
        Backend["Axum API\n:3000"]
        Redis[("Redis")]
        Postgres[("PostgreSQL")]
    end

    Plaid["Plaid API\n(OAuth)"]
    SimpleFIN["SimpleFIN Bridge\n(access URL)"]
    Paddle["Paddle Billing\n(prod compose only)"]
    Seq["Seq\n(prod only)"]

    Browser -->|"SPA assets"| Nginx
    Browser -->|"/api/*  /health"| Nginx
    Nginx -->|"proxy"| Backend
    Backend -->|"SeaORM"| Postgres
    Backend -->|"Redis client"| Redis
    Backend -.->|"OTLP (prod)"| Seq
    Backend -.->|"HTTPS"| Plaid
    Backend -.->|"HTTPS"| SimpleFIN
    Backend -.->|"HTTPS API + webhooks"| Paddle
```

- **Frontend** — Next.js static export served by Nginx on port 8080.
- **Backend** — Rust/Axum API on port 3000 (internal), behind Nginx proxy.
- **Providers** — Plaid, SimpleFIN, and DIY via a shared provider registry. Teller is not connectable (API sunset); legacy rows may still display.
- **Persistence** — PostgreSQL with row-level security; Redis for sessions, caching, and rate-limiting.
- **Observability** — OpenTelemetry end-to-end; export target (`none` / `console` / OTLP to Seq) set by `OTEL_TRACES_EXPORTER`.
- **Billing (production compose only)** — Paddle SaaS entitlement when `BILLING_MODE=paddle`. Own-data writes require `trialing` or `active` entitlement projected from verified webhooks.

Three standalone Compose files at the repo root (`docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.prod.yml`) — pick one, no merge overrides needed.

---

## Conventions

Business logic uses resolved transaction identity, not raw stored fields alone.

**Category:** effective category → stored `category_primary`. Effective = `transaction_category_overrides.category_name` when an override exists for the transaction’s `normalized_merchant`; otherwise the stored value. SQL: `effective_category_expr()` in `repository_service.rs`. Writes (sync, auto-categorization) update stored `category_primary`; overrides win at read time.

**Merchant:** `normalized_merchant` → `merchant_name` for grouping and matching. `merchant_name` is the normalized display label; `original_merchant_name` is raw provider text (UI detail only).

**Spending analytics:** exclude effective categories in `EXCLUDED_ANALYTICS_CATEGORY_PRIMARIES` (`repository_service.rs`) and non-expense amounts where relevant (e.g. top merchants).

**Frontend:** treat API `category_primary` as effective category; use `merchant_name` for display, not `original_merchant_name`, for charts or filters.

---

## Data Flow

### Authentication

```mermaid
sequenceDiagram
    participant Browser
    participant Nginx
    participant Axum
    participant Redis
    participant Postgres

    Browser->>Nginx: POST /api/auth/login
    Nginx->>Axum: proxy
    Axum->>Postgres: lookup user + verify password hash
    Postgres-->>Axum: user row
    Axum->>Redis: SET session_valid key (JWT TTL)
    Axum-->>Browser: 200 + Set-Cookie: access_token (HttpOnly)

    Note over Browser,Axum: Subsequent protected requests

    Browser->>Nginx: GET /api/transactions (with cookie)
    Nginx->>Axum: proxy
    Axum->>Axum: auth_middleware — verify JWT signature + claims
    Axum->>Redis: is_session_valid(jwt_id)?
    Redis-->>Axum: true
    Axum->>Postgres: SET app.current_user_id = user_id
    Axum->>Postgres: query (RLS enforces user isolation)
    Postgres-->>Axum: data
    Axum-->>Browser: 200 JSON
```

### Provider Sync

```mermaid
sequenceDiagram
    participant Browser
    participant Axum
    participant SyncService
    participant ProviderRegistry
    participant Provider as "Plaid / SimpleFIN"
    participant Postgres
    participant Redis

    Browser->>Axum: POST /api/providers/sync-transactions
    Axum->>Axum: resource_authorization — validate connection ownership
    Axum->>SyncService: sync_bank_connection_transactions()
    SyncService->>ProviderRegistry: get(provider_name)
    ProviderRegistry-->>SyncService: Arc<dyn FinancialDataProvider>
    SyncService->>Provider: get_accounts(credentials)
    Provider-->>SyncService: Vec<Account>
    SyncService->>Provider: get_transactions(credentials, start, end)
    Provider-->>SyncService: ProviderTransactionsResult
    SyncService->>Postgres: upsert accounts + transactions
    SyncService->>Redis: clear connection + transaction caches
    SyncService-->>Axum: (transactions, cursor, count)
    Axum-->>Browser: 200 JSON
```

### Production billing (Paddle)

Production billing runs only when `BILLING_MODE=paddle` (`docker-compose.prod.yml`). `BillingService` is composed once on `AppState` with `DatabaseRepository` and `PaddleClient`. Open cardless trial starts are gated by `BILLING_TRIALS_ENABLED` (`POST /api/billing/trials/start`). The frontend reads the runtime billing contract after authentication, renders the available pricing choices, initializes Paddle.js only for Paddle-enabled responses, and polls the shared billing-status query after checkout or trial creation until the webhook-projected entitlement reaches the workflow target.

**Entitlement source of truth:** verified Paddle webhooks update `billing_entitlements`. Trial start and checkout responses return `pending` until webhook processing completes. Own-data write routes call `billing_service.check_own_data_access*` before mutating tenant data.

**Frontend recovery and management:** a `402 PAID_ACCESS_REQUIRED` response dispatches a shared upgrade-required modal that routes the user to the Settings Plan section. That section resolves copy and actions from `GET /api/billing/status`: demo accounts can start a trial or Premium checkout, trialing accounts can add a payment method, past-due accounts can recover payment, and blocked accounts can restart Premium checkout. Portal links are requested on demand. Cancellation is confirmed in-app, scheduled at the next billing boundary, written optimistically to the billing-status cache, and reconciled by refetch and later Paddle webhooks.

```mermaid
sequenceDiagram
    participant Client
    participant Axum
    participant Billing as BillingService
    participant Paddle
    participant Postgres
    participant WH as Paddle webhook

    Client->>Axum: POST /api/billing/trials/start
    Axum->>Billing: start_open_trial()
    Billing->>Paddle: create_cardless_trial (custom_data.sumurai_user_id)
    Billing->>Postgres: upsert billing_profile
    Axum-->>Client: 200 { status: pending }

    Paddle->>WH: subscription.activated / transaction.completed
    WH->>Axum: POST /api/billing/webhooks/paddle (no JWT)
    Axum->>Billing: process_paddle_webhook()
    Billing->>Billing: verify Paddle-Signature HMAC
    Billing->>Postgres: record_paddle_webhook_event_if_new (global, no RLS)
    Billing->>Postgres: with_tenant(user_id) upsert billing_entitlements
    Axum-->>WH: 200 OK
```

```mermaid
sequenceDiagram
    participant Paddle
    participant Axum
    participant Billing as BillingService
    participant Repo as repository_service
    participant Postgres

    Paddle->>Axum: POST /api/billing/webhooks/paddle + Paddle-Signature
    Axum->>Billing: process_paddle_webhook(signature, raw_body)
    Billing->>Billing: verify_paddle_webhook_signature (before JSON parse)
    Billing->>Billing: parse envelope + data.custom_data.sumurai_user_id
    Billing->>Repo: record_paddle_webhook_event_if_new
    Repo->>Postgres: INSERT paddle_webhook_events ON CONFLICT DO NOTHING
    Postgres-->>Repo: rows_affected 0 or 1
    alt duplicate event_id
        Repo-->>Billing: false
        Billing-->>Axum: Ok (ack, no mutation)
    else new event
        Repo-->>Billing: true
        Billing->>Repo: get_billing_entitlement(user_id)
        Repo->>Postgres: SET app.current_user_id → read billing_entitlements
        Billing->>Billing: should_apply_event(last_event_at, occurred_at)
        alt out-of-order older event
            Billing-->>Axum: Ok (skip downgrade)
        else apply subscription lifecycle event
            Billing->>Repo: upsert_billing_entitlement
            Repo->>Postgres: SET app.current_user_id → upsert billing_entitlements
        end
    end
    Axum-->>Paddle: 200 OK
```

```mermaid
flowchart TD
    Write["Own-data write route\n(connect · sync · import · budget · DIY · Plaid)"]
    Demo{"user.demo_mode_active?"}
    BillingOn{"BILLING_MODE=paddle?"}
    Check["billing_service.check_own_data_access*()"]
    Entitlement{"access_status\ntrialing or active?"}
    Allow["Handler proceeds"]
    Block402["402 PAID_ACCESS_REQUIRED"]

    Write --> Demo
    Demo -- yes --> Allow
    Demo -- no --> BillingOn
    BillingOn -- disabled --> Allow
    BillingOn -- paddle --> Check --> Entitlement
    Entitlement -- yes --> Allow
    Entitlement -- no --> Block402
```

Monthly paid checkout (`POST /api/billing/checkout`) follows the same webhook-driven entitlement path after Paddle Checkout completes. Customer portal and payment-method flows call Paddle through `paddle_provider` but do not grant entitlement directly.

---

### Subscription Detection

Subscription detection runs as a background pass — never user-invoked. It has two layers:

**Layer 1 — master-list (instant, global).** `deterministic_label()` in `classifier_labels.rs` checks the transaction's merchant text against a pre-normalized list of known brands (`subscription_detection/known_merchants.rs`) before any keyword or ML branch. A match returns the `"Subscription"` label, which maps to `category_primary = "SUBSCRIPTION"`. This classifies even the first charge from a known brand.

**Layer 2 — cadence + amount heuristic (per-user, rolling 18 months).** After categorization runs, `detect_and_assign_for_user` promotes transactions in eligible categories (`ENTERTAINMENT`, `GENERAL_SERVICES`, `GENERAL_MERCHANDISE`, `RENT_AND_UTILITIES`, `PERSONAL_CARE`) to `SUBSCRIPTION` when they form a stable recurring pattern. User overrides always win — any merchant with an override row is excluded from the detection query.

```mermaid
flowchart TD
    Sync["Provider sync\nor CSV/OFX import"]
    Norm["MerchantNormalizationService\nnormalize_batch()\n→ sets merchant_name\n→ sets normalized_merchant"]
    Upsert["upsert_transactions_batch()\n→ writes normalized_merchant\nto transactions table"]
    AutoCat["AutoCategorizationService\n(ML + deterministic labels)"]
    MasterList{"Layer 1:\nnormalized_merchant\nmatches known brand?"}
    SubCat["category_primary = SUBSCRIPTION"]
    BgSpawn["tokio::spawn\ndetect_and_assign_for_user()"]

    subgraph Layer2["Layer 2 — cadence detection (per-user, 18-month window)"]
        Pull["get_transactions_for_subscription_detection()\namount < 0 · eligible categories · no override"]
        Group["group by normalized_merchant"]
        Exclusions{"in exclusion list?"}
        Cadence{"classify_cadence()\nday-gaps within tolerance?"}
        CV{"CV ≤ 0.15\n(stable amounts)?"}
        Count{"occurrences ≥\nmin threshold?"}
        BatchUpdate["update_transaction_categories_batch()\ncategory_primary = SUBSCRIPTION"]
    end

    Sync --> Norm --> Upsert --> AutoCat
    AutoCat --> MasterList
    MasterList -- yes --> SubCat
    MasterList -- no --> OtherCat["other category_primary"]
    AutoCat --> BgSpawn
    BgSpawn --> Pull --> Group --> Exclusions
    Exclusions -- excluded --> Skip1["skip merchant"]
    Exclusions -- not excluded --> Cadence
    Cadence -- irregular --> Skip2["skip merchant"]
    Cadence -- stable --> CV
    CV -- high variance --> Skip3["skip merchant"]
    CV -- stable --> Count
    Count -- too few --> Skip4["skip merchant"]
    Count -- enough --> BatchUpdate
```

**`classify_cadence` tolerance windows**

| Cadence | Target days | Tolerance |
|---------|-------------|-----------|
| Weekly | 7 | ±2 |
| Biweekly | 14 | ±2 |
| Monthly | 30 | ±10 |
| Quarterly | 91 | ±10 |
| Annual | 365 | ±20 |

Returns `None` (skip) if no window fits all gaps. Amount CV must be ≤ `0.15`. Minimum occurrences: 3 for short cadences (weekly/biweekly/monthly), 2 for long (quarterly/annual).

Subscription detection follows **Conventions** — it groups by normalized merchant, respects category overrides (merchants with an override row are excluded from Layer 2), and writes default `category_primary` on the transaction row when promoting to `SUBSCRIPTION`.

---

## Frontend

Next.js static export — no SSR at runtime. All HTTP goes through `ApiClient.ts`, which owns auth-refresh and retry. Provider-specific logic lives in the service and hook layer, not in page components.

```mermaid
flowchart TD
    App["App.tsx\nauth · onboarding · provider mismatch"]

    subgraph Services
        ApiClient["ApiClient.ts\nHTTP · auth refresh · retry"]
        AuthSvc["authService"]
        TxSvc["TransactionService"]
        AnalSvc["AnalyticsService"]
        BudgetSvc["BudgetService"]
        CatSvc["CategoryService"]
        ImportSvc["ImportService"]
        AutoCatSvc["AutoCategorizationService"]
        ProviderSvcs["PlaidService\nSimpleFinService"]
    end

    subgraph Features
        FTx["transactions"]
        FBudget["budgets"]
        FAnal["analytics"]
        FImport["import"]
        FProviders["plaid · simplefin · diy"]
        FAutoCat["auto-categorization"]
    end

    App --> AuthSvc & ApiClient
    FTx --> TxSvc & CatSvc & AutoCatSvc
    FBudget --> BudgetSvc
    FAnal --> AnalSvc
    FImport --> ImportSvc
    FProviders --> ProviderSvcs
    FAutoCat --> AutoCatSvc

    AuthSvc & TxSvc & AnalSvc & BudgetSvc & CatSvc & ImportSvc & AutoCatSvc & ProviderSvcs --> ApiClient
```

---

## Backend

Handlers → services → `repository_service` (SeaORM entities via `with_tenant`) / `cache_service` (Redis) / providers. Domain types in `models/`. Tests in `backend/src/tests/`.

```mermaid
flowchart TD
    Nginx["Nginx proxy"]

    subgraph Middleware["Middleware (in order)"]
        MW1["OtelAxumLayer"]
        MW2["CorsLayer"]
        MW3["auth_middleware"]
        MW4["auth_ip_ban"]
        MW5["resource_authorization"]
    end

    subgraph Handlers
        H1["auth"]
        H2["transactions"]
        H3["providers"]
        H4["analytics"]
        H5["budgets / categories"]
        H6["billing\nhandlers/billing.rs"]
    end

    subgraph MiddlewareExt["Entitlement (billing gates)"]
        Entitlement["middleware/entitlement.rs"]
    end

    subgraph Services
        RepoSvc["repository_service\n(SeaORM · with_tenant)"]
        CacheSvc["cache_service\n(Redis)"]
        SyncSvc["sync_service"]
        AuthSvc["auth_service"]
        BillingSvc["billing_service\n(entitlement · webhooks)"]
        OtherSvcs["analytics · budget · import\ncategory · auto-categorization\nconnection · plaid · simplefin"]
    end

    subgraph Providers
        Registry["ProviderRegistry"]
        P1["Plaid"]
        P2["SimpleFIN"]
        Paddle["paddle_provider\n(PaddleClient)"]
    end

    Nginx --> MW1 --> MW2 --> MW3 --> MW4 --> MW5
    MW5 --> H1 & H2 & H3 & H4 & H5
    Nginx --> H6

    H1 & H2 & H4 & H5 --> RepoSvc & CacheSvc & OtherSvcs
    H3 --> SyncSvc & OtherSvcs
    H3 & H5 --> Entitlement
    Entitlement --> BillingSvc
    H6 --> BillingSvc
    SyncSvc --> Registry --> P1 & P2
    BillingSvc --> RepoSvc & Paddle
    RepoSvc --> Postgres[("PostgreSQL")]
    CacheSvc --> Redis[("Redis")]
    Paddle -.->|"HTTPS"| PaddleAPI["Paddle Billing API"]
```

### Container build

GHCR backend images are produced from the **repository root** with `backend/Dockerfile` (see `publish-images` workflow). The image targets a Cargo **workspace** whose root manifest and lockfile live at `Cargo.toml` and `Cargo.lock`; members are `backend` (Axum API), `backend/entity` (SeaORM entities), `backend/migration` (SeaORM migrations), and `cli` (admin commands such as passkey reset).

Docker builds use **cargo-chef** so dependency layers stay cached when only application source changes:

| Stage | Role |
|-------|------|
| `planner` | Workspace manifests + stubs → `cargo chef prepare` → `recipe.json` |
| `builder` | `cargo chef cook` (deps) → copy `backend/` → `cargo build -p sumurai-backend -p migration` |
| `assets` | ONNX runtime + Hugging Face model artifacts (verified by checksum) |
| `runtime` | Debian slim + `sumurai-backend`, `migration` CLI, `docker-entrypoint.sh` |

The runtime container runs `docker-migrate.sh` then starts the API; see **Database Schema** for migration layout.

### Middleware stack (applied in order)

1. `OtelAxumLayer` — trace context propagation
2. `CorsLayer`
3. `auth_middleware` — JWT verification, Redis session-valid check, injects `app.current_user_id`
4. `auth_ip_ban` — failed-login rate-limit and IP ban via Redis
5. `resource_authorization` — validates connection and budget ownership before handlers run

---

## Provider System

Every provider implements `FinancialDataProvider` and registers by name in `providers/registry.rs` at startup. **Never branch on provider name in handlers or services** — resolve through the registry and extend the trait instead.

### Connect flows

```mermaid
flowchart LR
    subgraph Plaid
        direction TB
        P1["POST /api/plaid/link-token"] --> P2["Plaid Link widget"]
        P2 --> P3["public_token"]
        P3 --> P4["POST /api/plaid/exchange-token"]
        P4 --> P5["access_token\nencrypted → provider_credentials"]
    end

    subgraph SimpleFIN
        direction TB
        S1["paste setup token"] --> S2["POST /api/providers/connect"]
        S2 --> S3["access URL\nencrypted → simplefin_root_credentials"]
        S3 --> S4["sync materializes\nprovider_connections rows"]
    end
```

Legacy Teller connections are display-only: the UI may still show them with a provider icon, sync fails, and disconnect remains available.

### SimpleFIN specifics

- One access URL backs many `provider_connections` rows — each institution in the bridge snapshot gets its own row keyed by `simplefin_{org_conn_id}`.
- `simplefin_hidden_orgs` records disconnected orgs. Sync skips blocklisted `org_conn_id` values so they never produce new rows in `provider_connections`, `accounts`, or `transactions`.
- Manual sync is rate-limited to once per hour per user (Redis floor key).
- Disconnecting the last SimpleFIN institution removes the access URL and clears the ignore list — next connect requires a fresh setup token.

---

## API Routes

### Public

| Method | Path |
|--------|------|
| GET | `/health` |
| POST | `/api/auth/register` |
| POST | `/api/auth/login` |
| POST | `/api/auth/refresh` |
| POST | `/api/auth/logout` |

### Protected (JWT cookie required)

**Auth**

| Method | Path |
|--------|------|
| POST | `/api/auth/onboarding/complete` |
| DELETE | `/api/auth/account` |

**Transactions**

| Method | Path |
|--------|------|
| GET | `/api/transactions` |
| PUT | `/api/transactions/{id}/category` |
| GET | `/api/transactions/insights` |
| GET | `/api/transactions/categories` |
| POST/GET/DELETE | `/api/transactions/auto-categorize` |
| POST | `/api/transactions/import/validate` |
| POST | `/api/transactions/import` |

**Categories**

| Method | Path |
|--------|------|
| GET | `/api/categories` |
| POST | `/api/categories/custom` |
| PUT/DELETE | `/api/categories/custom/{id}` |

**Providers**

| Method | Path |
|--------|------|
| GET | `/api/providers/info` |
| POST | `/api/providers/select` |
| POST/GET | `/api/providers/connect` |
| GET | `/api/providers/status` |
| GET | `/api/providers/accounts` |
| POST | `/api/providers/sync-transactions` |
| POST | `/api/providers/disconnect` |
| GET/DELETE | `/api/providers/simplefin/ignored-institutions` |
| POST | `/api/plaid/link-token` |
| POST | `/api/plaid/exchange-token` |
| GET | `/api/plaid/accounts` |
| POST | `/api/plaid/clear-synced-data` |

**Analytics**

| Method | Path |
|--------|------|
| GET | `/api/analytics/spending/current-month` |
| GET | `/api/analytics/spending` |
| GET | `/api/analytics/daily-spending` |
| GET | `/api/analytics/categories` |
| GET | `/api/analytics/monthly-totals` |
| GET | `/api/analytics/top-merchants` |
| GET | `/api/analytics/balances/overview` |
| GET | `/api/analytics/net-worth-over-time` |

**Budgets**

| Method | Path |
|--------|------|
| GET/POST | `/api/budgets` |
| PUT/DELETE | `/api/budgets/{id}` |

**Billing (production `BILLING_MODE=paddle`; status readable when disabled)**

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/billing/status` | JWT |
| POST | `/api/billing/checkout` | JWT |
| POST | `/api/billing/trials/start` | JWT |
| POST | `/api/billing/payment-method` | JWT |
| POST | `/api/billing/portal-session` | JWT |
| POST | `/api/billing/subscription/cancel` | JWT |
| POST | `/api/billing/webhooks/paddle` | Paddle signature (no JWT) |

When billing is disabled, mutations and the webhook return `404 BILLING_DISABLED`; status returns `billing_enabled: false`.

---

## Caching

All Redis access goes through `cache_service.rs`. TTL constants are at the top of that file — update them there and here together.

| Cache Key Pattern | TTL | Invalidated When |
|-------------------|-----|-----------------|
| `{jwt_id}_session_valid` | Remaining JWT TTL | Logout or expiry |
| `{jwt_id}_{item_id}_access_token` | 3600 s (1 h) | Provider disconnect |
| `{jwt_id}_bank_connection_{conn_id}` | 7200 s (2 h) | Sync or disconnect |
| `{jwt_id}_bank_accounts_{conn_id}` | 7200 s (2 h) | Sync or disconnect |
| `{jwt_id}_synced_transactions` | 1800 s (30 min) | Sync completes |
| `{jwt_id}_budgets` | 300 s (5 min) | Budget create / update / delete |
| `auth_rate_limit_{ip}` | per policy | — |
| `auth_ip_ban_{ip}` | per policy | — |

All keys are scoped to `jwt_id`. There are no cross-user keys.

---

## Multi-Tenancy & Security

- `auth_middleware` sets `app.current_user_id` on the Postgres connection before every query. RLS policies on every user-scoped table enforce `USING (user_id = current_setting('app.current_user_id', true)::uuid)` — isolation holds even if application code omits a `WHERE user_id` clause.
- Billing user-owned tables (`billing_profiles`, `billing_entitlements`) use the same RLS pattern. Repository methods call `with_tenant(user_id)` before reads or writes. Paddle webhook processing resolves `user_id` from verified payload `custom_data.sumurai_user_id`, then scopes entitlement updates through `with_tenant`. Global table `paddle_webhook_events` (idempotency audit) has no RLS by design.
- The app role cannot bypass RLS. Do not write queries that assume superuser access.
- `resource_authorization` middleware validates connection and budget ownership before handlers run.
- Redis keys are namespaced by `jwt_id` — never use a global key for user data.
- Provider credentials are AES-GCM encrypted before persistence (`utils/encryption_key.rs`).

---

## Database Schema

Migrations live in [`backend/migration/`](../backend/migration/) and are applied when the backend container starts: `backend/scripts/docker-migrate.sh` handles legacy SQLx cutover (snapshot, data export, SeaORM schema, restore), then `Migrator::up` in [`backend/src/main.rs`](../backend/src/main.rs) applies incremental migrations. Generated table mappings are in [`backend/entity/`](../backend/entity/). Repository code uses the entity DSL; raw SQL via `Statement::from_sql_and_values` is a deliberate escape hatch for joins/aggregates the DSL cannot express. RLS tenant context (`set_config('app.current_user_id', …)`) is unchanged in behavior — it is centralized in `backend/src/utils/tenant_context.rs` and invoked through `PostgresRepository::with_tenant`.

```mermaid
erDiagram
    users {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar provider
        boolean onboarding_completed
        timestamptz created_at
        timestamptz updated_at
    }
    provider_connections {
        uuid id PK
        uuid user_id FK
        varchar item_id UK
        boolean is_connected
        timestamptz last_sync_at
        varchar institution_name
        varchar institution_id
        varchar institution_logo_url
        integer transaction_count
        integer account_count
        varchar sync_cursor
        varchar provider
        timestamptz created_at
        timestamptz updated_at
    }
    provider_credentials {
        uuid id PK
        uuid user_id FK
        varchar item_id UK
        bytea encrypted_access_token
        timestamptz created_at
        timestamptz updated_at
    }
    simplefin_root_credentials {
        uuid user_id PK
        bytea encrypted_access_url
        timestamptz setup_token_used_at
        timestamptz created_at
        timestamptz updated_at
    }
    simplefin_hidden_orgs {
        uuid user_id PK
        text org_conn_id PK
        timestamptz hidden_at
    }
    accounts {
        uuid id PK
        uuid user_id FK
        uuid provider_connection_id FK
        varchar provider_account_id
        varchar name
        varchar account_type
        decimal balance_current
        varchar mask
        varchar subtype
        varchar official_name
        timestamptz created_at
        timestamptz updated_at
    }
    transactions {
        uuid id PK
        uuid account_id FK
        uuid user_id FK
        varchar provider_transaction_id
        decimal amount
        date date
        varchar merchant_name
        text normalized_merchant
        varchar category_primary
        varchar category_detailed
        varchar category_confidence
        boolean pending
        timestamptz created_at
    }
    budgets {
        uuid id PK
        uuid user_id FK
        varchar category
        decimal amount
        timestamptz created_at
        timestamptz updated_at
    }
    user_custom_categories {
        uuid id PK
        uuid user_id FK
        varchar display_name
        varchar lookup_key
        timestamptz created_at
        timestamptz updated_at
    }
    transaction_category_overrides {
        uuid id PK
        uuid user_id FK
        text normalized_merchant
        varchar category_name
        uuid custom_category_id FK
        timestamptz created_at
        timestamptz updated_at
    }
    billing_profiles {
        uuid user_id PK
        text paddle_customer_id UK
        text paddle_address_id
        text billing_country_code
        text billing_postal_code
        timestamptz created_at
        timestamptz updated_at
    }
    billing_entitlements {
        uuid user_id PK
        text access_status
        text source
        text paddle_subscription_id UK
        text paddle_customer_id
        text paddle_price_id
        timestamptz trial_ends_at
        timestamptz current_period_ends_at
        timestamptz canceled_at
        timestamptz last_event_at
        boolean payment_method_required
        timestamptz created_at
        timestamptz updated_at
    }
    paddle_webhook_events {
        text event_id PK
        text event_type
        timestamptz occurred_at
        timestamptz processed_at
        text processing_status
        uuid related_user_id FK
        text related_subscription_id
        text error_code
        timestamptz created_at
    }

    users ||--o{ provider_connections : ""
    users ||--o{ provider_credentials : ""
    users ||--o| simplefin_root_credentials : ""
    users ||--o{ simplefin_hidden_orgs : ""
    users ||--o{ accounts : ""
    users ||--o{ transactions : ""
    users ||--o{ budgets : ""
    users ||--o{ user_custom_categories : ""
    users ||--o{ transaction_category_overrides : ""
    users ||--o| billing_profiles : ""
    users ||--o| billing_entitlements : ""
    users ||--o{ paddle_webhook_events : "related_user_id"
    provider_connections ||--o{ accounts : ""
    accounts ||--o{ transactions : ""
    user_custom_categories ||--o{ transaction_category_overrides : ""
```

---

## Development URLs

| URL | Use |
|-----|-----|
| `http://localhost:8080` | Full stack through Nginx — **use for validation** |
| `http://localhost:3001` | Next.js dev server (HMR only) — bypasses Nginx, won't catch proxy/auth issues |
| `http://localhost:8080/scalar` | API docs UI |
| `http://localhost:8080/api-docs/openapi.json` | Raw OpenAPI spec |
