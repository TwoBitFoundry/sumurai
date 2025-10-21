# SOC2-Ready Instrumentation Plan

## Executive Summary

This document outlines the complete instrumentation strategy for achieving SOC2 readiness in the Sumaura backend. The implementation focuses on three core areas:

1. **Incident Response**: Full request tracing and error correlation
2. **Security Monitoring**: Authentication events, session tracking, and access control
3. **System Health**: Provider availability, performance metrics, and dependency monitoring

### Quick Stats

- **Total Files Modified**: 6
- **Estimated Implementation Time**: 45-60 minutes
- **SOC2 Controls Covered**: CC6.1, CC7.2, CC7.3, CC7.4, PI1.4, A1.2
- **Log Retention Target**: 1 year minimum
- **Compliance Requirements**: SOC2 Type II readiness (no PCI-DSS, no user roles)

---

## Architecture Overview

### Current Telemetry Stack

Sumaura already has OpenTelemetry configured with:

- **Exporter**: OpenTelemetry OTLP → Seq (`http://localhost:5341/ingest/otlp/v1/traces`)
- **Propagation**: W3C Trace Context
- **HTTP Layer**: `axum-tracing-opentelemetry` with `OtelAxumLayer` and `OtelInResponseLayer`
- **Bearer Token Tracking**: Custom middleware that hashes JWT tokens for correlation
- **Custom Formatter**: `SeqJsonFormatter` for structured JSON logging

### Auto-Instrumentation Capabilities

By enabling framework features, we get automatic tracing for:

- **SQLx**: Database query spans with duration, row counts, sanitized SQL
- **Reqwest**: HTTP client spans with URL, status codes, latency
- **Axum**: HTTP server spans with routes, methods, status codes
- **Tower-HTTP**: Request/response lifecycle with headers and latency

### Manual Instrumentation Strategy

We'll add minimal manual instrumentation for:

- **Business Events**: Provider connections, sync completions, disconnections
- **Security Events**: Authentication success/failure, data access audit
- **User Context**: Propagate `user_id` and `jwt_id` through request lifecycle

---

## Phase 1: Must-Have (Compliance Blockers)

These changes are **required** for SOC2 CC6.1, CC7.3, and PI1.4 compliance.

### Change 1: Enable Auto-Instrumentation

**File**: `backend/Cargo.toml`

**Modify Lines 21 and 25** to add `tracing` feature:

```toml
sqlx = { version = "0.8.6", features = ["runtime-tokio-rustls", "postgres", "uuid", "chrono", "rust_decimal", "tracing"] }

reqwest = { version = "0.12", default-features = false, features = ["json", "rustls-tls", "tracing"] }
```

**What This Enables**:
- ✅ Automatic database query tracing (duration, row counts, sanitized SQL)
- ✅ Automatic HTTP client tracing to Plaid/Teller (duration, status codes, URLs)
- ✅ Zero manual instrumentation for database and external API layers

**SOC2 Controls**: CC7.2 (System Monitoring), CC7.4 (Incident Response)

**Seq Queries Enabled**:
```sql
-- Detect slow database queries
db.query.duration_ms > 1000 ORDER BY db.query.duration_ms DESC

-- Monitor Plaid/Teller API performance
SELECT mean(http.client.duration_ms)
WHERE http.client.url LIKE "%plaid.com%" OR http.client.url LIKE "%teller.io%"
GROUP BY http.client.host

-- Detect provider API failures
http.client.url LIKE "%plaid.com%" AND http.response.status_code >= 500
```

---

### Change 2: Add User Context to All Requests

**File**: `backend/src/auth_middleware.rs`

**After line 85**, add user context to current span:

```rust
request.extensions_mut().insert(auth_context);

// ADD THIS BLOCK:
let span = tracing::Span::current();
span.record("user_id", &tracing::field::display(&auth_context.user_id));
span.record("jwt_id", &tracing::field::display(&auth_context.jwt_id));
```

**Important**: Ensure the HTTP layer declares these fields. The `OtelAxumLayer` middleware should already create spans, but the fields need to be declared as `Empty` initially for the auth middleware to populate them.

**What This Enables**:
- ✅ Every authenticated request automatically tagged with `user_id`
- ✅ Session tracking across entire request lifecycle (via `jwt_id`)
- ✅ User context propagates to all child spans (database, cache, provider calls)
- ✅ Audit trail for "who did what"

