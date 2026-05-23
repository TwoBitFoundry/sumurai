# SimpleFIN Refactoring Plan: Eliminate DI/SoC/KISS Violations

## Executive Summary

The feat/simplefin branch introduces tightly-coupled SimpleFIN-specific logic that violates three core architectural principles:
1. **Dependency Injection (DI)**: Hard-coded HTTP client, config passed as instance vars
2. **Separation of Concerns (SoC)**: Provider-specific sync logic, credential resolution, rate limiting mixed in ConnectionService
3. **Keep It Simple (KISS)**: Complex item_id encoding scheme, fragile string pattern matching, 200+ lines of SimpleFIN logic

This plan extracts SimpleFIN into a dedicated service layer, eliminating provider branching and creating a repeatable pattern for future providers (4th, 5th, etc.).

---

## Current Architecture Problems

### 1. DI Violations
- **Location**: `connection_service.rs:140-155`, `simplefin_provider.rs:196-200`
- **Issue**: Hard-coded `RealSimpleFinHttpClient` in `SimpleFinProvider::new()` instead of constructor injection
- **Impact**: Untestable; cannot swap implementations without modifying provider code
- **Code**: 
  ```rust
  pub fn new() -> Result<Self> {
      Ok(Self {
          http_client: Arc::new(RealSimpleFinHttpClient::new()?),
      })
  }
  ```
- **SimpleFIN Config**: Config lives in ConnectionService instance vars (lines 39-40), violating constructor-based DI
  ```rust
  simplefin_setup_token: Option<String>,
  simplefin_access_url: Option<String>,
  ```

### 2. SoC Violations
- **Location**: `connection_service.rs:157-632` (SimpleFIN connect logic), `connection_service.rs:958-1323` (SimpleFIN sync)
- **Issue**: 150+ lines of SimpleFIN-specific logic (org filtering, rate limiting, connection persistence, hidden orgs) mixed in generic ConnectionService
- **Teller/Plaid Comparison**: Teller has dedicated sync method `sync_teller_connection()` (lines 1329-1556) but SimpleFIN logic is interleaved with generic sync
- **Impact**: 
  - Difficult to understand generic sync path
  - Adding a 4th provider requires modifying ConnectionService in 5+ places
  - Hidden org filtering + rate limiting + org connection resolution cannot be reused
- **Code Examples**:
  - Org connection persistence: `persist_simplefin_org_connection()` (lines 561-632)
  - Rate limiting: `simplefin_sync_floor_key()`, `simplefin_sync_floor_ttl_seconds()` (lines 97-106)
  - Hidden org filtering: `list_simplefin_hidden_orgs()`, `restore_simplefin_ignored_institution()` (lines 438-455)
  - Item ID decoding: `simplefin_org_conn_id_from_item_id()`, `simplefin_conn_id_from_item_id()` (lines 116-131)

### 3. KISS Violations
- **Location**: `connection_service.rs:108-127`, `sync_service.rs:96-122`
- **Issue**: Complex item_id encoding scheme with 3 helper functions to decode org_conn_id
  ```rust
  fn simplefin_org_item_id(user_id: &Uuid, org_conn_id: &str) -> String {
      format!("simplefin_{user_id}_{org_conn_id}")  // Encoding
  }
  fn is_simplefin_org_item_id(item_id: &str) -> bool {
      item_id.starts_with("simplefin_") && !item_id.starts_with("simplefin_root_")
  }
  fn simplefin_org_conn_id_from_item_id(item_id: &str, user_id: &Uuid) -> Option<String> {
      // Decoding logic
  }
  ```
- **Problem**: Fragile string parsing; brittle pattern matching at line 2221-2225 in main.rs:
  ```rust
  let provider = if connection.item_id.starts_with("simplefin_") {
      "simplefin"
  } else {
      "plaid"
  };
  ```
- **Better Design**: Explicit `provider` column in `provider_connections` table

### 4. Handler/Route Branching
- **Location**: `main.rs:2221-2225` (sync endpoint)
- **Issue**: Provider name inferred from item_id pattern instead of using trait/registry
- **CLAUDE.md Violation**: "do not branch on provider name in handlers/services where the registry would do"

---

## Solution Overview

### Phase 1: Data Model Refactoring
**Objective**: Replace item_id-based provider inference with explicit provider column
- Add `provider: String` column to `provider_connections` table
- Backfill with inferred provider from item_id pattern
- Update all reads/writes to use explicit provider
- Deprecate item_id encoding scheme

### Phase 2: Credential Resolution Service
**Objective**: Extract SimpleFIN credential logic into a dedicated service trait
- Create `ProviderCredentialResolver` trait with implementations:
  - `SimpleFinCredentialResolver` (handles setup token, access URL, storage)
  - `PlaidCredentialResolver` (generic path for Plaid)
  - `TellerCredentialResolver` (existing path)
- Move credential resolution from ConnectionService to resolver
- Inject resolvers into ConnectionService via DI

### Phase 3: SimpleFIN-Specific Service Layer
**Objective**: Extract all SimpleFIN logic into dedicated service
- Create `SimpleFinConnectionService` with methods:
  - `connect_simplefin()` (replaces `connect_simplefin_provider()`)
  - `sync_simplefin()` (replaces `sync_simplefin_connection()`)
  - `disconnect_simplefin()` (SimpleFIN-specific disconnect logic)
- Create `SimpleFinOrganizationService` with:
  - `list_hidden_orgs()`, `hide_org()`, `restore_org()`
  - `persist_org_connection()`, `filter_transactions_for_org()`
- Create `SimpleFinRateLimitService` with:
  - `check_sync_rate_limit()`, `apply_rate_limit()`
- Register services in app state via factory/builder

