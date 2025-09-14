# Frontend Refactor Plan: Separate Concerns in `AuthenticatedApp`

## Goals
- Reduce `frontend/src/components/AuthenticatedApp.tsx` to a thin shell (tabs + providers + layout).
- Move data-fetching, side effects, and derived state into feature hooks.
- Keep services as-is; introduce cohesive feature folders with small, testable components.
- Preserve current UX and API contracts; no new dependencies.

## Guiding Principles
- UI components are presentational; hooks own data and side effects.
- One IO layer: existing `services/*` remain the only HTTP boundary.
- Shared helpers live in `utils/*` and UI atoms in `components/ui/*`.
- Incremental PRs that keep the app runnable after each step.

## Observed Pain Points (today)
- Mixed concerns: large component combines UI, state, effects, helpers.
- Inline helpers for currency/category/date logic duplicated in-place.
- Page-sized JSX blocks (Dashboard, Transactions, Budgets, Connect) inside one file.

## Target Structure
- `frontend/src/pages/`
  - `DashboardPage.tsx` — assembles analytics widgets and shared dashboard state
  - `TransactionsPage.tsx` — table + filters (+ pagination if added later)
  - `BudgetsPage.tsx` — list + form + progress
  - `ConnectPage.tsx` — Plaid Link + connections
- `frontend/src/features/analytics/`
  - `hooks/useAnalytics.ts` — current month, categories, daily, monthly totals, top merchants
  - `components/SpendingByCategoryChart.tsx`
  - `components/DailySpendingChart.tsx`
  - `components/TopMerchantsList.tsx`
  - `adapters/chartData.ts` — map API → Recharts datasets
- `frontend/src/features/transactions/`
  - `hooks/useTransactions.ts` — fetch + debounce search + category/date filters + derived lists
  - `components/TransactionsTable.tsx`
  - `components/TransactionsFilters.tsx`
- `frontend/src/features/budgets/`
  - `hooks/useBudgets.ts` — list + optimistic create/update/delete
  - `components/BudgetForm.tsx`
  - `components/BudgetList.tsx`
  - `components/BudgetProgress.tsx`
- `frontend/src/features/plaid/`
  - `hooks/usePlaidLinkFlow.ts` — link token, `usePlaidLink`, onSuccess exchange, status refresh
  - `components/ConnectionsList.tsx`
  - `components/ConnectButton.tsx`
- `frontend/src/components/ui/`
  - `Card.tsx`, `Table.tsx` (`Th`, `Td`), `Tag.tsx`
- `frontend/src/state/`
  - `MockModeContext.tsx` — lift mock/real toggle used across pages
  - `DashboardContext.tsx` (optional) — `dateRange`, `hoveredCategory` shared on dashboard
- `frontend/src/utils/`
  - `format.ts` — `fmtUSD`, casing helpers
  - `dateRanges.ts` — range presets + `computeDateRange`
  - `categories.ts` — `formatCategoryName`, color/tag mapping

## Extraction Checklist (by feature)
1) Shared atoms & utils
- Move `Card`, `Th`, `Td` from `AuthenticatedApp` → `components/ui/*`.
- Move `fmtUSD`, `formatCategoryName`, color/tag helpers → `utils/*`.
- Create `utils/dateRanges.ts` from current inline logic.

2) Transactions
- Create `features/transactions/hooks/useTransactions.ts` encapsulating load + search + filters.
- Extract `TransactionsTable` and `TransactionsFilters` as presentational components.
- Prefer `types/api` `Transaction` over local aliases where possible.

3) Analytics
- Create `features/analytics/hooks/useAnalytics.ts` wrapping `AnalyticsService` calls.
- Add `adapters/chartData.ts` to normalize API output for Recharts.
- Split charts into `SpendingByCategoryChart`, `DailySpendingChart`, `TopMerchantsList`.
- Compose these in `pages/DashboardPage.tsx` together with existing widgets
  (`BalancesOverview`, `NetWorthOverTimeWidget`).

4) Budgets
- Create `features/budgets/hooks/useBudgets.ts` and move optimistic CRUD handlers.
- Extract `BudgetForm`, `BudgetList`, and `BudgetProgress` components.
- Keep duplicate-category validation and messages intact.

5) Plaid Link flow
- Create `features/plaid/hooks/usePlaidLinkFlow.ts`:
  - Handles `link_token` retrieval, `usePlaidLink`, onSuccess exchange, refresh/sync/status.
  - Expose per-connection actions (sync single, sync all, disconnect).
- Build `ConnectPage` from `ConnectionsList` and `ConnectButton` using the hook.

