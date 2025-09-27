# Account Filter Implementation Plan (TDD Phases)

## Phase 1 – Backend Filtering Core

### Red
- Update existing integration tests in `backend/tests` for `GET /api/transactions` so they now expect `account_ids[]` filtering (cover happy path and unauthorized account IDs) and fail until support exists.
- Extend current analytics endpoint suites (spending total, categories, balances overview) so they assert `account_ids[]` behavior and reject foreign account IDs.
- Adjust repository-level unit tests to verify account-scoped queries use only accounts owned by the authenticated user.

### Green
- Parse `account_ids[]` in `TransactionsQuery`, validate ownership via repository lookups, and use the filtered list in `get_transactions_with_account_for_user` queries.
- Thread the account filter into analytics services, ensuring calculations and cached responses reflect only the selected accounts.
- Introduce deterministic cache key extensions (e.g., SHA1 of sorted account UUIDs) so filtered responses don’t reuse “all accounts” data.
- Run `cargo test` to confirm new and existing tests pass.

### Refactor
- Consolidate validation helpers for account ownership to avoid duplication across endpoints.
- Prune log statements to avoid leaking account identifiers, re-run `cargo test` to ensure nothing regressed.

---

## Phase 2 – Shared Filter State & Services

### Red
- Update existing frontend test suites to cover the forthcoming `AccountFilterProvider` (hook + context), ensuring they now fail until the provider defaults to “All accounts”, persists selections, and exposes grouped account metadata.
- Extend service-layer unit tests so current expectations require `TransactionService.getTransactions` to serialize `account_ids` when provided.

### Green
- Implement the provider near `App`/`SessionManager`, loading Plaid connections via `usePlaidConnections` and exposing helper actions (select all, toggle bank, toggle account). Place new context/hooks under existing `frontend/src/hooks`/`context` patterns so the project structure stays consistent.
- Update `TransactionService` (and analytics service wrappers) to accept optional account IDs, including them in request URLs.
- Run `npm test -- AccountFilter` (or equivalent Vitest filter) followed by the full frontend test suite.

### Refactor
- Extract reusable utility (e.g., `buildAccountQueryParams`) to share between services, keeping tests green.
- Remove redundant local state in hooks that now rely on the context.

---

## Phase 3 – Header Filter UI

### Red
- Update header/navigation component tests to expect the new `HeaderAccountFilter` popover (default “All accounts”, context updates, keyboard navigation, dark mode styling) so they fail until implemented.
- Expand existing accessibility snapshots to cover the popover and checkbox labeling.

### Green
- Insert the new trigger into `AuthenticatedApp`’s header, styled with existing glassmorphism patterns (`bg-white/80`, `backdrop-blur`), and build grouped checklists by bank using the provider state. Keep component files within established `components` subfolders and adhere to current naming conventions.
- Ensure the trigger reflects active selections (badge/count) and the “All accounts” toggle clears custom selections.
- Re-run targeted component tests, then the full Vitest suite.

### Refactor
- Merge overlapping button/pill styles with existing Tailwind utility helpers to keep header styling consistent.
- Verify no unused props remain and re-run tests to confirm stability.

---

## Phase 4 – Feature Integrations (Dashboard, Transactions, Budgets)

### Red
- Expand existing `useTransactions` tests so they now expect refetching when the account filter changes and pagination/search reset accordingly.
- Update analytics hook suites (`useAnalytics`, `useBalancesOverview`, `useNetWorthSeries`) so current expectations require forwarding account IDs downstream.
- Adjust `useBudgets` tests to expect filtered transaction totals when the provider selection changes.

### Green
- Subscribe each hook/component to the `AccountFilterProvider`, forwarding the selected IDs to their service calls and local memoization.
- Confirm the Transactions page pipes filtered data through tables and totals; adjust Dashboard/Balances charts and Budgets progress calculations to honor the filtered datasets.
- Execute `npm test` and key smoke tests (`cargo test` for analytics backfill if needed) after each integration.

### Refactor
- Remove any leftover per-component account state that’s superseded by the provider.
- Co-locate shared hook utilities (e.g., pagination reset logic) following existing folder conventions before rerunning the entire test suite.

---

## Phase 5 – UX & Security Hardening

### Red
- Update regression suites to simulate rapid bank/account toggling so they fail until debounced fetch logic prevents stale selections.
- Extend existing security-focused integration tests so they now require foreign account IDs to return 403/400 responses with appropriate logging.

### Green
- Implement debouncing/backoff where necessary to avoid redundant API calls while maintaining responsiveness.
- Harden validation/error messaging in the UI so users get clear feedback when filters produce empty results or invalid selections.
- Re-run both backend and frontend test suites, plus manual accessibility checks (keyboard traversal, screen-reader labels).

- Review caching TTL alignment with JWT lifetime, tidy helper naming, and remove temporary debug instrumentation.
- Finalize documentation (inline comments where essential) and perform a full `cargo fmt`, `cargo clippy`, and `npm run lint` to finish with clean builds.
- Double-check new code respects existing module/file naming conventions across frontend and backend paths.

---

## Continuous Testing Reminder
- Every phase follows Red → Green → Refactor; do not progress until all tests in the current phase are green.
- Prefer updating existing tests over introducing new files/specs so coverage stays consolidated.
- Record manual verification steps (e.g., end-to-end smoke on `http://localhost:8080`) after each phase to ensure the shared filter behaves consistently across tabs.
