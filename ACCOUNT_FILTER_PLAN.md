# Account Filter Implementation Plan (TDD Micro-Phases)

## Phase 1A – Transactions Endpoint Filtering

### Red (15 mins)
- Update integration test in `backend/tests/transactions.rs` for `GET /api/transactions?account_ids[]=uuid1&account_ids[]=uuid2`
- Test happy path: filtered results contain only specified account transactions
- Test unauthorized: foreign account IDs return 403 with appropriate error message

### Green (20 mins)
- Parse `account_ids[]` query parameter in `TransactionsQuery` struct
- Add account ownership validation in transactions handler
- Filter transactions query to only include owned, specified accounts
- Run `cargo test transactions` to confirm tests pass

### Refactor (10 mins)
- Extract `validate_account_ownership` helper function
- Run `cargo test` to ensure no regressions

---

## Phase 1B – Analytics Spending Endpoint Filtering

### Red (10 mins)
- Update test in `backend/tests/analytics.rs` for `GET /api/analytics/spending?account_ids[]=uuid1`
- Test spending calculations only include specified accounts
- Test foreign account rejection

### Green (15 mins)
- Thread account_ids through `AnalyticsService::get_spending_total`
- Update spending calculation queries to filter by account ownership + selection
- Run `cargo test analytics::spending` to confirm

### Refactor (5 mins)
- Reuse `validate_account_ownership` helper
- Run `cargo test` to ensure stability

---

## Phase 1C – Analytics Categories Endpoint Filtering

### Red (10 mins)
- Update test for `GET /api/analytics/categories?account_ids[]=uuid1`
- Test category spending reflects only specified accounts

### Green (15 mins)
- Thread account_ids through `AnalyticsService::get_category_spending_by_date_range`
- Update category calculation queries with account filtering
- Run `cargo test analytics::categories`

### Refactor (5 mins)
- Consolidate account filtering logic in analytics service
- Run `cargo test`

---

## Phase 1D – Analytics Balances Endpoint Filtering

### Red (10 mins)
- Update test for `GET /api/analytics/balances/overview?account_ids[]=uuid1`
- Test balance calculations only include specified accounts

### Green (15 mins)
- Thread account_ids through `AnalyticsService::get_balances_overview`
- Update balance queries with account filtering
- Run `cargo test analytics::balances`

### Refactor (5 mins)
- Clean up duplicate validation logic
- Run `cargo test`

---

## Phase 1E – Cache Key Isolation

### Red (15 mins)
- Add test to verify different account selections produce different cache keys
- Test filtered cache doesn't return "all accounts" data

### Green (20 mins)
- Implement deterministic cache key extension using sorted account UUIDs hash
- Update cache key generation in all analytics endpoints
- Run `cargo test` to confirm cache isolation

### Refactor (10 mins)
- Extract `build_cache_key_with_accounts` utility
- Remove log statements that might leak account identifiers
- Run `cargo test`

---

## Phase 2A – Account Filter Context Foundation

### Red (15 mins)
- Create test file `frontend/src/hooks/__tests__/AccountFilterProvider.test.tsx`
- Test provider defaults to "All accounts" selection
- Test provider exposes current selection state

### Green (25 mins)
- Create `frontend/src/context/AccountFilterContext.tsx`
- Create `frontend/src/hooks/useAccountFilter.ts`
- Implement basic provider with "All accounts" default state
- Run `npm test AccountFilter`

### Refactor (10 mins)
- Optimize provider structure and prop drilling
- Run `npm test`

---

## Phase 2B – Account Metadata Integration

### Red (10 mins)
- Extend AccountFilterProvider tests to expect grouped account metadata (by bank)
- Test select all / toggle bank / toggle account actions

### Green (20 mins)
- Integrate `usePlaidConnections` hook into AccountFilterProvider
- Implement helper actions for account selection
- Expose grouped account data by institution
- Run `npm test AccountFilter`

### Refactor (10 mins)
- Extract reusable account grouping logic
- Run `npm test`

---

## Phase 2C – Service Layer Integration

### Red (15 mins)
- Update `frontend/src/services/__tests__/TransactionService.test.ts`
- Test `getTransactions` serializes `account_ids` parameter when provided
- Add similar tests for AnalyticsService methods

