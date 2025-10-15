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
│   ├── boundaries/              # NEW: Boundary interfaces
│   │   ├── IHttpClient.ts
│   │   ├── IStorageAdapter.ts
│   │   ├── FetchHttpClient.ts   # Default impl
│   │   └── BrowserStorageAdapter.ts
│   ├── AuthService.ts           # MODIFIED: configure({ storage, http })
│   ├── ApiClient.ts             # MODIFIED: configure({ http })
│   ├── TransactionService.ts    # MODIFIED: configure({ http })
│   ├── AnalyticsService.ts      # MODIFIED: configure({ http })
│   ├── BudgetService.ts         # MODIFIED: configure({ http })
│   ├── PlaidService.ts          # MODIFIED: configure({ http })
│   ├── TellerService.ts         # MODIFIED: configure({ http })
│   └── ProviderCatalog.ts       # MODIFIED: configure({ plaid, teller })
├── domain/                      # NEW: Pure business logic
│   ├── AccountNormalizer.ts
│   ├── BudgetCalculator.ts
│   ├── TransactionFilter.ts
│   └── TransactionTransformer.ts
├── hooks/
│   ├── useTransactions.ts       # MODIFIED: Use domain classes
│   ├── useBudgets.ts            # MODIFIED: Use domain classes
│   ├── usePlaidConnections.tsx  # MODIFIED: Use domain classes
│   └── ...                      # Keep direct service imports
├── pages/
│   ├── BudgetsPage.tsx          # MODIFIED: Move logic to domain
│   └── DashboardPage.tsx        # MODIFIED: Move logic to domain
└── tests/
    ├── mocks/                   # NEW: Boundary mocks
    │   ├── mockHttpClient.ts
    │   └── mockStorage.ts
    └── setup/                   # NEW: Test utilities
        └── setupTestBoundaries.ts
```

## Execution Order

Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6

## Key Benefits

- ✅ **Mock only boundaries** - Test isolation at HTTP/storage layer
- ✅ **Static services remain** - No context/provider overhead
- ✅ **Pure business logic** - Domain classes fully testable in isolation
- ✅ **No service interfaces** - Services are implementation details
- ✅ **Simple testing** - Configure boundaries once, all services use mocks
- ✅ **Clear separation** - Boundaries → Services (data) → Domain (logic) → Hooks (state) → Pages (UI)

## Estimated Scope

- 2 boundary interfaces + 2 implementations
- 8 services modified (add configure() methods)
- 4 domain classes created
- 4 hooks modified (use domain classes)
- 2 pages cleaned up
- Test infrastructure (mocks + setup utilities)

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