**SOC2 Controls**: CC6.1 (Logical Access Controls), PI1.4 (Data Access Audit)

**Seq Queries Enabled**:
```sql
-- Trace all actions by specific user
user_id = "abc-123" ORDER BY @Timestamp

-- Session lifecycle investigation
jwt_id = "xyz-789" ORDER BY @Timestamp

-- Which users are experiencing errors?
@Level = "Error" GROUP BY user_id OVER last 1h

-- User activity audit trail for compliance
user_id = "abc-123" AND @Timestamp > StartOfDay()
```

---

### Change 3: Instrument Authentication Operations

**File**: `backend/src/services/auth_service.rs`

Add `#[tracing::instrument]` attributes to authentication methods:

**Line 24** - Hash password:
```rust
#[tracing::instrument(skip(self, password))]
pub fn hash_password(&self, password: &str) -> Result<String, AuthError> {
```

**Line 34** - Verify password:
```rust
#[tracing::instrument(skip(self, password, hash))]
pub fn verify_password(&self, password: &str, hash: &str) -> Result<bool, AuthError> {
```

**Line 44** - Generate token:
```rust
#[tracing::instrument(skip(self))]
pub fn generate_token(&self, user_id: Uuid) -> Result<AuthToken, AuthError> {
```

**Line 102** - Validate token:
```rust
#[tracing::instrument(skip(self, token))]
pub fn validate_token(&self, token: &str) -> Result<Claims, AuthError> {
```

**What This Enables**:
- ✅ Failed authentication attempt tracking
- ✅ Token lifecycle monitoring (creation, validation, expiration)
- ✅ Security event detection (brute force, session hijacking)
- ✅ Automatic error capture with context

**SOC2 Controls**: CC6.1 (Logical Access), CC7.3 (Security Event Monitoring)

**Seq Queries Enabled**:
```sql
-- Detect brute force attacks
operation = "verify_password" AND @Level = "Error"
GROUP BY user_id HAVING count(*) > 5 OVER last 15m

-- Track token generation failures
operation = "generate_token" AND @Level = "Error"

-- Monitor token validation failures (expired/invalid)
operation = "validate_token" AND @Level = "Error"
GROUP BY error_type
```

---

### Change 4: Add Authentication Success Event

**File**: `backend/src/main.rs`

**After line 513** (in `login_user` handler, after successful token generation):

```rust
let expires_at = auth_token.expires_at.to_rfc3339();

// ADD THIS BLOCK:
tracing::info!(
    user_id = %user.id,
    jwt_id = %auth_token.jwt_id,
    email = %req.email,
    "User authenticated successfully"
);

Ok(Json(auth_models::AuthResponse {
    token: auth_token.token,
    user_id: user.id.to_string(),
    expires_at,
    onboarding_completed: user.onboarding_completed,
}))
```

**What This Enables**:
- ✅ Successful login audit trail
- ✅ Session initiation tracking
- ✅ Compliance reporting for user access
- ✅ Correlation with failed login attempts

**Note**: Failed login warnings already exist at lines 453 and 475.

**SOC2 Controls**: CC6.1 (Logical Access Controls)

**Seq Queries Enabled**:
```sql
-- Successful logins today
event = "User authenticated successfully" AND @Timestamp > StartOfDay()

-- User login history
email = "user@example.com" AND event = "User authenticated successfully"
ORDER BY @Timestamp DESC

-- Login success vs failure ratio
SELECT
  countif(event = "User authenticated successfully") AS success,
  countif(reason = "invalid_password") AS failures
GROUP BY email
```

---

### Change 5: Add Data Access Audit Logging

**File**: `backend/src/main.rs`

Add audit logging to data access handlers (does NOT log sensitive field values, only metadata):

#### Get Transactions Handler

Find the `get_transactions` handler and add after transactions are fetched:

```rust
let transactions: Vec<TransactionWithAccount> = // ... existing code ...

// ADD THIS BLOCK:
tracing::info!(
    user_id = %auth_context.user_id,
    record_count = transactions.len(),
    "Data access: transactions"
);

Ok(Json(transactions))
```

#### Get Balances Overview Handler

Find the `get_balances_overview` handler and add:

```rust
let response = BalancesOverviewResponse {
    // ... existing fields ...
};

// ADD THIS BLOCK:
tracing::info!(
    user_id = %auth_context.user_id,
    account_count = response.accounts.len(),
    "Data access: balances overview"
);

Ok(Json(response))
```

#### Get Accounts Handlers (Plaid/Teller)

Find the `get_plaid_accounts` handler and add:

```rust
// After accounts are fetched
tracing::info!(
    user_id = %auth_context.user_id,
    record_count = accounts.len(),
    provider = "plaid",
    "Data access: accounts"
);
```

**Important**: We are NOT logging:
- ❌ Account balances
- ❌ Transaction amounts
- ❌ Account numbers or masks
- ❌ Merchant names
- ❌ Any PII/sensitive data

We only log:
- ✅ User ID (who accessed)
- ✅ Record counts (how much data)
- ✅ Timestamp (when)
- ✅ Operation type (what)

**What This Enables**:
- ✅ Audit trail for sensitive data access
- ✅ Unusual access pattern detection
- ✅ Compliance reporting for GDPR data access requests
- ✅ Insider threat monitoring

**SOC2 Controls**: PI1.4 (Data Access Audit)

**Seq Queries Enabled**:
```sql
-- Who accessed transactions in last 90 days?
operation = "Data access: transactions"
GROUP BY user_id, date_trunc('day', @Timestamp)
OVER last 90d

-- Detect unusual data access patterns
SELECT user_id, count(*), sum(record_count)
WHERE operation LIKE "Data access:%"
GROUP BY user_id
HAVING count(*) > 1000 OVER last 1h

-- GDPR data access report for user
user_id = "requested-by-user" AND
operation LIKE "Data access:%"
ORDER BY @Timestamp DESC
```

---

## Phase 2: Operational Excellence

These changes enable **CC7.2, CC7.4, and A1.2** compliance for system monitoring and incident response.

### Change 6: Instrument Provider Operations

**File**: `backend/src/services/connection_service.rs`

#### 6.1: Exchange Public Token

**Line 288** - Add instrumentation:

```rust
#[tracing::instrument(
    skip(self, public_token),
    fields(provider = provider)
)]
pub async fn exchange_public_token(
    &self,
    provider: &str,
    user_id: &Uuid,
    jwt_id: &str,
    public_token: &str,
) -> Result<ExchangeTokenResponse, ExchangeTokenError> {
```

**After line 379** (before the `Ok(ExchangeTokenResponse {...})`), add success event:

```rust
tracing::info!(
    user_id = %user_id,
    provider = provider,
    institution_id = %connection.institution_id.as_deref().unwrap_or("unknown"),
    institution_name = %connection.institution_name.as_deref().unwrap_or("Unknown Bank"),
    "Provider connection established"
);

Ok(ExchangeTokenResponse {
    // ... existing fields ...
})
```

#### 6.2: Sync Provider Connection

**Line 382** - Add instrumentation:

```rust
#[tracing::instrument(
    skip(self, sync_service, connection),
    fields(
        provider = params.provider,
        user_id = %params.user_id,
        connection_id = %connection.id
    )
)]
pub async fn sync_provider_connection(
    &self,
    params: SyncConnectionParams<'_>,
    sync_service: &SyncService,
    connection: &mut ProviderConnection,
) -> Result<SyncTransactionsResponse, ProviderSyncError> {
```

**After line 540** (before the `Ok(SyncTransactionsResponse {...})`), add success event:

```rust
tracing::info!(
    user_id = %params.user_id,
    provider = params.provider,
    connection_id = %connection.id,
    transaction_count = total_transactions,
    account_count = total_accounts,
    "Transaction sync completed"
);

Ok(SyncTransactionsResponse {
    // ... existing fields ...
})
```

#### 6.3: Sync Teller Connection

**Line 543** - Add instrumentation:

```rust
#[tracing::instrument(
    skip(self, connection),
    fields(
        provider = "teller",
        user_id = %user_id,
        connection_id = %connection.id
    )
)]
pub async fn sync_teller_connection(
    &self,
    user_id: &Uuid,
    jwt_id: &str,
    connection: &mut ProviderConnection,
) -> Result<SyncTransactionsResponse, TellerSyncError> {
```

**After line 742** (before the `Ok(SyncTransactionsResponse {...})`), add success event:

```rust
tracing::info!(
    user_id = %user_id,
    provider = "teller",
    connection_id = %connection.id,
    transaction_count = total_transactions,
    account_count = total_accounts,
    "Transaction sync completed"
);

Ok(SyncTransactionsResponse {
    transactions: synced_transactions,
    metadata,
})
```

#### 6.4: Disconnect Connection

**Line 93** - Add instrumentation:

```rust
#[tracing::instrument(
    skip(self),
    fields(
        connection_id = %connection_id,
        user_id = %user_id
    )
)]
pub async fn disconnect_connection_by_id(
    &self,
    connection_id: &Uuid,
    user_id: &Uuid,
    jwt_id: &str,
) -> Result<DisconnectResult> {
```

**After line 153** (before the `Ok(DisconnectResult {...})`), add success event:

```rust
tracing::info!(
    user_id = %user_id,
    connection_id = %connection_id,
    transactions_deleted = deleted_transactions,
    accounts_deleted = deleted_accounts,
    "Provider connection disconnected"
);

Ok(DisconnectResult {
    // ... existing fields ...
})
```

**What This Enables**:
- ✅ Provider availability monitoring (Plaid vs Teller uptime)
- ✅ Sync performance tracking (duration, transaction counts)
- ✅ Incident detection (provider outages, sync failures)
- ✅ Root cause analysis for sync issues
- ✅ Connection lifecycle tracking (connect → sync → disconnect)

**SOC2 Controls**: CC7.2 (System Monitoring), CC7.4 (Incident Response), A1.2 (Availability)

**Seq Queries Enabled**:
```sql
-- Provider availability SLA (99.9% uptime)
SELECT
  countif(@Level != "Error") / count(*) AS success_rate
WHERE operation LIKE "%sync%"
GROUP BY provider
OVER last 30d

-- Detect provider outages in real-time
provider IN ["plaid", "teller"] AND @Level = "Error"
GROUP BY provider HAVING count(*) > 10 OVER last 15m

-- p95 sync latency by provider
SELECT Percentile(duration_ms, 95)
WHERE operation LIKE "%sync%"
GROUP BY provider

-- Which users were affected by provider outage?
provider = "plaid" AND @Level = "Error" AND
@Timestamp BETWEEN "2024-01-01T10:00:00Z" AND "2024-01-01T11:00:00Z"
GROUP BY user_id

-- Transaction volume by provider
SELECT sum(transaction_count)
WHERE event = "Transaction sync completed"
GROUP BY provider, date_trunc('day', @Timestamp)
```

---

## Phase 3: Nice-to-Have

These changes provide additional operational visibility for CC7.2 compliance.

### Change 7: Add Cache Performance Tracking

**File**: `backend/src/services/cache_service.rs`

**Modify the `is_session_valid` method** in the `impl CacheService for RedisCache` block:

```rust
async fn is_session_valid(&self, jwt_id: &str) -> Result<bool> {
    let mut conn = self.connection_manager.clone();
    let key = self.jwt_valid_key(jwt_id);
    let result: Result<Option<String>> = conn.get(&key).await.map_err(anyhow::Error::from);

    // ADD THIS BLOCK (replace existing return logic):
    match result {
        Ok(Some(_)) => {
            tracing::debug!(
                jwt_id = jwt_id,
                cache_hit = true,
                "Session validation cache hit"
            );
            Ok(true)
        }
        Ok(None) => {
            tracing::debug!(
                jwt_id = jwt_id,
                cache_hit = false,
                "Session validation cache miss"
            );
            Ok(false)
        }
        Err(e) => {
            tracing::warn!(
                jwt_id = jwt_id,
                error = %e,
                "Session validation cache error"
            );
            Err(anyhow::anyhow!("Cache error: {}", e))
        }
    }
}
```

**Optional**: Add similar tracking to `get_jwt_token` if needed.

**What This Enables**:
- ✅ Redis availability monitoring
- ✅ Cache hit rate metrics
- ✅ Infrastructure dependency health tracking
- ✅ Session store performance analysis

**SOC2 Controls**: CC7.2 (System Monitoring)

**Seq Queries Enabled**:
```sql
-- Cache hit rate for session validation
SELECT countif(cache_hit = true) / count(*)
WHERE operation = "Session validation cache"

-- Redis availability issues
cache_operation IS NOT NULL AND @Level = "Error"

-- Cache performance over time
SELECT
  countif(cache_hit = true) / count(*) AS hit_rate
WHERE cache_hit IS NOT NULL
GROUP BY date_trunc('hour', @Timestamp)
```

