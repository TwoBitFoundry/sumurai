# Frontend Architecture Refactor: Boundary Mocking + Business Logic Separation

**Philosophy:** Mock at architectural boundaries (HTTP, storage), keep static services as implementation details, extract business logic to pure functions.

## Phase 1: Define Boundary Interfaces

### 1. Create boundary interfaces (`frontend/src/services/boundaries/`)
- `IHttpClient` - get, post, put, delete methods
- `IStorageAdapter` - getItem, setItem, removeItem, clear
- These are the ONLY interfaces needed (mock points)

### 2. Create default boundary implementations
- `FetchHttpClient` - Wraps native fetch API
- `BrowserStorageAdapter` - Wraps sessionStorage
- Used as defaults in production

## Phase 2: Inject Boundaries into Services

### 3. ApiClient - Add boundary injection
- Add static `configure()` method accepting `IHttpClient`
- Replace hardcoded `fetch` with `this.deps.http`
- Inject `IStorageAdapter` for any client-side caching (if needed)
- Keep token refresh and retry logic

### 4. AuthService - Add boundary injection
- Add static `configure()` method accepting `IStorageAdapter` + `IHttpClient`
- Replace hardcoded `sessionStorage` with `this.deps.storage`
- Replace hardcoded `fetch` with `this.deps.http`
- Remove direct ApiClient coupling (use injected http boundary)

### 5. All domain services - Inject HTTP boundary
- TransactionService.configure({ http: IHttpClient })
- AnalyticsService.configure({ http: IHttpClient })
- BudgetService.configure({ http: IHttpClient })
- PlaidService.configure({ http: IHttpClient })
- TellerService.configure({ http: IHttpClient })
- Default to ApiClient in production

### 6. ProviderCatalog - Remove hardcoded service calls
- Inject PlaidService and TellerService via configure()
- Replace direct `PlaidService.getAccounts()` with `this.deps.plaidService.getAccounts()`

## Phase 3: Business Logic Extraction

### 7. Create pure domain classes (`frontend/src/domain/`)

**AccountNormalizer** - Extract from usePlaidConnections:87-129
- Static method: `normalize(backendAccounts): NormalizedAccount[]`

**BudgetCalculator** - Extract from useBudgets:147-168
- Static methods: `calculateSpent()`, `calculateRemaining()`, `isOverBudget()`

**TransactionFilter** - Extract from useTransactions:95-125
- Static method: `filter(transactions, criteria): Transaction[]`

**TransactionTransformer** - Extract from TransactionService:57-82
- Static method: `backendToFrontend(apiTxn): Transaction`

### 8. Update services to use transformers
- TransactionService uses TransactionTransformer for API response mapping
- Services remain thin data access layers

## Phase 4: Update Hooks to Use Domain Logic

### 9. Refactor hooks to use domain classes
- `useTransactions` - Use `TransactionFilter.filter()` instead of inline logic
- `useBudgets` - Use `BudgetCalculator` methods instead of inline calculations
- `usePlaidConnections` - Use `AccountNormalizer.normalize()` instead of inline mapping
- Hooks keep services as direct imports (static, no context needed)
- Hooks become: fetch data via service → transform via domain class → return state

## Phase 5: Page Component Cleanup

### 10. Extract business logic from pages
- Move BudgetsPage:67-131 stats computation to `BudgetCalculator.computeStats()`
- Move DashboardPage aggregation to domain helpers
- Pages become pure presentation: accept data props, render JSX

## Phase 6: Testing Infrastructure

### 11. Create boundary mocks (`frontend/src/tests/mocks/`)
- `createMockHttpClient()` - Returns IHttpClient with vi.fn() stubs
- `createMockStorage()` - Returns IStorageAdapter with Map-based in-memory storage

### 12. Create test setup utilities (`frontend/src/tests/setup/`)
- `setupTestBoundaries()` - Configures all services with mock boundaries
- Called in test beforeEach blocks

### 13. Write unit tests
- Domain classes: Pure function tests (no mocks needed)
- Services: Inject mock boundaries, verify correct API calls
- Hooks: Use mock boundaries via service configure()