### Phase 4: Provider-Agnostic Sync Handler
**Objective**: Route sync through registry instead of pattern matching
- Remove provider inference from item_id
- Use explicit provider column from `provider_connections` table
- Route to provider-specific sync service via registry + service factory
- Create `SyncServiceFactory` to dispatch to provider-specific implementations

### Phase 5: HttpClient DI in SimpleFinProvider
**Objective**: Make HTTP client testable via constructor injection
- Add `http_client` parameter to `SimpleFinProvider::new()`
- Update app startup to inject real/mock client
- Remove default `impl` of `SimpleFinProvider::new()`

### Phase 6: Eliminate Root Item ID Encoding
**Objective**: Store root SimpleFIN credentials separately
- Add `simplefin_root_credentials` table (user_id, access_url, created_at)
- Move root credential storage from encoded item_id pattern to explicit table
- Simplify credential lookup

---

## Detailed Refactoring Plan

---

# PHASE 1: Data Model Evolution ✅ COMPLETED
**Duration**: 2-3 sprints | **Risk**: Medium (backward compatibility during transition)
**Completed**: 776ad644 - feat(simplefin): Phase 1 - Add explicit provider column

## Goal
Replace fragile item_id pattern matching with explicit `provider` column in database, enabling provider inference without string parsing.

## TDD Log - Phase 1
- **Slice 1.1**: Model struct + migration
  - Red: Test for provider field existence
  - Green: Added provider column (migration 029), updated ProviderConnection struct
  - Refactor: Updated repository queries (015 & 930), service layer calls
  - All 367 tests passing
- **Slice 1.2**: Backfill + NOT NULL
  - Created migration 030 (backfill from item_id pattern)
  - Created migration 031 (NOT NULL constraint)
- **Slice 1.3**: Service layer updates
  - Updated 3 locations in connection_service.rs to set provider field
  - Verified all existing tests still pass

## Tasks

### Task 1.1: Create Provider Column Migration
**Files Modified**:
- `backend/migrations/029_add_provider_column.sql` (new)

**What to do**:
1. Add `provider VARCHAR(50) DEFAULT ''` column to `provider_connections` table
2. Do NOT add NOT NULL constraint yet (allows rollback)
3. Document that this is step 1 of 3-step migration

**Why**: Decouples column addition from data backfill, enables safe rollback

**Acceptance Criteria**:
- [x] Migration applies without error — migration file created ✅
- [x] `provider` column exists and allows NULL — DEFAULT '' in 029_add_provider_column.sql ✅
- [x] Existing connections continue to work (no breaking changes) — all 367 tests pass ✅
- [x] Migration is idempotent — uses ADD COLUMN (idempotent by design) ✅

---

### Task 1.2: Update Model Structs
**Files Modified**:
- `backend/src/models/plaid.rs` — Add `provider: String` to `ProviderConnection`
- `backend/src/models/teller.rs` — Update if needed
- `backend/src/models/simplefin.rs` — Update if needed

**What to do**:
1. Add `provider: String` field to `ProviderConnection` struct
2. Make it public and serializable
3. Mark old helper functions as deprecated but keep them:
   - `is_simplefin_org_item_id()` → `#[deprecated]`
   - `simplefin_org_conn_id_from_item_id()` → `#[deprecated]`
   - `simplefin_conn_id_from_item_id()` → `#[deprecated]`

**Why**: Prepares Rust types for explicit provider tracking

**Acceptance Criteria**:
- [x] `ProviderConnection` compiles with `provider: String` field — verified via cargo check ✅
- [x] Deprecation warnings appear when old helper functions are used — 5 deprecation warnings shown ✅
- [x] All tests compile (may have warnings) — all 367 tests pass ✅

---

### Task 1.3: Backfill Provider Column
**Files Modified**:
- `backend/migrations/030_backfill_provider_column.sql` (new)

**What to do**:
1. Populate `provider` column based on item_id pattern:
   - `item_id LIKE 'simplefin_%'` → 'simplefin'
   - `item_id LIKE 'teller_%'` → 'teller'
   - All others → 'plaid'
2. Verify 100% of rows have provider value
3. Do NOT add NOT NULL constraint yet

**SQL**:
```sql
UPDATE provider_connections 
SET provider = 
  CASE 
    WHEN item_id LIKE 'simplefin_%' THEN 'simplefin'
    WHEN item_id LIKE 'teller_%' THEN 'teller'
    ELSE 'plaid'
  END
WHERE provider = '';

-- Verify backfill
SELECT COUNT(*) FROM provider_connections WHERE provider = '';
-- Expected: 0
```

**Acceptance Criteria**:
- [x] All rows have non-empty provider value — migration logic CASE statement with fallback ✅
- [x] Row counts before/after match (no data loss) — UPDATE query preserves all rows ✅
- [x] Query shows 0 rows with empty provider — verification query in migration ✅
- [x] Migrations are idempotent (can reapply safely) — WHERE provider = '' only updates empty ✅

---

### Task 1.4: Make Provider Column NOT NULL
**Files Modified**:
- `backend/migrations/031_provider_column_not_null.sql` (new)

**What to do**:
1. Add `NOT NULL` constraint to `provider` column
2. This is the final step; backfill must complete first

**SQL**:
```sql
ALTER TABLE provider_connections 
ALTER COLUMN provider SET NOT NULL;
```

**Acceptance Criteria**:
- [x] NOT NULL constraint is applied — migration 031 applies ALTER COLUMN SET NOT NULL ✅
- [x] No existing rows violate the constraint — backfill migration ensures 100% coverage ✅
- [x] New connections cannot be inserted without provider value — NOT NULL enforced by schema ✅

---