---

## Implementation Instructions

### Step 1: Backup Current State

```bash
git checkout -b feature/soc2-instrumentation
git add .
git commit -m "Checkpoint before SOC2 instrumentation"
```

### Step 2: Apply Changes in Order

1. **Phase 1, Change 1**: Edit `Cargo.toml` (add tracing features)
2. **Phase 1, Change 2**: Edit `auth_middleware.rs` (user context propagation)
3. **Phase 1, Change 3**: Edit `auth_service.rs` (instrument auth methods)
4. **Phase 1, Change 4**: Edit `main.rs` (add login success event)
5. **Phase 1, Change 5**: Edit `main.rs` (add data access audit logs)
6. **Phase 2, Change 6**: Edit `connection_service.rs` (instrument provider operations)
7. **Phase 3, Change 7**: Edit `cache_service.rs` (add cache tracking)

### Step 3: Rebuild

```bash
cd backend
cargo build --release
```

Expected output: Successful compilation with no errors.

### Step 4: Restart Services

```bash
docker compose down
docker compose up -d --build
```

### Step 5: Verify Telemetry

1. **Check Seq is receiving traces**:
   - Navigate to `http://localhost:5341`
   - You should see OTLP ingestion events

2. **Test authentication flow**:
   ```bash
   # Login with valid credentials
   curl -X POST http://localhost:8080/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"me@test.com","password":"Test1234!"}'
   ```
   - Check Seq for: "User authenticated successfully" event
   - Verify `user_id` and `jwt_id` are present

3. **Test failed login**:
   ```bash
   # Login with invalid credentials
   curl -X POST http://localhost:8080/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"me@test.com","password":"wrong"}'
   ```
   - Check Seq for: "Login attempt with invalid password" warning

4. **Test transaction sync**:
   - Connect a Plaid/Teller account via UI
   - Trigger sync
   - Check Seq for: "Transaction sync completed" event
   - Verify `provider`, `transaction_count`, `duration_ms` are present

5. **Test data access**:
   ```bash
   # Fetch transactions (use real JWT from login)
   curl -X GET http://localhost:8080/api/transactions \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```
   - Check Seq for: "Data access: transactions" event
   - Verify `user_id` and `record_count` are present

### Step 6: Validate Spans

In Seq, run these validation queries:

```sql
-- Verify user_id propagation
user_id IS NOT NULL AND @Timestamp > Now() - 5m

-- Verify database query tracing
db.query.text IS NOT NULL AND @Timestamp > Now() - 5m

-- Verify HTTP client tracing
http.client.url IS NOT NULL AND @Timestamp > Now() - 5m

-- Verify provider field on sync operations
provider IN ["plaid", "teller"] AND @Timestamp > Now() - 5m
```

---

## SOC2 Compliance Mapping

### Control CC6.1: Logical and Physical Access Controls

**Requirement**: The entity restricts logical access to information assets based on the user's access authorization.

**How We Address It**:
- ✅ Authentication events tracked (`generate_token`, `verify_password`)
- ✅ Session lifecycle monitoring (`jwt_id` tracking)
- ✅ User context propagated to all operations (`user_id` on every request)
- ✅ Failed access attempts logged (existing warnings for invalid credentials)

**Audit Queries**:
```sql
-- Show all authentication attempts for user
user_id = "abc-123" OR email = "user@example.com"
WHERE operation IN ["verify_password", "generate_token"]

-- Failed login attempt report
reason = "invalid_password"
GROUP BY email, date_trunc('day', @Timestamp)
```

---

### Control CC7.2: System Monitoring

**Requirement**: The entity monitors system components and the operation of those components for anomalies that may be indicative of malicious acts, natural disasters, or errors.

**How We Address It**:
- ✅ Database query performance monitoring (SQLx tracing)
- ✅ External API monitoring (reqwest tracing to Plaid/Teller)
- ✅ Cache performance tracking (`cache_hit` metrics)
- ✅ Provider sync performance (duration, success rates)

