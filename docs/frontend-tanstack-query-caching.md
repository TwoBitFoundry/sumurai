# Plan: Add TanStack Query Client-Side Cache Layer

## Context

The frontend has no data caching layer. Every time a user switches tabs, `AnimatePresence mode="wait"` with `key={tab}` in `AuthenticatedApp.tsx` unmounts the old tab's component tree and remounts the new one. Because each data hook (`useAnalytics`, `useTransactions`, `useBudgets`, etc.) uses raw `useEffect`/`useState` with no shared memory, every tab switch triggers a full set of API calls from scratch. This causes:

- **Giant empty loading frames**: `loading` starts as `true` on mount — glass card containers render immediately but data arrives seconds later
- **Tabs don't remember state**: switching away and back resets filters and data
- **Slow feel**: no stale data to show instantly while a background refetch runs

The fix is **TanStack Query v5** (`@tanstack/react-query@5.100.10`) as a global in-memory cache. Caches responses by query key so remounting a hook returns cached data immediately, then silently refetches in background. No changes to routing, AnimatePresence, or page components — hooks keep the same public interface.

---

## Design Principles

### Dependency Injection
- `QueryClient` is created **once at app root** (`App.tsx`) and injected via `QueryClientProvider`
- Hooks access it exclusively via `useQueryClient()` — never via a direct import of a module singleton
- Service classes (`AnalyticsService`, `TransactionService`, etc.) remain injected through their existing static interface; hooks call them directly without wrapping

### KISS
- No wrapper functions around `useQuery`, no custom hook factories, no query key builder classes
- Query keys are plain inline arrays: `['analytics', range, accountIdsCacheKey]`
- One new pure utility function (`accountIdsCacheKey`) in an existing utils file — nothing more
- Optimistic mutations use TQ's native `onMutate`/`onError`/`onSettled` — no new abstraction needed

### Separation of Concerns
- Cache key derivation (how to turn account IDs into a stable string) lives in `utils/cacheKeys.ts`, not mixed into hook logic
- `QueryClient` global config (staleTime, gcTime, retry) is defined in one place only: `App.tsx`
- Per-query overrides (e.g., `staleTime: 0` for accounts) are declared at the call site in the relevant hook
- Service layer is not touched — hooks remain the only layer that knows about TQ

---

## v5 API Reference

- `isPending` = no cached data + currently fetching (first-load indicator; replaces v4 `isLoading`)
- `isFetching` = any fetch in progress (includes background refetch)
- `gcTime` = garbage-collect unused entries (replaces v4 `cacheTime`)
- `useMutation` callbacks (`onMutate`, `onError`, `onSuccess`, `onSettled`) go on the mutation config
- `queryClient.invalidateQueries({ queryKey: [...] })` marks matching entries stale and refetches active ones
- Latest stable: `5.100.10`

---

## New File

**`frontend/src/utils/cacheKeys.ts`** — single exported pure function:
```ts
export function accountIdsCacheKey(
  allAccountIds: string[],
  selectedAccountIds: string[],
  isAllSelected: boolean,
): string {
  if (allAccountIds.length === 0) return 'none';
  if (isAllSelected) return 'all';
  if (selectedAccountIds.length === 0) return 'none';
  return [...selectedAccountIds].sort().join(',');
}
```
Used by every data hook to produce a stable, serializable cache key segment.

---

## Phase 1 — Install and Wire Up QueryClient

**Files**: `frontend/package.json`, `frontend/src/App.tsx`

### Steps
1. Install `@tanstack/react-query@latest` (resolves to 5.100.10)
2. In `App.tsx`, create `QueryClient` at **module level** (outside any component — prevents recreation on re-render per TQ docs):
   ```ts
   const queryClient = new QueryClient({
     defaultOptions: {
       queries: {
         staleTime: 5 * 60 * 1000,
         gcTime: 10 * 60 * 1000,
         retry: 1,
         refetchOnWindowFocus: true,
       },
     },
   })
   ```
3. Wrap the `App` component's return with `<QueryClientProvider client={queryClient}>` as the **outermost** wrapper so `AccountFilterProvider` and all children can call `useQueryClient()`

### Acceptance Criteria
- [x] `npm install` resolves without peer-dep conflicts
- [x] `npm run build` passes with no TypeScript errors
- [x] `npm test` passes
- [x] `useQueryClient()` callable from any component in the tree without error