### Green (20 mins)
- Update `TransactionService.getTransactions` to accept optional accountIds parameter
- Update `AnalyticsService` methods to accept and serialize account_ids
- Implement `buildAccountQueryParams` utility
- Run `npm test services`

### Refactor (10 mins)
- Consolidate query parameter building logic
- Remove redundant parameter serialization
- Run `npm test`

---

## Phase 3A – Header Filter Component Foundation

### Red (15 mins)
- Create test file `frontend/src/components/__tests__/HeaderAccountFilter.test.tsx`
- Test component renders "All accounts" by default
- Test popover opens/closes on trigger click

### Green (25 mins)
- Create `frontend/src/components/HeaderAccountFilter.tsx`
- Implement basic trigger button with glassmorphism styling
- Add popover with basic structure (no functionality yet)
- Run `npm test HeaderAccountFilter`

### Refactor (5 mins)
- Align styling with existing header patterns
- Run `npm test`

---

## Phase 3B – Filter Popover Content

### Red (15 mins)
- Extend HeaderAccountFilter tests to expect grouped checklists by bank
- Test "All accounts" toggle clears custom selections
- Test individual account toggle functionality

### Green (30 mins)
- Implement popover content with grouped account checkboxes
- Add "All accounts" toggle functionality
- Connect to AccountFilterProvider for state management
- Implement selection badge/count on trigger
- Run `npm test HeaderAccountFilter`

### Refactor (10 mins)
- Extract checkbox group components for reusability
- Optimize re-renders with useMemo/useCallback
- Run `npm test`

---

## Phase 3C – Accessibility & Keyboard Navigation

### Red (15 mins)
- Add accessibility tests for keyboard navigation
- Test screen reader labels and ARIA attributes
- Test focus management when popover opens/closes

### Green (20 mins)
- Implement proper ARIA labels and roles
- Add keyboard navigation support (Tab, Enter, Escape)
- Ensure focus returns to trigger when popover closes
- Run accessibility tests and manual keyboard testing

### Refactor (10 mins)
- Consolidate ARIA patterns with existing components
- Run `npm test`

---

## Phase 3D – Header Integration

### Red (10 mins)
- Update `AuthenticatedApp` tests to expect HeaderAccountFilter in header
- Test header layout accommodates new filter component

### Green (15 mins)
- Integrate HeaderAccountFilter into `AuthenticatedApp` header
- Ensure responsive layout and proper spacing
- Run `npm test AuthenticatedApp`

### Refactor (5 mins)
- Remove unused props and verify clean integration
- Run `npm test`

---

## Phase 4A – Transactions Hook Integration

### Red (15 mins)
- Update `frontend/src/hooks/__tests__/useTransactions.test.ts`
- Test hook refetches when account filter changes
- Test pagination resets when filter changes

### Green (20 mins)
- Update `useTransactions` hook to subscribe to AccountFilterProvider
- Forward selected account IDs to TransactionService calls
- Implement pagination reset on filter change
- Run `npm test useTransactions`

### Refactor (10 mins)
- Extract pagination reset logic for reuse
- Optimize hook dependencies and memoization
- Run `npm test`

---

## Phase 4B – Analytics Hooks Integration

### Red (15 mins)
- Update tests for `useAnalytics`, `useBalancesOverview`, `useNetWorthSeries`
- Test hooks forward account IDs to analytics service
- Test hooks refetch when account filter changes

### Green (25 mins)
- Update each analytics hook to subscribe to AccountFilterProvider
- Forward selected account IDs to respective AnalyticsService methods
- Ensure proper memoization to prevent unnecessary refetches
- Run `npm test analytics`

### Refactor (10 mins)
- Consolidate account filter subscription logic across hooks
- Remove duplicate dependency arrays
- Run `npm test`

---

## Phase 4C – Budgets Integration

### Red (15 mins)
- Update `useBudgets` tests to expect filtered transaction totals
- Test budget progress calculations reflect account filter

### Green (20 mins)
- Update `useBudgets` hook to use filtered transaction data
- Ensure budget progress calculations honor account selection
- Run `npm test budgets`

### Refactor (5 mins)
- Clean up any leftover hardcoded account logic
- Run `npm test`