## File Structure After Refactor

```
frontend/src/
├── services/
│   ├── boundaries/              # NEW: Boundary interfaces (Phase 1-2)
│   │   ├── IHttpClient.ts
│   │   ├── IStorageAdapter.ts
│   │   ├── LowLevelHttpClient.ts         # NEW (Phase 7): Raw fetch interface
│   │   ├── FetchHttpClient.ts            # Default impl
│   │   ├── FetchLowLevelClient.ts        # NEW (Phase 7): Raw fetch impl
│   │   └── BrowserStorageAdapter.ts
│   ├── AuthService.ts           # MODIFIED: configure({ storage, http })
│   ├── ApiClient.ts             # MODIFIED (Phase 7): Use injected boundaries
│   ├── TransactionService.ts    # MODIFIED: configure({ http })
│   ├── AnalyticsService.ts      # MODIFIED: configure({ http })
│   ├── BudgetService.ts         # MODIFIED: configure({ http })
│   ├── PlaidService.ts          # MODIFIED: configure({ http })
│   ├── TellerService.ts         # MODIFIED: configure({ http })
│   └── ProviderCatalog.ts       # MODIFIED: configure({ plaid, teller })
├── domain/                      # NEW: Pure business logic (Phase 3-5)
│   ├── AccountNormalizer.ts
│   ├── BudgetCalculator.ts
│   ├── TransactionFilter.ts
│   ├── TransactionTransformer.ts
│   └── DashboardCalculator.ts
├── hooks/
│   ├── useTransactions.ts       # MODIFIED: Use domain classes
│   ├── useBudgets.ts            # MODIFIED: Use domain classes
│   ├── usePlaidConnections.tsx  # MODIFIED: Use domain classes
│   └── ...                      # Keep direct service imports
├── pages/
│   ├── BudgetsPage.tsx          # MODIFIED: Move logic to domain
│   └── DashboardPage.tsx        # MODIFIED: Move logic to domain
└── tests/
    ├── mocks/                   # NEW: Boundary mocks (Phase 6)
    │   ├── mockHttpClient.ts
    │   └── mockStorage.ts
    ├── setup/                   # NEW: Test utilities (Phase 6-7)
    │   └── setupTestBoundaries.ts
    └── services/                # MODIFIED (Phase 7): Migrate to setupTestBoundaries
        ├── ApiClient.integration.test.ts
        ├── AuthService.integration.test.ts
        ├── TransactionService.integration.test.ts
        └── ...
```

## Phase 7: Service Boundary Integration