**Audit Queries**:
```sql
-- System performance dashboard
SELECT
  mean(db.query.duration_ms) AS avg_db_latency,
  max(db.query.duration_ms) AS max_db_latency,
  mean(http.client.duration_ms) AS avg_api_latency
OVER last 24h

-- Anomaly detection: slow queries
db.query.duration_ms > 5000 ORDER BY @Timestamp DESC

-- Provider health monitoring
SELECT provider, countif(@Level = "Error") / count(*) AS error_rate
WHERE operation LIKE "%sync%"
GROUP BY provider
```

---

### Control CC7.3: Detection and Monitoring of Security Events

**Requirement**: The entity evaluates security events to determine whether they could or have resulted in a failure of the entity to meet its objectives.

**How We Address It**:
- ✅ Failed authentication tracking (existing warnings)
- ✅ Session validation failures (existing warnings in auth_middleware)
- ✅ Token expiration monitoring (`validate_token` instrumentation)
- ✅ Unusual data access patterns (record count logging)

**Audit Queries**:
```sql
-- Security event dashboard
SELECT
  countif(reason = "invalid_password") AS failed_logins,
  countif(error_code = "EXPIRED_TOKEN") AS expired_tokens,
  countif(error_code = "SESSION_INVALID") AS invalid_sessions
OVER last 24h

-- Potential brute force attacks
SELECT email, count(*) AS attempts
WHERE reason = "invalid_password"
GROUP BY email
HAVING count(*) > 5
OVER last 1h
```

---

### Control CC7.4: Incident Response

**Requirement**: The entity responds to identified security incidents by executing a defined incident response program.

**How We Address It**:
- ✅ Full request tracing via `traceId` (W3C Trace Context)
- ✅ Error correlation across layers (user_id propagation)
- ✅ Provider outage detection (sync failure events)
- ✅ Root cause analysis capability (database queries, API calls visible)

**Audit Queries**:
```sql
-- Incident investigation: trace user-reported error
traceId = "reported-by-user"

-- Incident investigation: provider outage timeline
provider = "plaid" AND @Level = "Error" AND
@Timestamp BETWEEN incident_start AND incident_end
ORDER BY @Timestamp

-- Incident investigation: affected users
provider = "plaid" AND @Level = "Error" AND
@Timestamp BETWEEN incident_start AND incident_end
GROUP BY user_id
```

---

### Control PI1.4: Data Access Audit

**Requirement**: The entity obtains or generates, uses, and communicates relevant, quality information regarding the processing activities of personal information.

**How We Address It**:
- ✅ Transaction access logged (who, when, how many)
- ✅ Account access logged (who, when, provider)
- ✅ Balance access logged (who, when, account count)
- ✅ No sensitive data values logged (only metadata)

**Audit Queries**:
```sql
-- GDPR data access report for user
user_id = "requested-by-user" AND
operation LIKE "Data access:%"
ORDER BY @Timestamp DESC

-- Insider threat detection
SELECT user_id, count(*), sum(record_count)
WHERE operation = "Data access: transactions"
GROUP BY user_id
HAVING sum(record_count) > 10000
OVER last 1d

-- Data access summary by operation
SELECT operation, count(*), sum(record_count)
WHERE operation LIKE "Data access:%"
GROUP BY operation, date_trunc('day', @Timestamp)
```

---

### Control A1.2: Availability Monitoring

**Requirement**: The entity monitors system components and the operation of those components for availability anomalies.

**How We Address It**:
- ✅ Provider availability tracking (sync success/failure)
- ✅ External API uptime (HTTP client status codes)
- ✅ Redis availability (cache error tracking)
- ✅ Database availability (automatic SQLx error tracing)

**Audit Queries**:
```sql
-- Provider SLA compliance (99.9% target)
SELECT
  provider,
  countif(@Level != "Error") / count(*) AS success_rate,
  count(*) AS total_operations
WHERE operation LIKE "%sync%"
GROUP BY provider
OVER last 30d

-- Real-time availability alerts
provider IN ["plaid", "teller"] AND @Level = "Error"
GROUP BY provider HAVING count(*) > 10 OVER last 15m

-- Infrastructure dependency health
SELECT
  countif(db.query.duration_ms IS NOT NULL) AS db_available,
  countif(cache_hit IS NOT NULL) AS redis_available,
  countif(http.client.url IS NOT NULL) AS external_api_available
OVER last 1h
```

---

## Seq Configuration for SOC2

### Retention Policy

Configure Seq to retain logs for **1 year minimum** (365 days):