---

## Phase 4D – Dashboard Page Integration

### Red (10 mins)
- Update Dashboard component tests to verify filtered data flows through charts
- Test dashboard reflects account filter changes

### Green (15 mins)
- Verify Dashboard components use filtered hooks (no direct changes needed if hooks are updated)
- Test dashboard updates when account filter changes
- Run manual verification of dashboard filtering

### Refactor (5 mins)
- Remove any component-level account state that's superseded
- Run `npm test dashboard`

---

## Phase 4E – Transactions Page Integration

### Red (10 mins)
- Update Transactions page tests to verify filtered data in tables and totals
- Test transaction list reflects account filter

### Green (15 mins)
- Verify Transactions page uses filtered useTransactions hook
- Test transaction tables and totals update with filter changes
- Run manual verification of transactions filtering

### Refactor (5 mins)
- Clean up unused local state
- Run `npm test transactions`

---

## Phase 5A – Performance Optimization

### Red (15 mins)
- Add test to simulate rapid account toggling
- Test debounced fetch logic prevents redundant API calls
- Test UI remains responsive during rapid changes

### Green (25 mins)
- Implement debouncing for account filter changes (300ms delay)
- Add loading states during filter changes
- Optimize hook dependencies to prevent unnecessary re-renders
- Run performance tests and manual rapid-clicking verification

### Refactor (10 mins)
- Extract debouncing logic for reuse
- Optimize component re-render patterns
- Run `npm test`

---

## Phase 5B – Error Handling & Validation

### Red (15 mins)
- Add tests for empty filter results (no accounts selected)
- Test error states when invalid account IDs are used
- Test user feedback for edge cases

### Green (20 mins)
- Implement proper error messaging for empty results
- Add validation for account selection edge cases
- Ensure graceful fallback to "All accounts" on errors
- Run error scenario tests

### Refactor (10 mins)
- Consolidate error handling patterns
- Clean up error message consistency
- Run `npm test`

---

## Phase 5C – Security Hardening

### Red (10 mins)
- Update security integration tests to require 403/400 for foreign account IDs
- Test appropriate error logging for security violations

### Green (15 mins)
- Verify backend properly rejects foreign account IDs
- Ensure no sensitive account data leaks in error responses
- Test security logging is appropriate but not excessive
- Run security-focused tests

### Refactor (5 mins)
- Clean up any debug logging that could leak sensitive data
- Run `cargo test` and `npm test`

---

## Phase 5D – Final Polish & Documentation

### Red (10 mins)
- Run full test suites to catch any regressions
- Perform manual accessibility audit (keyboard + screen reader)
- Test end-to-end workflow at `http://localhost:8080`

### Green (20 mins)
- Add essential inline documentation for complex logic
- Ensure all new code follows existing naming conventions
- Verify cache TTL alignment with JWT lifecycle
- Run `cargo fmt`, `cargo clippy`, `npm run lint`

### Refactor (15 mins)
- Remove any temporary debug instrumentation
- Consolidate duplicate utilities across frontend/backend
- Final test suite run to ensure everything is green
- Manual smoke test of complete feature across all tabs

---

## Micro-Phase Guidelines

### Timing & Focus
- Each micro-phase should take 5-30 minutes max
- Red phase: Write failing tests only (no implementation)
- Green phase: Minimal code to make tests pass
- Refactor phase: Clean up without changing behavior

### Testing Strategy
- Update existing test files rather than creating new ones
- Run targeted test commands (e.g., `cargo test transactions`, `npm test AccountFilter`)
- Verify `cargo test` and `npm test` pass at end of each refactor phase
- Manual verification at `http://localhost:8080` after every 3-4 micro-phases

### Progression Rules
- Do not advance to next micro-phase until current one is 100% complete
- If a micro-phase takes longer than estimated, break it down further
- If tests fail in unexpected ways, stop and fix before proceeding
- Each micro-phase should have a clear, single deliverable

### Dependencies
- Backend phases (1A-1E) must complete before frontend phases (2A+)
- Context foundation (2A-2B) must complete before UI phases (3A+)
- Service integration (2C) must complete before hook integration (4A+)
- Core functionality (1-4) must complete before optimization/polish (5A+)