### TDD Log
- Red: added `frontend/tests/App.test.tsx` to probe `useQueryClient()` through the app provider stack.
- Green: added module-level `QueryClient`, `QueryClientProvider`, and exported `AppProviders` from `frontend/src/App.tsx`.
- Verify: `npm run test:serial -- frontend/tests/App.test.tsx`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test`.

---

## Phase 2 — Refactor `AccountFilterProvider`

**Files**: `frontend/src/utils/cacheKeys.ts` (new), `frontend/src/hooks/useAccountFilter.tsx`

This is the root dependency for every data hook. Migrating it first means all later hooks can use `accountIdsCacheKey` immediately.

### Steps
1. Create `frontend/src/utils/cacheKeys.ts` with `accountIdsCacheKey` (see above)
2. In `AccountFilterProvider`:
   - Replace `fetchAccounts` + `useEffect` + `accounts` useState with:
     ```ts
     const accountsQuery = useQuery({
       queryKey: ['accounts'],
       queryFn: () => ProviderCatalog.getAccounts(),
       staleTime: 0,
     })
     ```
   - Derive `accounts` from `accountsQuery.data ?? []`
   - Remove the `accounts` useState and the `warnedInvalidAccountsRef` loading guard (TQ deduplicates in-flight requests)
   - Keep `selectedAccountIds` as `useState` — it is user selection state, not server state
   - Replace `fetchAccounts()` in `ACCOUNTS_CHANGED_EVENT` listener with `queryClient.invalidateQueries({ queryKey: ['accounts'] })` — accessed via `useQueryClient()`
   - Map context `loading` to `accountsQuery.isPending`

### Acceptance Criteria
- [x] `npm run build` passes
- [x] `npm test` passes
- [x] Account filter populates correctly on app load
- [x] `ACCOUNTS_CHANGED_EVENT` still triggers a refetch of the account list
- [x] No duplicate in-flight requests to the accounts endpoint on mount

### TDD Log
- Red: added `frontend/tests/hooks/useAccountFilter.test.tsx` and `frontend/tests/utils/cacheKeys.test.ts` coverage for cache key output, mount dedupe, and query invalidation.
- Green: replaced manual account fetching with `useQuery`, added `accountIdsCacheKey`, and wrapped test/story consumers in a query client provider.
- Verify: `npm run test:serial -- tests/utils/cacheKeys.test.ts tests/hooks/useAccountFilter.test.tsx`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:serial -- tests/features/analytics/hooks/useNetWorthSeries.test.tsx tests/hooks/useBalancesOverview.test.tsx`, `npm run lint`, `npm run typecheck`, `npm run test`.

---

## Phase 3 — Refactor Analytics Hooks

**Files**:
- `frontend/src/features/analytics/hooks/useAnalytics.ts`
- `frontend/src/features/analytics/hooks/useNetWorthSeries.ts`
- `frontend/src/hooks/useBalancesOverview.ts`

Each hook calls `useAccountFilter()` to get account state, derives `accountIdsCacheKey`, then wraps its service call in `useQuery`. The public return interface is preserved.

### `useAnalytics.ts`
```ts
const cacheKey = accountIdsCacheKey(allAccountIds, selectedAccountIds, isAllAccountsSelected);
const query = useQuery({
  queryKey: ['analytics', range, cacheKey],
  queryFn: () => Promise.all([getSpendingTotal, getCategorySpending, getTopMerchants, getMonthlyTotals]),
  enabled: !accountsLoading,
})
```
- Handle "no accounts selected" inside `queryFn` (return zeroed values — same guard as current code)
- Map: `loading = query.isPending`, `refreshing = query.isFetching && !query.isPending`
- Destructure data fields from `query.data`
- Remove: `AbortController`, `hasLoadedRef`, all manual `useState` for data pieces

### `useNetWorthSeries.ts`
```ts
const query = useQuery({
  queryKey: ['analytics', 'net-worth', range, cacheKey],
  queryFn: () => AnalyticsService.getNetWorthOverTime(start, end, accountIds),
  enabled: !accountsLoading && !!start && !!end,
})
```
- Expose `reload: () => query.refetch()` to preserve existing interface
- Remove: `AbortController`, `loadGenerationRef`, `pendingLoadAfterAccountsRef`, all manual state

### `useBalancesOverview.ts`
```ts
const query = useQuery({
  queryKey: ['analytics', 'balances-overview', cacheKey],
  queryFn: () => AnalyticsService.getBalancesOverview(accountIds),
  enabled: !accountsLoading,
})
```
- Expose `refresh: () => query.refetch()` to preserve existing interface
- Remove `useDebouncedValue`, `lastTriggeredEnd`, mounted guard — TQ re-runs when the query key changes

### Acceptance Criteria
- [x] `npm run build` passes
- [x] `npm test` passes
- [ ] Dashboard tab loads analytics data on first visit
- [ ] Switching away from Dashboard and back shows data instantly (no loading state), silent background refetch only
- [ ] No duplicate analytics requests on second visit to Dashboard (verify in DevTools Network)