1. Navigate to Seq UI: `http://localhost:5341`
2. Go to **Settings** → **Retention**
3. Set retention period to **365 days**
4. Consider archiving to cold storage (S3, Azure Blob) for 7-year compliance if needed

### Dashboards

Create these dashboards in Seq for SOC2 auditors:

#### Dashboard 1: Security Events

```sql
-- Failed Login Attempts (Last 24h)
SELECT count(*)
WHERE reason = "invalid_password"
GROUP BY email
OVER last 24h

-- Session Validation Failures (Last 24h)
SELECT count(*)
WHERE error_code IN ["EXPIRED_TOKEN", "SESSION_INVALID"]
OVER last 24h

-- Unusual Data Access (Last 1h)
SELECT user_id, count(*), sum(record_count)
WHERE operation LIKE "Data access:%"
GROUP BY user_id
HAVING count(*) > 100
OVER last 1h
```

#### Dashboard 2: System Health

```sql
-- Database Performance (p95 latency)
SELECT Percentile(db.query.duration_ms, 95)
OVER last 1h

-- Provider API Performance (mean latency)
SELECT mean(http.client.duration_ms)
WHERE http.client.url LIKE "%plaid.com%" OR http.client.url LIKE "%teller.io%"
GROUP BY http.client.host
OVER last 1h

-- Cache Hit Rate
SELECT countif(cache_hit = true) / count(*)
WHERE cache_hit IS NOT NULL
OVER last 1h
```

#### Dashboard 3: Provider Health

```sql
-- Provider Success Rate (Last 24h)
SELECT
  provider,
  countif(@Level != "Error") / count(*) AS success_rate
WHERE operation LIKE "%sync%"
GROUP BY provider
OVER last 24h

-- Sync Performance by Provider
SELECT provider, mean(duration_ms), max(duration_ms)
WHERE event = "Transaction sync completed"
GROUP BY provider
OVER last 24h

-- Transaction Volume by Provider
SELECT provider, sum(transaction_count)
WHERE event = "Transaction sync completed"
GROUP BY provider, date_trunc('day', @Timestamp)
OVER last 7d
```

### Alerting Rules (Optional for Phase 2)

Configure alerts for real-time incident response:

```sql
-- CRITICAL: Brute Force Attack Detected
reason = "invalid_password"
GROUP BY email
HAVING count(*) >= 10
OVER last 5m

-- CRITICAL: Provider Outage
provider IN ["plaid", "teller"] AND @Level = "Error"
GROUP BY provider
HAVING count(*) >= 10
OVER last 15m

-- WARNING: Database Performance Degradation
db.query.duration_ms > 5000

-- WARNING: Unusual Data Access
SELECT user_id, count(*)
WHERE operation LIKE "Data access:%"
GROUP BY user_id
HAVING count(*) > 500
OVER last 1h
```

---

## Documentation for SOC2 Auditors

### Evidence Package

Provide auditors with:

1. **This Document** - Complete instrumentation plan and control mapping
2. **Seq Configuration Screenshot** - Showing 365-day retention policy
3. **Sample Queries** - Demonstrating capability to answer audit questions
4. **Sample Trace** - Full request trace showing user_id propagation
5. **Alert Rules** - Security event alerting configuration

### Common Auditor Questions

**Q: How do you track who accessed sensitive data?**

A: We log all data access operations with user_id, timestamp, operation type, and record counts. Example query:

```sql
user_id = "abc-123" AND operation LIKE "Data access:%"
ORDER BY @Timestamp DESC
```

**Q: How do you detect unauthorized access attempts?**

A: We track all failed login attempts with email, timestamp, and failure reason. Alerts trigger on 10+ failed attempts within 5 minutes. Example query:

```sql
reason = "invalid_password"
GROUP BY email, date_trunc('hour', @Timestamp)
```

**Q: How do you monitor third-party service availability?**

A: We track all provider sync operations with success/failure rates, latency, and error details. SLA compliance is measured over 30-day windows. Example query:

```sql
SELECT
  provider,
  countif(@Level != "Error") / count(*) AS uptime
WHERE operation LIKE "%sync%"
GROUP BY provider
OVER last 30d
```

**Q: Can you reconstruct a user's session for investigation?**

A: Yes, via `jwt_id` tracking. All operations within a session are correlated:

```sql
jwt_id = "xyz-789" ORDER BY @Timestamp
```

**Q: How long do you retain audit logs?**

A: Logs are retained in Seq for 365 days (configurable in Seq Settings → Retention).

---

## Post-Implementation Checklist

### Immediate (Day 1)

- [ ] All 7 changes implemented and tested
- [ ] Rebuild successful with no compilation errors
- [ ] Seq receiving traces (verify in UI)
- [ ] Test authentication flow (success + failure)
- [ ] Test sync flow (Plaid or Teller)
- [ ] Test data access flow (transactions, accounts)
- [ ] Validate `user_id` propagation in Seq

### Week 1

- [ ] Configure Seq retention to 365 days
- [ ] Create 3 SOC2 dashboards (Security, System Health, Provider Health)
- [ ] Run all validation queries successfully
- [ ] Document any gaps or issues
- [ ] Baseline metrics captured (p95 latency, error rates, sync volumes)

### Month 1

- [ ] Configure alerting rules (optional)
- [ ] Train team on Seq queries for incident response
- [ ] Document incident response runbook using Seq
- [ ] Generate first compliance report for stakeholders
- [ ] Review and tune retention/archiving strategy

### Before SOC2 Audit

- [ ] Prepare evidence package for auditors
- [ ] Generate sample reports for all 6 controls
- [ ] Demonstrate incident response capability
- [ ] Document any exceptions or gaps
- [ ] Ensure 1 year of historical data available

---

## Troubleshooting

### Issue: `user_id` not appearing in spans

**Cause**: Span fields not declared before auth_middleware tries to record them.

**Solution**: Ensure `OtelAxumLayer` creates spans with `user_id` and `jwt_id` fields declared as `Empty`. Check that `tracing::Span::current()` is the HTTP request span.

### Issue: Database queries not appearing

**Cause**: SQLx `tracing` feature not enabled.

**Solution**: Verify `Cargo.toml` has `sqlx = { ..., features = [..., "tracing"] }` and rebuild.

### Issue: External API calls not traced

**Cause**: Reqwest `tracing` feature not enabled.

**Solution**: Verify `Cargo.toml` has `reqwest = { ..., features = [..., "tracing"] }` and rebuild.

### Issue: Events appearing but no `traceId`

**Cause**: W3C Trace Context propagation not working.

**Solution**: Verify `TraceContextPropagator` is set in `telemetry.rs` (should already be configured at line 84).

### Issue: High cardinality fields causing Seq performance issues

**Cause**: Too many unique values for certain fields (e.g., transaction IDs).

**Solution**: Avoid logging high-cardinality IDs in span fields. Use events instead, and ensure Seq has sufficient resources.

---

## Future Enhancements

### Phase 4: Advanced Analytics

- Add business metrics (DAU, MAU, churn)
- Track feature usage (which endpoints most used)
- Performance budgets (alert if p95 exceeds threshold)

### Phase 5: Compliance Automation

- Automated compliance reports (generate SOC2 evidence)
- Anomaly detection ML models
- Automated runbook execution for incidents

### Phase 6: Multi-Region Support

- Regional data residency tracking
- Cross-region trace correlation
- Region-specific retention policies

---

## Summary

This instrumentation plan provides **SOC2-ready observability** with:

✅ **Minimal boilerplate** - Leveraging auto-instrumentation from SQLx, reqwest, and Axum
✅ **Comprehensive coverage** - All 6 SOC2 controls addressed
✅ **Production-ready** - Security, performance, and incident response
✅ **Audit-friendly** - Clear evidence trail with example queries
✅ **Maintainable** - Only ~20 attributes added across 6 files

**Total Implementation Time**: 45-60 minutes
**Lines of Code Added**: ~50 lines
**SOC2 Controls Covered**: CC6.1, CC7.2, CC7.3, CC7.4, PI1.4, A1.2
**Compliance Readiness**: SOC2 Type II ready (1-year retention)

---

## Questions or Issues?

For implementation questions or issues:
1. Review the Troubleshooting section above
2. Check Seq UI for ingestion errors
3. Verify Cargo.toml features are enabled
4. Ensure Docker Compose services are running

For compliance questions:
1. Review the SOC2 Compliance Mapping section
2. Run the example queries in Seq to verify data availability
3. Consult with your SOC2 auditor for specific requirements