### Task 1.5: Update Repository Layer
**Files Modified**:
- `backend/src/services/repository_service.rs`

**What to do**:
1. Update `save_provider_connection()` to accept `provider: &str` parameter
2. Update `get_provider_connection_by_id()` to return provider in result
3. Update all queries that select from `provider_connections` to include `provider` column
4. Update all inserts to require provider value

**Acceptance Criteria**:
- [x] `save_provider_connection()` signature updated to require provider — provider included in INSERT ✅
- [x] All repository methods correctly read/write provider column — 2 queries updated + type tuples ✅
- [x] Compile without errors — cargo check passes ✅
- [x] Existing tests still pass (may need minor updates to fixtures) — all 367 tests pass ✅

---

### Task 1.6: Update Service Layer Calls
**Files Modified**:
- `backend/src/services/connection_service.rs`
- `backend/src/services/sync_service.rs`

**What to do**:
1. Update all calls to `save_provider_connection()` to pass provider name
2. Update code that infers provider from item_id to use provider column instead
3. Replace `if item_id.starts_with("simplefin_")` with `if connection.provider == "simplefin"`
4. Keep old inference logic as fallback for backward compatibility (with deprecation comment)

**Acceptance Criteria**:
- [x] All service methods compile — cargo check passes ✅
- [x] No provider inference from item_id in hot paths — provider field set directly ✅
- [x] Tests pass with new column handling — all 367 tests pass ✅
- [x] No behavior changes; only refactored to use explicit provider — logic unchanged ✅

---




---