### TDD Log
- Red: focused on the three analytics hook specs and added rerender/cache assertions before changing the implementations.
- Green: moved analytics, net worth, and balances overview data loading to `useQuery`, preserved manual refresh entry points, and dropped the balances debounce path.
- Refactor: updated the hook tests to cover cache reuse on rerender and removed the stale debounce-oriented balances expectation.
- Verified: `npm --prefix frontend run test:serial -- tests/features/analytics/hooks/useAnalytics.test.tsx tests/features/analytics/hooks/useNetWorthSeries.test.tsx tests/hooks/useBalancesOverview.test.tsx`, `npm --prefix frontend run lint`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run build`, `npm --prefix frontend test`

---

## Phase 4 — Refactor `useTransactions.ts`

**File**: `frontend/src/features/transactions/hooks/useTransactions.ts`

### Steps
```ts
const cacheKey = accountIdsCacheKey(allAccountIds, selectedAccountIds, isAllAccountsSelected);
const query = useQuery({
  queryKey: ['transactions', dateRange, cacheKey],
  queryFn: () => TransactionService.getTransactions(filters),
  enabled: !accountsLoading,
  staleTime: 2 * 60 * 1000,
})
```
- Keep all client-side filtering (`search`, `selectedCategory`), pagination, and `useDebounce` — they operate on `query.data ?? []`
- Map: `isLoading = query.isPending`, `error = query.error?.message ?? null`
- Remove manual `load`, `setIsLoading`, `setAll`, `setError` state and effect

### Acceptance Criteria
- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] Transactions tab loads on first visit
- [ ] Switching away and back shows previous transactions instantly (no loading frame)
- [ ] Client-side search / filter / pagination still works
- [ ] Changing account filter triggers a new fetch (cache key changes)

---

## Phase 5 — Refactor `useBudgets.ts`

**File**: `frontend/src/features/budgets/hooks/useBudgets.ts`

### Steps
Two queries replace the manual budget + transaction loading:
```ts
const budgetsQuery = useQuery({
  queryKey: ['budgets'],
  queryFn: BudgetService.getBudgets,
  staleTime: 5 * 60 * 1000,
})

const txnsQuery = useQuery({
  queryKey: ['transactions', 'budget-month', range, cacheKey],
  queryFn: () => TransactionService.getTransactions({ startDate: range.start, endDate: range.end, accountIds }),
  enabled: !accountsLoading && budgetsQuery.isSuccess,
  staleTime: 2 * 60 * 1000,
})
```

Mutations use TQ's native optimistic pattern (supersedes the `optimistic.ts` `SetList`-based helpers for this hook):
```ts
const addMutation = useMutation({
  mutationFn: (args) => BudgetService.createBudget(args),
  onMutate: async (newBudget) => {
    await queryClient.cancelQueries({ queryKey: ['budgets'] })
    const previous = queryClient.getQueryData<Budget[]>(['budgets'])
    queryClient.setQueryData(['budgets'], (old: Budget[]) => [...(old ?? []), { id: tempId(), ...newBudget }])
    return { previous }
  },
  onError: (_err, _vars, context) => queryClient.setQueryData(['budgets'], context?.previous),
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['budgets'] }),
})
```
`update` and `remove` mutations follow the same `onMutate`/`onError`/`onSettled` pattern.

- Expose `load: async () => { await budgetsQuery.refetch(); await txnsQuery.refetch() }` to preserve interface
- Map: `isLoading = budgetsQuery.isPending`, `transactionsLoading = txnsQuery.isFetching`
- `loadedRef` and `budgetsReady` state are removed (TQ manages fetch lifecycle)

### Acceptance Criteria
- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] Budgets tab loads on first visit
- [ ] Switching away and back shows previous budgets instantly
- [ ] Adding/editing/deleting a budget applies optimistically and server confirms without full page reload
- [ ] Changing the month triggers a new transaction fetch only (budget list cache unchanged)
- [ ] `optimistic.ts` `SetList`-based functions are no longer called from `useBudgets`

---

## End-to-End Verification

- [ ] `npm run build` — zero TypeScript errors
- [ ] `npm test` — all existing tests pass
- [ ] Open Dashboard → data loads (first-load state shows briefly)
- [ ] Switch to Transactions → **instant render** of cached data, no loading frame
- [ ] Switch back to Dashboard → **instant render**, silent background refetch only
- [ ] Change account filter → all tabs refetch with new filter (cache keys change)
- [ ] DevTools Network — no duplicate API calls on tab switch after first load