6) Pages & Shell
- Create `DashboardPage`, `TransactionsPage`, `BudgetsPage`, `ConnectPage` composing their hooks.
- Slim `AuthenticatedApp.tsx` to a small tab switcher + global providers.
- Move mock/real toggle into `state/MockModeContext.tsx` and consume in pages.

7) Cleanup & Types
- Remove inline helper types and reuse `types/api`.
- Normalize category id/name handling via `utils/categories.ts`.
- Keep `services/*` unchanged as the single IO boundary.

## TDD Plan By PR (Red → Green → Refactor)

### PR 1: UI Atoms + Utils Extraction (no behavior change)
- Red:
  - Add failing unit tests for new utils:
    - `utils/format` (`fmtUSD` edge cases: NaN, strings, large values).
    - `utils/categories` (`formatCategoryName`, stable tag/color mapping by name hash).
    - `utils/dateRanges` (`computeDateRange` for presets: current-month, past-year, all-time).
  - Add lightweight render tests for atoms:
    - `components/ui/Card` renders children and merges classes.
    - `components/ui/Table` exports `Th`, `Td` with correct semantics.
- Green:
  - Implement `format.ts`, `categories.ts`, `dateRanges.ts` by lifting existing logic verbatim.
  - Implement `Card.tsx`, `Table.tsx` (`Th`, `Td`) by lifting from `AuthenticatedApp`.
  - Update imports in `AuthenticatedApp` to use new modules; keep behavior identical.
- Refactor:
  - Delete in-file helper duplicates; ensure all references use `utils/*` and `components/ui/*`.
  - Keep tests green; no visual changes expected.
- Key test files:
  - `frontend/src/utils/format.test.ts`
  - `frontend/src/utils/categories.test.ts`
  - `frontend/src/utils/dateRanges.test.ts`
  - `frontend/src/components/ui/Card.test.tsx`
  - `frontend/src/components/ui/Table.test.tsx`
 - Run tests as you go:
  - `cd frontend && npm test -- --run` (CI mode) after adding tests (expect failures), and again after implementation (expect pass).
  - `cd frontend && tsc -b` to catch type regressions.
  - Optional: `npm run test:ui` in watch mode while refactoring.

### PR 2: Transactions (hook + table + filters) + route switch
- Red:
  - `useTransactions` hook tests using mocked `TransactionService`:
    - Loads data on mount; exposes `isLoading`, `error`, `transactions`.
    - Search filtering (debounced) with `vi.useFakeTimers()`.
    - Category filter and date-range filter composition.
    - Derivations: categories list, empty-state when filters exclude all.
  - `TransactionsTable`/`TransactionsFilters` component tests:
    - Renders rows, headers, empty state, and calls provided handlers.
- Green:
  - Implement `features/transactions/hooks/useTransactions.ts` and components.
  - Create `pages/TransactionsPage.tsx` composing hook + components.
  - Wire `AuthenticatedApp` to render `TransactionsPage` for the tab.
- Refactor:
  - Remove transactions-specific state/effects from `AuthenticatedApp`.
  - Consolidate local `Txn` to `types/api#Transaction` or a single alias.
- Key test files:
  - `frontend/src/features/transactions/hooks/useTransactions.test.ts`
  - `frontend/src/features/transactions/components/TransactionsTable.test.tsx`
  - `frontend/src/features/transactions/components/TransactionsFilters.test.tsx`
 - Run tests as you go:
  - `cd frontend && npm test -- --run` to see Red (failing new tests) then Green after implementation.
  - `cd frontend && tsc -b` for type safety.
  - Quick smoke: `npm run build` to ensure bundling still succeeds after wiring.

### PR 3: Analytics feature + DashboardPage wiring
- Red:
  - `useAnalytics` tests using mocked `AnalyticsService`:
    - Returns current-month spending, categories, daily, monthly totals, top merchants.
    - Handles loading and error states.
  - `adapters/chartData` tests:
    - Normalize API payloads to Recharts-friendly shapes; stable keys and colors.
  - Component tests for charts render with sample data.
- Green:
  - Implement `features/analytics/hooks/useAnalytics.ts` and `adapters/chartData.ts`.
  - Implement chart components and `pages/DashboardPage.tsx` composing them with
    `BalancesOverview` and `NetWorthOverTimeWidget`.
  - Route `AuthenticatedApp` dashboard tab to `DashboardPage`.
- Refactor:
  - Remove inline analytics state/derivations from `AuthenticatedApp`.
  - Co-locate dashboard-only state in page or an optional `DashboardContext`.
- Key test files:
  - `frontend/src/features/analytics/hooks/useAnalytics.test.ts`
  - `frontend/src/features/analytics/adapters/chartData.test.ts`
  - `frontend/src/features/analytics/components/*.test.tsx`
 - Run tests as you go:
  - `cd frontend && npm test -- --run` before/after implementation.
  - `cd frontend && tsc -b` for types.
  - Optional perf sanity: run charts locally and confirm no console errors.