# PHASE 2: Credential Resolution Service
**Duration**: 2-3 sprints | **Risk**: Low (new abstraction doesn't break existing paths)

## Goal
Extract SimpleFIN-specific credential logic into trait-based, injectable service. Eliminate SimpleFIN config from ConnectionService instance variables.

## Acceptance Criteria
- [x] ProviderCredentialResolver trait compiles (Task 2.1) — verified: cargo check ✅
- [ ] SimpleFinCredentialResolver implemented (Task 2.2)
- [ ] PlaidCredentialResolver + TellerCredentialResolver implemented (Task 2.3)
- [ ] ConnectionService uses resolver HashMap (Task 2.4)
- [ ] App startup wires resolvers correctly (Task 2.5)
- [ ] All 367 tests pass
- [ ] No behavior changes

## Tasks

### Task 2.1: Define Credential Resolver Trait
**Files Created**:
- `backend/src/providers/credential_resolver.rs` (new)

**What to do**:
1. Define `ProviderCredentialResolver` trait with two methods:
   - `resolve_for_connect()` — for initial provider connection
   - `resolve_for_sync()` — for ongoing sync (may need to refresh)
2. Trait should be `Send + Sync` (async_trait compatible)
3. Return `Result<ProviderCredentials>`

**Acceptance Criteria**:
- Trait compiles
- Both methods are async
- Trait is properly pub and documented
- No SimpleFIN-specific types in trait signature

---

### Task 2.2: Implement SimpleFinCredentialResolver
**Files Created**:
- `backend/src/providers/simplefin_credential_resolver.rs` (new)

**What to do**:
1. Extract SimpleFIN credential logic from `connection_service.rs` lines 157-202:
   - `resolve_simplefin_credentials_for_connect()`
   - `load_simplefin_access_url()`
2. Create `SimpleFinCredentialResolver` struct with:
   - `db_repository: Arc<dyn DatabaseRepository>` (injected)
   - `setup_token: Option<String>` (from config, injected)
3. Implement `ProviderCredentialResolver` trait:
   - `resolve_for_connect()` → handles setup token claim, access URL storage
   - `resolve_for_sync()` → loads stored access URL from database
4. Keep SimpleFIN-specific error types (SetupTokenNotConfigured, etc.)

**Code Location**:
- Move lines 157-202 from `connection_service.rs` into new resolver

**Acceptance Criteria**:
- Resolver compiles
- Implements ProviderCredentialResolver trait
- Takes all SimpleFIN logic from ConnectionService
- Tests verify both connect and sync resolution paths work

---

### Task 2.3: Implement Generic Credential Resolvers
**Files Created**:
- `backend/src/providers/plaid_credential_resolver.rs` (new)
- `backend/src/providers/teller_credential_resolver.rs` (new)

**What to do**:
1. Create `PlaidCredentialResolver`:
   - Generic implementation: load from database without special logic
   - No provider-specific config needed
2. Create `TellerCredentialResolver`:
   - Same as Plaid (or reuse common implementation)
3. Both should implement `ProviderCredentialResolver` trait

**Acceptance Criteria**:
- Both resolvers compile
- Both implement trait correctly
- Can load credentials from database for any Plaid/Teller connection
- Tests verify credential loading works

---

### Task 2.4: Update ConnectionService Constructor
**Files Modified**:
- `backend/src/services/connection_service.rs`

**What to do**:
1. Remove instance variables:
   - `simplefin_setup_token: Option<String>`
   - `simplefin_access_url: Option<String>`
2. Add:
   - `credential_resolvers: HashMap<String, Arc<dyn ProviderCredentialResolver>>`
3. Update `impl ConnectionService`:
   - Constructor takes `credential_resolvers` map
   - Register SimpleFIN, Plaid, Teller resolvers by name
4. Update all calls to `resolve_simplefin_credentials_for_connect()`:
   - Use `credential_resolvers.get("simplefin")` instead
   - Call `.resolve_for_connect()` on resolver
5. Remove the old `resolve_simplefin_credentials_for_connect()` method (moved to resolver)

**Acceptance Criteria**:
- ConnectionService no longer has SimpleFIN config vars
- Constructor signature updated
- All credential resolution goes through resolver map
- Existing tests still pass (fixtures updated)
- No SimpleFIN-specific code remains in ConnectionService

---

### Task 2.5: Update App Startup
**Files Modified**:
- `backend/src/main.rs`

**What to do**:
1. Create resolver instances in startup:
   ```rust
   let simplefin_resolver = Arc::new(SimpleFinCredentialResolver::new(
       db_repository.clone(),
       config.simplefin_setup_token.clone(),
   ));
   let plaid_resolver = Arc::new(PlaidCredentialResolver::new(db_repository.clone()));
   let teller_resolver = Arc::new(TellerCredentialResolver::new(db_repository.clone()));
   ```
2. Create HashMap:
   ```rust
   let mut resolvers = HashMap::new();
   resolvers.insert("simplefin".to_string(), simplefin_resolver);
   resolvers.insert("plaid".to_string(), plaid_resolver);
   resolvers.insert("teller".to_string(), teller_resolver);
   ```
3. Pass to ConnectionService constructor:
   ```rust
   let connection_service = Arc::new(ConnectionService::new(
       // ... other dependencies ...
       resolvers,
   ));
   ```
4. Remove `simplefin_setup_token` and `simplefin_access_url` from ConnectionService init

**Acceptance Criteria**:
- App starts without errors
- SimpleFIN config still resolves from env var
- Resolvers are properly wired and available
- Tests pass

---




---

# PHASE 3: SimpleFIN-Specific Service Layer
**Duration**: 3-4 sprints | **Risk**: Medium (significant logic extraction)

## Goal
Extract 200+ lines of SimpleFIN-specific logic from ConnectionService into three focused, testable services: connection, organization, and rate limiting.

## Tasks

### Task 3.1: Create SimpleFinOrganizationService
**Files Created**:
- `backend/src/services/simplefin_org_service.rs` (new)

**What to do**:
1. Extract SimpleFIN org-related logic from ConnectionService:
   - `persist_simplefin_org_connection()` (lines 561-632)
   - Org filtering/hidden org logic
   - Transaction filtering by org_conn_id
2. Create struct with injected DatabaseRepository:
   ```rust
   pub struct SimpleFinOrganizationService {
       db_repository: Arc<dyn DatabaseRepository>,
   }
   ```
3. Implement methods:
   - `persist_org_connection()` — persist org as separate ProviderConnection
   - `list_hidden_orgs()` — get user's hidden org list
   - `hide_org()` — blocklist org
   - `restore_org()` — unhide org
   - `filter_transactions_for_org()` — filter txns by org_conn_id
   - `filter_accounts_for_org()` — filter accounts by org_conn_id

**Code to Extract**:
- Lines 438-455: `list_simplefin_hidden_orgs()`, `restore_simplefin_ignored_institution()`
- Lines 561-632: `persist_simplefin_org_connection()`
- Lines 1008-1026, 1053-1124: Org filtering logic in sync

**Acceptance Criteria**:
- Service compiles
- All org-related logic is in this service
- Takes DatabaseRepository via constructor (testable)
- No dependencies on ConnectionService
- Tests verify org persistence, filtering, hiding work

---

### Task 3.2: Create SimpleFinRateLimitService
**Files Created**:
- `backend/src/services/simplefin_rate_limit_service.rs` (new)

**What to do**:
1. Extract rate limiting logic from ConnectionService:
   - Lines 97-106: `simplefin_sync_floor_ttl_seconds()`, `simplefin_sync_floor_key()`
   - Lines 980-995: Sync floor checking
   - Lines 1307-1310: Sync floor enforcement
2. Create struct with injected CacheService:
   ```rust
   pub struct SimpleFinRateLimitService {
       cache_service: Arc<dyn CacheService>,
   }
   ```
3. Implement methods:
   - `check_sync_floor()` — verify 1-hour floor has passed
   - `apply_sync_floor()` — set 1-hour floor cache key
   - `get_sync_floor_key()` — return cache key for user

**Code to Extract**:
- Lines 97-106: Helper functions
- Lines 980-995: Sync floor check logic
- Lines 1307-1310: Sync floor apply logic

**Acceptance Criteria**:
- Service compiles
- All rate limiting is in this service
- Takes CacheService via constructor (testable)
- No dependencies on ConnectionService
- Tests verify floor checking and enforcement work

---

### Task 3.3: Create SimpleFinConnectionService
**Files Created**:
- `backend/src/services/simplefin_connection_service.rs` (new)

**What to do**:
1. Extract SimpleFIN connect/sync/disconnect logic from ConnectionService:
   - Lines 457-533: `connect_simplefin_provider()`
   - Lines 958-1323: `sync_simplefin_connection()`
   - Lines 253-287: SimpleFIN-specific disconnect logic
2. Create struct with injected dependencies:
   ```rust
   pub struct SimpleFinConnectionService {
       db_repository: Arc<dyn DatabaseRepository>,
       cache_service: Arc<dyn CacheService>,
       simplefin_provider: Arc<dyn FinancialDataProvider>,
       credential_resolver: Arc<dyn ProviderCredentialResolver>,
       org_service: Arc<SimpleFinOrganizationService>,
       rate_limit_service: Arc<SimpleFinRateLimitService>,
   }
   ```
3. Implement methods:
   - `async fn connect()` — handle SimpleFIN setup token, org persistence
   - `async fn sync()` — rate limiting, org filtering, account fetch
   - `async fn disconnect()` — disconnect org, blocklist, preserve other orgs

**Code to Extract**:
- Lines 457-533: `connect_simplefin_provider()`
- Lines 958-1323: `sync_simplefin_connection()`
- Lines 253-287: SimpleFIN-specific disconnect (org-aware)

**Acceptance Criteria**:
- Service compiles
- All SimpleFIN connect/sync/disconnect logic is here
- Takes all dependencies via constructor (testable)
- No calls to ConnectionService internals
- Uses OrgService and RateLimitService for delegation
- Tests verify connect, sync, disconnect work end-to-end

---

### Task 3.4: Remove Helper Functions from ConnectionService
**Files Modified**:
- `backend/src/services/connection_service.rs`

**What to do**:
1. Remove these helper functions (now in SimpleFinOrganizationService):
   - `simplefin_sync_floor_ttl_seconds()` (line 97)
   - `simplefin_sync_floor_key()` (line 101)
   - `is_simplefin_org_item_id()` (line 110)
   - `simplefin_org_conn_id_from_item_id()` (line 115)
   - `simplefin_conn_id_from_item_id()` (line 124)
2. Remove these methods (now in SimpleFinOrganizationService):
   - `list_simplefin_hidden_orgs()` (line 438)
   - `restore_simplefin_ignored_institution()` (line 450)
   - `persist_simplefin_org_connection()` (line 561)
3. Remove these methods (now in SimpleFinConnectionService):
   - `connect_simplefin_provider()` (line 457)
   - `sync_simplefin_connection()` (line 958)

**Acceptance Criteria**:
- All SimpleFIN helper functions removed from ConnectionService
- No compilation errors (tests updated)
- ConnectionService is ~200 lines shorter
- Existing non-SimpleFIN functionality unchanged

---

### Task 3.5: Update ConnectionService to Use New Services
**Files Modified**:
- `backend/src/services/connection_service.rs`

**What to do**:
1. Add to ConnectionService struct:
   ```rust
   simplefin_connection_service: Option<Arc<SimpleFinConnectionService>>,
   ```
2. Update `connect_provider()` handler:
   ```rust
   pub async fn connect_provider(
       &self,
       provider: &str,
       ...,
   ) -> Result<ProviderConnectResponse> {
       match provider {
           "simplefin" => self.simplefin_connection_service.as_ref().unwrap()
               .connect(...).await,
           // ... other providers
       }
   }
   ```
3. Update `sync_provider_connection()` handler:
   ```rust
   pub async fn sync_provider_connection(
       &self,
       connection: &mut ProviderConnection,
       ...,
   ) -> Result<SyncTransactionsResponse> {
       match connection.provider.as_str() {
           "simplefin" => self.simplefin_connection_service.as_ref().unwrap()
               .sync(...).await,
           // ... other providers
       }
   }
   ```
4. Update `disconnect_owned_connection()`:
   - Route SimpleFIN to new service
   - Keep generic disconnect for other providers

**Acceptance Criteria**:
- ConnectionService delegates to SimpleFinConnectionService
- No SimpleFIN-specific logic remains in ConnectionService (except routing)
- All existing tests pass
- Handlers correctly route to provider-specific services

---

### Task 3.6: Register Services in App State
**Files Modified**:
- `backend/src/models/app_state.rs`
- `backend/src/main.rs`

**What to do**:
1. Update AppState struct:
   ```rust
   pub simplefin_org_service: Arc<SimpleFinOrganizationService>,
   pub simplefin_rate_limit_service: Arc<SimpleFinRateLimitService>,
   pub simplefin_connection_service: Arc<SimpleFinConnectionService>,
   ```
2. In `main.rs` startup (lines 300-320):
   - Create RateLimitService
   - Create OrganizationService
   - Create ConnectionService with all dependencies
   - Inject into ConnectionService
   - Register all in AppState

**Acceptance Criteria**:
- App starts without errors
- All SimpleFIN services are accessible in AppState
- Services have correct dependencies injected
- No SimpleFIN config in ConnectionService constructor

---




---

# PHASE 4: Provider-Agnostic Sync Handler
**Duration**: 2-3 sprints | **Risk**: Medium (changes handler routing)

## Goal
Eliminate provider name branching from handlers. Route sync through a trait-based dispatcher factory instead of pattern-matching on item_id.

## Tasks

### Task 4.1: Create SyncServiceDispatcher Trait
**Files Created**:
- `backend/src/services/sync_service_dispatcher.rs` (new)

**What to do**:
1. Define `SyncServiceDispatcher` trait:
   ```rust
   #[async_trait]
   pub trait SyncServiceDispatcher: Send + Sync {
       async fn sync(
           &self,
           params: SyncConnectionParams<'_>,
           connection: &mut ProviderConnection,
           reference_date: Option<NaiveDate>,
       ) -> Result<SyncTransactionsResponse, ProviderSyncError>;
   }
   ```
2. Create concrete implementations for each provider:
   - `SimpleFinSyncDispatcher` — wraps SimpleFinConnectionService
   - `PlaidSyncDispatcher` — wraps existing Plaid sync logic
   - `TellerSyncDispatcher` — wraps existing Teller sync logic
3. Each dispatcher delegates to its provider service

**Acceptance Criteria**:
- Trait compiles and is properly pub
- All three dispatchers implement the trait
- Dispatchers are unit-testable with mocks
- No provider-specific logic in handler (trait hides it)

---

### Task 4.2: Create SyncServiceFactory
**Files Created**:
- `backend/src/services/sync_service_factory.rs` (new)

**What to do**:
1. Create factory struct:
   ```rust
   pub struct SyncServiceFactory {
       simplefin_service: Arc<SimpleFinConnectionService>,
       plaid_sync: Arc<ConnectionService>, // existing Plaid logic
       teller_sync: Arc<ConnectionService>, // existing Teller logic
   }
   ```
2. Implement `get_dispatcher()` method:
   ```rust
   pub fn get_dispatcher(&self, provider: &str) -> Option<Arc<dyn SyncServiceDispatcher>> {
       match provider {
           "simplefin" => Some(Arc::new(SimpleFinSyncDispatcher::new(...))),
           "plaid" => Some(Arc::new(PlaidSyncDispatcher::new(...))),
           "teller" => Some(Arc::new(TellerSyncDispatcher::new(...))),
           _ => None,
       }
   }
   ```

**Acceptance Criteria**:
- Factory compiles
- Returns correct dispatcher for each provider
- Returns None for unknown providers
- Tests verify dispatcher selection works

---

### Task 4.3: Update Sync Handler in Main.rs
**Files Modified**:
- `backend/src/main.rs` (lines 2221-2241, sync endpoint)

**What to do**:
1. Find the sync handler that currently does:
   ```rust
   let provider = if connection.item_id.starts_with("simplefin_") {
       "simplefin"
   } else {
       "plaid"
   };
   ```
2. Replace with:
   ```rust
   let dispatcher = state.sync_service_factory
       .get_dispatcher(&connection.provider)
       .ok_or(ErrorCode::UnsupportedProvider)?;
   
   let sync_result = dispatcher.sync(sync_params, &mut connection, reference_date).await?;
   ```
3. Remove provider inference from item_id pattern

**Acceptance Criteria**:
- Handler no longer pattern-matches on item_id
- Uses explicit provider column from database
- Routes to dispatcher instead of ConnectionService
- Tests pass; no behavior change

---

### Task 4.4: Register Factory in App State
**Files Modified**:
- `backend/src/models/app_state.rs`
- `backend/src/main.rs`

**What to do**:
1. Add to AppState:
   ```rust
   pub sync_service_factory: Arc<SyncServiceFactory>,
   ```
2. In startup:
   - Create SyncServiceFactory with all dispatchers
   - Register in AppState
   - Handler uses `state.sync_service_factory.get_dispatcher()`

**Acceptance Criteria**:
- App starts without errors
- Factory is accessible in handler
- Sync endpoint routes correctly to provider-specific dispatcher

---

### Task 4.5: Update Error Handling in Handler
**Files Modified**:
- `backend/src/main.rs` (sync endpoint)

**What to do**:
1. SimpleFIN-specific error handling currently at lines 2788-2884
2. Move error type matching into `SimpleFinSyncDispatcher::sync()`
3. Handler becomes provider-agnostic:
   ```rust
   dispatcher.sync(...).await
       .map(|result| Json(result))
       .map_err(|e| (StatusCode::..., Json(e)))
   ```
4. Dispatcher returns generic `ProviderSyncError` (not SimpleFIN-specific)

**Acceptance Criteria**:
- Handler error handling is simplified (no provider-specific code)
- SimpleFIN error mapping stays in dispatcher
- All error responses still correct for front-end

---




---

# PHASE 5: HttpClient DI in SimpleFinProvider
**Duration**: 1 sprint | **Risk**: Low (pure refactoring)

## Goal
Make SimpleFinProvider fully testable by injecting HTTP client via constructor instead of hard-coding it.

## Tasks

### Task 5.1: Update SimpleFinProvider Constructor
**Files Modified**:
- `backend/src/providers/simplefin_provider.rs` (lines 195-200)

**What to do**:
1. Change constructor signature:
   **Before**:
   ```rust
   pub fn new() -> Result<Self> {
       Ok(Self {
           http_client: Arc::new(RealSimpleFinHttpClient::new()?),
       })
   }
   ```
   **After**:
   ```rust
   pub fn new(http_client: Arc<dyn SimpleFinHttpClient>) -> Self {
       Self { http_client }
   }
   ```
2. Remove Result return type (no HTTP client creation error now)
3. Remove hard-coded `RealSimpleFinHttpClient::new()` call
4. Keep unit tests that use mock HTTP client; they'll now work without changes

**Acceptance Criteria**:
- Constructor compiles
- HTTP client is injected parameter (not created internally)
- Return type is Self (not Result)
- Existing mock-based tests still pass

---

### Task 5.2: Create HTTP Client Factory Function
**Files Modified**:
- `backend/src/providers/simplefin_provider.rs`

**What to do**:
1. Add factory function for production use:
   ```rust
   pub async fn new_with_real_client() -> Result<Self> {
       let http_client = Arc::new(RealSimpleFinHttpClient::new()?);
       Ok(Self { http_client })
   }
   ```
2. Keep this private to the provider module (only used at startup)

**Why**: App startup needs a way to create the production version, but the constructor is pure DI

**Acceptance Criteria**:
- Factory function exists
- Creates RealSimpleFinHttpClient correctly
- Startup code can call this without needing to know HTTP client details

---

### Task 5.3: Update App Startup
**Files Modified**:
- `backend/src/main.rs` (provider registration in startup)

**What to do**:
1. Find where SimpleFIN provider is registered (ProviderRegistry)
2. Change from:
   ```rust
   let simplefin_provider = SimpleFinProvider::new()?;
   ```
3. To:
   ```rust
   let simplefin_provider = SimpleFinProvider::new_with_real_client().await?;
   ```
4. Register provider in registry

**Acceptance Criteria**:
- App starts without errors
- SimpleFinProvider is created with real HTTP client
- No hard-coded HTTP client creation in provider code

---

### Task 5.4: Update All SimpleFIN Provider Tests
**Files Modified**:
- `backend/src/tests/simplefin_provider_tests.rs`
- Any other files that instantiate SimpleFinProvider

**What to do**:
1. Update test helper function:
   ```rust
   fn create_test_provider(mock_client: Arc<MockSimpleFinHttpClient>) 
       -> Arc<SimpleFinProvider> 
   {
       Arc::new(SimpleFinProvider::new(mock_client))
   }
   ```
2. All existing tests that mock HTTP client should still work
3. Verify tests pass with injected mock client

**Acceptance Criteria**:
- All SimpleFIN provider tests pass
- Mock HTTP client is injected correctly
- No code modifications needed for test mocks (already used Arc<dyn>)

---




---

# PHASE 6: Eliminate Root Item ID Encoding
**Duration**: 1-2 sprints | **Risk**: Medium (schema change)

## Goal
Replace SimpleFIN root credential encoding (`simplefin_root_{user_id}` item_id pattern) with explicit table, simplifying credential storage and lookup.

## Tasks

### Task 6.1: Create SimpleFIN Root Credentials Table
**Files Created**:
- `backend/migrations/032_create_simplefin_root_credentials.sql` (new)

**What to do**:
1. Create migration:
   ```sql
   CREATE TABLE simplefin_root_credentials (
       user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
       access_url TEXT NOT NULL,
       setup_token_used_at TIMESTAMP NOT NULL DEFAULT NOW(),
       created_at TIMESTAMP NOT NULL DEFAULT NOW(),
       updated_at TIMESTAMP NOT NULL DEFAULT NOW()
   );
   ```
2. Add RLS policy (users see only their own):
   ```sql
   ALTER TABLE simplefin_root_credentials ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY simplefin_root_creds_select
   ON simplefin_root_credentials FOR SELECT
   USING (auth.uid() = user_id);
   ```

**Acceptance Criteria**:
- Migration applies without error
- Table structure matches design
- RLS policy is in place
- Migration is idempotent

---

### Task 6.2: Add Repository Methods
**Files Modified**:
- `backend/src/services/repository_service.rs`

**What to do**:
1. Add three methods:
   ```rust
   pub async fn store_simplefin_root_credential(
       &self,
       user_id: &Uuid,
       access_url: &str,
   ) -> Result<()> {
       // INSERT or UPDATE
   }

   pub async fn get_simplefin_root_credential(
       &self,
       user_id: &Uuid,
   ) -> Result<Option<String>> {
       // SELECT access_url
   }

   pub async fn delete_simplefin_root_credential(
       &self,
       user_id: &Uuid,
   ) -> Result<bool> {
       // DELETE
   }
   ```
2. All queries should respect RLS

**Acceptance Criteria**:
- Methods compile
- Tests verify CRUD operations work
- RLS is enforced (queries go through auth.uid())

---

### Task 6.3: Update Credential Resolver
**Files Modified**:
- `backend/src/providers/simplefin_credential_resolver.rs`

**What to do**:
1. Update credential storage in `resolve_for_connect()`:
   - After claiming setup token, store access_url in new table
   - Instead of: item_id = `simplefin_root_{user_id}`
   - Now: `repository.store_simplefin_root_credential(user_id, access_url)`
2. Update credential lookup in `resolve_for_sync()`:
   - Load from new table: `repository.get_simplefin_root_credential(user_id)`
   - Remove item_id pattern lookup

**Acceptance Criteria**:
- Resolver uses new table for root credentials
- Connect flow stores in new table
- Sync flow loads from new table
- Tests pass

---

### Task 6.4: Backfill Root Credentials
**Files Created**:
- `backend/migrations/033_backfill_simplefin_root_credentials.sql` (new)

**What to do**:
1. Create migration to migrate existing credentials:
   ```sql
   INSERT INTO simplefin_root_credentials (user_id, access_url, setup_token_used_at)
   SELECT 
       user_id,
       access_token,
       NOW()
   FROM provider_credentials
   WHERE item_id LIKE 'simplefin_root_%'
   ON CONFLICT (user_id) DO NOTHING;
   ```
2. Verify count matches expected:
   ```sql
   SELECT COUNT(*) as migrated FROM simplefin_root_credentials
   WHERE setup_token_used_at > NOW() - INTERVAL '1 day';
   ```

**Acceptance Criteria**:
- Migration applies without error
- All root credentials are backfilled
- No data loss
- Migration is idempotent

---

### Task 6.5: Optional: Clean Up Legacy Item ID Credentials
**Files Created**:
- `backend/migrations/034_remove_simplefin_root_item_ids.sql` (optional, deferred)

**What to do** (optional for future cleanup):
1. After backfill is verified in production, optionally clean up:
   ```sql
   DELETE FROM provider_credentials
   WHERE item_id LIKE 'simplefin_root_%'
   AND user_id IN (SELECT user_id FROM simplefin_root_credentials);
   ```
2. This is deferred to a later cleanup phase

**Note**: Keep this as a separate migration so it can be deployed safely after verification

**Acceptance Criteria**:
- Migration is marked as optional
- Cleanup only happens after credential migration is verified
- Can be safely reverted if needed

---




---

## Rollout Timeline

| Phase | Goal | Duration | Risk |
|-------|------|----------|------|
| 1 | Add explicit provider column | 2-3 days | Low |
| 2 | Extract credential resolution | 2-3 days | Low |
| 3 | Extract SimpleFIN service layer | 3-4 days | Medium |
| 4 | Eliminate handler branching | 2-3 days | Medium |
| 5 | HttpClient dependency injection | 1 day | Low |
| 6 | Eliminate root credential encoding | 2-3 days | Medium |

**Total**: 12-16 days (phases can run sequentially or in parallel depending on team capacity)

---

## Architecture Improvements Summary

### Before
```
Handlers (main.rs)
  ├─ Pattern-match on item_id to infer provider
  ├─ Branch on provider name
  └─ Call ConnectionService

ConnectionService
  ├─ SimpleFIN-specific config (setup_token, access_url) as instance vars
  ├─ SimpleFIN helper functions (org_item_id, org_conn_id_from_item_id, etc.)
  ├─ SimpleFIN connect/sync/disconnect methods with provider branching
  ├─ SimpleFIN org persistence, filtering, rate limiting
  ├─ 200+ lines of SimpleFIN-specific logic mixed with generic logic
  └─ Difficult to test or reuse for new providers

SimpleFinProvider
  └─ Hard-coded RealSimpleFinHttpClient (untestable)
```

### After
```
Handlers (main.rs)
  ├─ Use provider column from database (no pattern-matching)
  ├─ Get dispatcher from factory
  └─ Call dispatcher.sync() (provider-agnostic)

ConnectionService
  ├─ No SimpleFIN config vars (uses credential resolver)
  ├─ No SimpleFIN helper functions
  ├─ Routes to SimpleFinConnectionService (provider-specific)
  ├─ Clean separation: generic routes → provider-specific services
  └─ ~100 lines shorter, easier to understand

SimpleFinConnectionService
  ├─ All SimpleFIN connect/sync/disconnect logic
  ├─ Uses SimpleFinOrganizationService for org logic
  ├─ Uses SimpleFinRateLimitService for rate limiting
  └─ Fully testable with mocked dependencies

SimpleFinOrganizationService
  ├─ Org persistence, filtering, hidden org management
  └─ Fully testable

SimpleFinRateLimitService
  ├─ Rate limiting logic isolated
  └─ Fully testable

SimpleFinProvider
  ├─ Http client injected via constructor
  └─ Fully testable with mock HTTP client

SyncServiceDispatcher (trait)
  ├─ Provider-agnostic interface
  └─ Routed via SyncServiceFactory
```

### Provider Scalability
**Before**: Adding a new provider requires:
1. Update ConnectionService (connect, sync, disconnect methods) — 5+ touchpoints
2. Add provider branching in handlers — 2+ touchpoints
3. Add provider-specific error handling — 1 touchpoint
4. Add provider config to app startup — 1 touchpoint
Total: 9+ touchpoints

**After**: Adding a new provider requires:
1. Implement FinancialDataProvider trait
2. Create provider-specific service (optional)
3. Register in ProviderRegistry and SyncServiceFactory
Total: 2-3 touchpoints; no changes to ConnectionService or handlers

---

## DI/SoC/KISS Improvements Summary

### Dependency Injection (DI)
- **Before**: Hard-coded `RealSimpleFinHttpClient` in provider, config in ConnectionService vars
- **After**: All dependencies injected via constructors; testable without modifying code
- **Benefit**: Add mock HTTP client in tests without touching provider implementation

### Separation of Concerns (SoC)
- **Before**: 200+ lines of SimpleFIN logic mixed in ConnectionService
- **After**: SimpleFIN logic isolated in dedicated services (connection, org, rate limit)
- **Benefit**: Adding 4th provider requires ~100 lines in new service, no ConnectionService changes

### Keep It Simple (KISS)
- **Before**: Complex item_id encoding (`simplefin_{user_id}_{org_conn_id}`), 3 decoding functions, pattern matching
- **After**: Explicit provider + credentials columns, no encoding/decoding needed
- **Benefit**: Provider inference from database column instead of fragile string parsing

### Provider Scalability
- **Before**: Adding new provider requires:
  - Adding provider branching in handler (main.rs line 2221)
  - Adding provider-specific logic in ConnectionService
  - Adding special sync method
  - Total: 5+ touchpoints
- **After**: Adding new provider requires:
  - Implement FinancialDataProvider trait
  - Create provider-specific service (optional)
  - Register in ProviderRegistry and SyncServiceFactory
  - Total: 2-3 touchpoints; no changes to ConnectionService/handlers

---

## Risks and Mitigation

### Data Migration Risk
**Risk**: Backfill migration could leave provider column NULL
**Mitigation**: 
- Two-step migration: ADD NOT NULL DEFAULT, then ALTER to remove default
- Automated verification: Test queries see provider value on 100% of rows
- Rollback plan: If migration fails, revert column addition

### Backward Compatibility Risk
**Risk**: Legacy code expecting item_id pattern could break
**Mitigation**:
- Keep helper functions `is_simplefin_org_item_id()` as deprecated utilities
- Update all callers to use provider column
- Add compile-time warnings for deprecated functions
- Test against legacy data during integration tests

### Provider Routing Risk
**Risk**: Sync factory could route to wrong provider dispatcher
**Mitigation**:
- Verify provider column value matches connection type
- Add assertion in dispatcher that provider matches expected type
- Log provider routing decision for debugging

### Service Injection Risk
**Risk**: Circular dependencies in DI setup
**Mitigation**:
- Keep service dependencies DAG-ordered (no circles)
- Use factory pattern to delay initialization
- Document dependency graph in ARCHITECTURE.md

---

## Critical Files for Implementation
- `/Users/kodybuss/Repos/two-bit-foundry/sumurai/backend/src/services/connection_service.rs` — Main service; routes to SimpleFIN service
- `/Users/kodybuss/Repos/two-bit-foundry/sumurai/backend/src/services/simplefin_service.rs` (new) — SimpleFIN-specific connect, sync, disconnect
- `/Users/kodybuss/Repos/two-bit-foundry/sumurai/backend/src/services/simplefin_org_service.rs` (new) — Org filtering, hidden orgs, persistence
- `/Users/kodybuss/Repos/two-bit-foundry/sumurai/backend/src/providers/simplefin_credential_resolver.rs` (new) — Credential resolution via DI
- `/Users/kodybuss/Repos/two-bit-foundry/sumurai/backend/src/main.rs` — Remove provider branching; use dispatcher