### 14. Refactor ApiClient to use injected http boundary
- **Issue:** ApiClient stores `IHttpClient` but still makes hardcoded `fetch` calls (lines 170, 313)
- **Solution:** Create a low-level HTTP wrapper that ApiClient uses internally
- **Approach:**
  - Create `LowLevelHttpClient` interface for raw fetch operations (includes Response object)
  - Implement `FetchLowLevelClient` wrapping native fetch
  - Update ApiClient to use `LowLevelHttpClient` instead of hardcoded `fetch`
  - Keep `IHttpClient` for high-level service consumption (doesn't need Response objects)
  - ApiClient remains the adapter between low-level fetch and high-level `IHttpClient`

### 15. Refactor AuthService to use injected http boundary
- **Issue:** AuthService stores boundaries but still makes hardcoded `fetch` calls (lines 58, 102, 132, 156, 197, 223)
- **Solution:** Replace all hardcoded fetch with injected boundaries
- **Approach:**
  - AuthService should not use native fetch directly
  - Use injected `IHttpClient` for all HTTP operations
  - Use injected `IStorageAdapter` for all token operations (already done)
  - This requires careful handling of response objects for error parsing

### 16. Migrate existing tests to use setupTestBoundaries
- **Services to migrate:**
  - `authService.test.ts` - Migrate from global fetch mocking to `setupTestBoundaries`
  - `RetryLogic.test.ts` - Use mock http boundary
  - `TokenRefresh.test.ts` - Use mock boundaries
  - Other service tests following the same pattern
- **Benefits:**
  - Consistent test setup across all service tests
  - Easier to maintain and extend
  - Clear pattern for new tests
- **Strategy:**
  - Keep domain class tests as-is (no boundaries needed)
  - Update service integration tests to use `setupTestBoundaries`
  - Update component integration tests to use `setupTestBoundaries`

### 17. Create service integration tests with boundaries
- **Tests to add:**
  - `ApiClient.integration.test.ts` - Test retry logic, auth refresh, error handling with mocks
  - `AuthService.integration.test.ts` - Test login, logout, token storage with mocks
  - `TransactionService.integration.test.ts` - Test API calls with mocked http
  - Cross-service tests showing how services work together with mock boundaries
- **Approach:**
  - Use `setupTestBoundaries()` to configure all services
  - Mock specific http responses to test specific scenarios
  - Verify correct API endpoints and payloads
  - Test error handling paths

## Execution Order

Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7

## Key Benefits

- ✅ **Mock only boundaries** - Test isolation at HTTP/storage layer
- ✅ **Static services remain** - No context/provider overhead
- ✅ **Pure business logic** - Domain classes fully testable in isolation
- ✅ **No service interfaces** - Services are implementation details
- ✅ **Simple testing** - Configure boundaries once, all services use mocks
- ✅ **Clear separation** - Boundaries → Services (data) → Domain (logic) → Hooks (state) → Pages (UI)

## Estimated Scope

**Phases 1-6 (Completed):**
- 2 boundary interfaces + 2 implementations ✅
- 8 services modified (add configure() methods) ✅
- 4 domain classes created ✅ (+ 1 additional: DashboardCalculator)
- 4 hooks modified (use domain classes) ✅
- 2 pages cleaned up ✅
- Test infrastructure (mocks + setup utilities) ✅
- 44 new tests for testing infrastructure ✅

**Phase 7 (Remaining):**
- 2 new boundary interfaces (LowLevelHttpClient + impl)
- ApiClient refactor to use low-level boundary
- AuthService refactor to use injected http boundary
- 8 existing service test files migrated to setupTestBoundaries
- 3-4 new integration test files with boundary mocks
- ~20-30 additional integration tests

## Architecture Principles

### Why Static Services?
- Natural singleton semantics for browser SPA context
- Single user session per tab/window
- No request-scoping issues (not server-side)
- Ergonomic API (no prop drilling or context)

### Why Mock Boundaries, Not Services?
- Services are internal implementation details
- Boundaries represent external dependencies (network, storage)
- Reduces interface overhead
- Simplifies testing (one mock point for all services)

### Why Extract Business Logic?
- Pure functions are trivially testable
- Reusable across hooks and components
- Clear separation from framework concerns
- Self-documenting domain operations

## Completion Status

| Phase | Title | Status | Details |
|-------|-------|--------|---------|
| 1 | Define Boundary Interfaces | ✅ Complete | `IHttpClient`, `IStorageAdapter` + default implementations |
| 2 | Inject Boundaries into Services | ✅ Complete | All 7 domain services + 1 catalog service configured |
| 3 | Business Logic Extraction | ✅ Complete | 4 domain classes + DashboardCalculator (5 total) |
| 4 | Update Hooks to Use Domain Logic | ✅ Complete | Hooks refactored to use domain classes |
| 5 | Page Component Cleanup | ✅ Complete | BudgetsPage & DashboardPage business logic extracted |
| 6 | Testing Infrastructure | ✅ Complete | Mock utilities + setupTestBoundaries + 44 new tests |
| 7 | Service Boundary Integration | 🔄 Pending | Low-level http boundary + Service refactoring + Test migration |

## Test Coverage Summary (After Phase 6)

- **Total Tests:** 490
- **Test Files:** 64
- **Domain Tests:** 47 (BudgetCalculator, DashboardCalculator, TransactionFilter, TransactionTransformer, AccountNormalizer)
- **Mock Utility Tests:** 20 (mockHttpClient, mockStorage)
- **Setup Infrastructure Tests:** 10 (setupTestBoundaries)
- **Boundary Infrastructure Tests:** 14 (ApiClient, AuthService boundaries)
- **Service/Integration/Component Tests:** 399