### PR 4: Budgets feature + BudgetsPage wiring
- Red:
  - `useBudgets` tests with mocked `BudgetService` and optimistic helpers:
    - Loads budgets; create/update/delete optimistic flows (success and failure rollbacks).
    - Duplicate-category validation message and behavior.
  - `BudgetForm`/`BudgetList`/`BudgetProgress` render tests.
- Green:
  - Implement `features/budgets/hooks/useBudgets.ts` using `optimisticCreate/Update/Delete`.
  - Implement components and `pages/BudgetsPage.tsx`.
  - Wire budgets tab to `BudgetsPage`.
- Refactor:
  - Remove budget handlers/state from `AuthenticatedApp`.
  - Normalize category id/name mapping via `utils/categories`.
- Key test files:
  - `frontend/src/features/budgets/hooks/useBudgets.test.ts`
  - `frontend/src/features/budgets/components/*.test.tsx`
 - Run tests as you go:
  - `cd frontend && npm test -- --run` pre/post implementation to validate optimistic flows.
  - `cd frontend && tsc -b` to validate types.
  - Manual: create/update/delete cycles in UI; verify rollbacks on simulated errors.

### PR 5: Plaid feature + ConnectPage wiring
- Red:
  - `usePlaidLinkFlow` tests:
    - Mocks `react-plaid-link`’s `usePlaidLink` to control `open`/`ready`.
    - On success, calls exchange token and refreshes status.
    - Provides `syncAll`, `syncOne`, and `disconnect` actions; handles errors.
  - `ConnectionsList`/`ConnectButton` render/interaction tests.
- Green:
  - Implement `features/plaid/hooks/usePlaidLinkFlow.ts` and components.
  - Implement `pages/ConnectPage.tsx` and wire connect tab.
- Refactor:
  - Remove Plaid link/status/sync logic from `AuthenticatedApp`.
  - Keep existing `usePlaidConnections` integration intact.
- Key test files:
  - `frontend/src/features/plaid/hooks/usePlaidLinkFlow.test.ts`
  - `frontend/src/features/plaid/components/*.test.tsx`
 - Run tests as you go:
  - `cd frontend && npm test -- --run` with mocks for `react-plaid-link` and services.
  - `cd frontend && tsc -b` for types.
  - Manual: sandbox Link with mock token; verify open/ready flow.

### PR 6: Final cleanups; AuthenticatedApp as shell-only
- Red:
  - High-level test: `AuthenticatedApp` renders the correct page per tab and provides global providers (e.g., mock/real toggle).
- Green:
  - Finalize `AuthenticatedApp` to layout, header, tab switch, and providers only.
- Refactor:
  - Remove dead code, obsolete helpers, and local types.
  - Ensure imports route through features/pages/utils consistently.
- Key test files:
  - `frontend/src/components/AuthenticatedApp.test.tsx`
 - Run tests as you go:
  - `cd frontend && npm test -- --run` to ensure the shell-only app passes integration tests.
  - `cd frontend && npm run build` as final sanity.

## Testing & Validation
- Red-first: write/adjust tests per PR before implementation; run `cd frontend && npm test --silent` to assert failures.
- Re-run tests after Green to confirm pass
- Types: `cd frontend && tsc -b`
- Build: `cd frontend && npm run build`
- Manual QA at `http://localhost:8080`:
  - Tabs switch, search/filter transactions, budgets CRUD, Plaid connect/sync/disconnect.

## Non-Goals & Constraints
- No new dependencies (e.g., React Query) in this refactor.
- Visuals remain consistent; reuse `BalancesOverview` and `NetWorthOverTimeWidget`.
- Backend endpoints and `services/*` public interfaces remain unchanged.

## Risks & Mitigations
- Risk: Subtle behavior drift during extraction.
  - Mitigation: Move logic verbatim first; only then normalize helpers.
- Risk: Type drift between local aliases and `types/api`.
  - Mitigation: Add minimal adapters where needed; tighten types incrementally.

## End State Sketch (`AuthenticatedApp.tsx`)
```tsx
export function AuthenticatedApp({ onLogout, dark, setDark }: Props) {
  return (
    <MockModeProvider>
      <Layout onLogout={onLogout} dark={dark} setDark={setDark}>
        {tab === 'dashboard' && <DashboardPage />}
        {tab === 'transactions' && <TransactionsPage />}
        {tab === 'budgets' && <BudgetsPage />}
        {tab === 'connect' && <ConnectPage />}
      </Layout>
    </MockModeProvider>
  );
}
```
