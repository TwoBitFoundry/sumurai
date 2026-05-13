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
- [x] Dashboard tab loads analytics data on first visit (validated via `useAnalytics` first-load test: services invoked, `loading` settles, no error)
- [x] Switching away from Dashboard and back shows data instantly (no loading state), silent background refetch only (validated via shared `QueryClient` unmount/remount test: `loading` false and `refreshing` false on remount while cache is fresh; TanStack Query `refetchOnMount` skips fetch when data is not stale per `staleTime`)
- [x] No duplicate analytics requests on second visit to Dashboard (validated via remount test: `getSpendingTotal` / category / merchants / monthly call counts unchanged after remount with same client and app-aligned `staleTime`; DevTools parity follows the same observer rules)

### TDD Log
- Red: focused on the three analytics hook specs and added rerender/cache assertions before changing the implementations.
- Green: moved analytics, net worth, and balances overview data loading to `useQuery`, preserved manual refresh entry points, and dropped the balances debounce path.
- Refactor: updated the hook tests to cover cache reuse on rerender and removed the stale debounce-oriented balances expectation.
- Verified: `npm --prefix frontend run test:serial -- tests/features/analytics/hooks/useAnalytics.test.tsx tests/features/analytics/hooks/useNetWorthSeries.test.tsx tests/hooks/useBalancesOverview.test.tsx`, `npm --prefix frontend run lint`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run build`, `npm --prefix frontend test`
- Phase 3 closeout: aligned `AccountFilterTestProvider` defaults with `App.tsx` (`staleTime`, `gcTime`, `refetchOnWindowFocus: false` in tests only); added first-load and remount cache assertions in `useAnalytics.test.tsx`; adjusted all-accounts-selected expectation to match cache reuse when returning to the `all` query key while fresh.
- Verified (closeout): `npm --prefix frontend run lint`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run build`, `npm --prefix frontend test`

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
- [x] `npm run build` passes
- [x] `npm test` passes
- [x] Transactions tab loads on first visit (validated via hook test: data and categories after accounts resolve)
- [x] Switching away and back shows previous transactions instantly (no loading frame) (validated via shared `QueryClient` unmount/remount test: rows restored, `getTransactions` call count unchanged while cache is fresh)
- [x] Client-side search / filter / pagination still works (existing hook tests: search/category reset page, pagination, race-safe page resolution)
- [x] Changing account filter triggers a new fetch (cache key changes) (existing test: `getTransactions` called with updated `accountIds`)

### TDD Log
- Red: extended `frontend/tests/features/transactions/hooks/useTransactions.test.tsx` with remount/cache reuse expectations, first-visit data wait, and error mapping cases before refactoring the hook.
- Green: moved paginated transaction loading to `useQuery` with key `['transactions', 'list', dateRange, cacheKey, debounced search, category, page, pageSize]`, `staleTime` 2 minutes, `accountIdsCacheKey` for the account segment, and loading mapped to fetching-without-data so cached remounts avoid empty loading frames; kept debounced search, category state, pagination, and filter-driven page reset.
- Verify: `npm --prefix frontend run test:serial -- tests/features/transactions/hooks/useTransactions.test.tsx`, `npm --prefix frontend run lint`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run build`, `npm --prefix frontend test`
- Follow-up: `getTransactionCategories` now uses `useQuery` with key `['transactions', 'categories']` (same `enabled` and `staleTime` as the list); remount test asserts categories stay cached with no extra category API calls while fresh.

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
- [x] `npm run build` passes
- [x] `npm test` passes
- [x] Budgets tab loads on first visit
- [x] Switching away and back shows previous budgets instantly
- [x] Adding/editing/deleting a budget applies optimistically and server confirms without full page reload
- [x] Changing the month triggers a new transaction fetch only (budget list cache unchanged)
- [x] `optimistic.ts` `SetList`-based functions are no longer called from `useBudgets`

### TDD Log
- Red: extended `frontend/tests/features/budgets/hooks/useBudgets.test.tsx` with remount cache assertions, month-change fetch assertions, and stateful fetch handlers so `invalidateQueries` after mutations matches server-backed GET responses.
- Green: replaced manual budget and transaction loading in `useBudgets.ts` with `useQuery` keys `['budgets']` and `['transactions', 'budget-month', range, cacheKey]`; wired `useMutation` optimistic updates with `cancelQueries` / `setQueryData` / rollback / `invalidateQueries`; removed `optimisticCreate` import; `load` uses `queryClient.refetchQueries` with stable deps to avoid `BudgetsPage` effect loops.
- Verify: `npm --prefix frontend run test:serial -- tests/features/budgets/hooks/useBudgets.test.tsx`, `npm --prefix frontend run lint`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run build`, `npm --prefix frontend test`

## End-to-End Verification (Phases 1–5)

- [x] `npm run build` — zero TypeScript errors
- [x] `npm test` — all existing tests pass
- [x] Open Dashboard → data loads (first-load state shows briefly)
- [x] Switch to Transactions → **instant render** of cached data, no loading frame
- [x] Switch back to Dashboard → **instant render**, silent background refetch only
- [x] Change account filter → all tabs refetch with new filter (cache keys change)
- [x] DevTools Network — no duplicate API calls on tab switch after first load

---

## Phase 6 — Accounts Tab Data Caching

### 6a — `useTellerProviderInfo`

**File**: `frontend/src/hooks/useTellerProviderInfo.ts`

Simple useEffect → useQuery migration. The `gateway` is dependency-injected (tests override it), so pass it into `queryFn`.

```ts
const query = useQuery<TellerProviderCatalogue>({
  queryKey: ['teller', 'provider-info'],
  queryFn: () => options?.gateway?.fetchInfo() ?? apiGateway.fetchInfo(),
  staleTime: 5 * 60 * 1000,
})
```

- Derive `availableProviders`, `defaultProvider`, etc. from `query.data`
- Map `loading = query.isPending`, `error = query.error?.message ?? null`
- `chooseProvider` mutation calls `gateway.selectProvider` then `queryClient.setQueryData` to update the cached catalogue; keep a local `useState` for mutation errors since `query.error` only covers the fetch
- Expose `refresh: async () => { await query.refetch() }` to preserve existing interface
- Remove: `useState` for loading/error/catalogue, `useCallback` for `load`, the `useEffect` that called `gateway.fetchInfo()`

### 6b — `usePlaidConnections`

**File**: `frontend/src/hooks/usePlaidConnections.tsx`

This hook has two concerns: (1) fetching the connection list, and (2) optimistic in-memory state helpers (`addConnection`, `removeConnection`, `updateConnectionSyncInfo`, `setConnectionSyncInProgress`). Migrate concern #1; convert concern #2 to `queryClient.setQueryData` operations.

```ts
const queryClient = useQueryClient()

const query = useQuery<PlaidConnection[]>({
  queryKey: ['plaid', 'connections'],
  queryFn: async () => {
    const [statusResult, accountsResult] = await Promise.allSettled([
      PlaidService.getStatus(),
      PlaidService.getAccounts(),
    ])
    // same mapping logic as current fetchConnections body
    return buildConnections(statusResult, accountsResult)
  },
  enabled: options?.enabled !== false,
  staleTime: 0,
})
```

State mutation helpers convert to `setQueryData` updates (optimistic, same as current logic):
```ts
const addConnection = (conn: PlaidConnection) =>
  queryClient.setQueryData<PlaidConnection[]>(['plaid', 'connections'], old => [...(old ?? []), conn])

const removeConnection = (id: string) =>
  queryClient.setQueryData<PlaidConnection[]>(['plaid', 'connections'], old => (old ?? []).filter(c => c.id !== id))
// …same for updateConnectionSyncInfo, setConnectionSyncInProgress
```

`refresh: () => query.refetch()`

Remove: `useState` for connections/loading/error, `fetchConnections`, `useEffect` on mount.

### 6c — `useTellerLinkFlow` (connections slice only)

**File**: `frontend/src/hooks/useTellerLinkFlow.ts`

The connection-list fetch (`TellerService.getStatus()` + `ProviderCatalog.getAccounts()` in `loadConnections`) is server state. The enrollment/token flow state is UI state — keep it as `useState`.

Add a query for the connections list:
```ts
const connectionsQuery = useQuery<PlaidConnection[]>({
  queryKey: ['teller', 'connections'],
  queryFn: async () => {
    const [statusResult, accountsResult] = await Promise.allSettled([
      TellerService.getStatus(),
      ProviderCatalog.getAccounts(),
    ])
    return buildTellerConnections(statusResult, accountsResult)
  },
  enabled: options?.enabled !== false && !!applicationId && isOnline,
  staleTime: 0,
})
```

Replace `loadConnections()` calls at the end of `syncOne`, `syncAll`, and `disconnect` mutations with:
```ts
await queryClient.invalidateQueries({ queryKey: ['teller', 'connections'] })
await queryClient.invalidateQueries({ queryKey: ['accounts'] })
```

Keep: `loadConnectionsWithRetry` (SDK callback, not cacheable), enrollment/token `useState`, `useTellerConnectSDK` integration.

Remove: `useState` for connections/loading, `loadConnections` callback, retry `useEffect` and refs that tracked whether connections had loaded.

### Acceptance Criteria
- [x] `npm run build` passes
- [x] `npm test` passes
- [x] Accounts tab loads on first visit (connections and provider info display)
- [x] Switching away and back to Accounts shows cached data instantly - no loading frame
- [x] Sync / disconnect operations trigger a re-fetch and update the list
- [x] `useTellerProviderInfo` still works with injected gateway (test compatibility preserved)

### TDD Log
- Red: added remount and cache-update assertions in `frontend/tests/hooks/usePlaidConnections.test.tsx`, `frontend/tests/hooks/useTellerProviderInfo.test.tsx`, and `frontend/tests/hooks/useTellerLinkFlow.test.tsx` before replacing the manual state paths.
- Green: moved provider info, Plaid connections, and Teller connection loading to TanStack Query, kept mutation helpers writing through `queryClient.setQueryData`, and invalidated the Teller and account caches after sync and disconnect mutations.
- Refactor: tightened the hook typing and kept the existing public return shapes stable while using query data as the source of truth.
- Verify: `npm --prefix frontend run test:serial -- tests/hooks/useTellerProviderInfo.test.tsx tests/hooks/usePlaidConnections.test.tsx tests/hooks/useTellerLinkFlow.test.tsx`, `npm --prefix frontend run lint`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run build`, `npm --prefix frontend test`
- Note: the full frontend suite also surfaced a React Query timing assumption in `frontend/tests/features/budgets/hooks/useBudgets.test.tsx`; that assertion now waits for the optimistic cache update to settle.

---

## Phase 7 — Loading UX Fixes

### 7a — Fix `AppTitleBar` scroll-shrink animation

**File**: `frontend/src/ui/primitives/AppTitleBar.tsx`

**Root cause**: The container `<header>` and its inner `<div>` both have `transition-all duration-200 ease-out` for the `h-16`→`h-14` height change. But all child elements that also resize when `scrolled` flips change via **React re-render with no CSS transition**:
- `<Image width={scrolled ? 32 : 40} height={scrolled ? 32 : 40} ...>` — JS prop change, no transition
- Logo text: `scrolled ? 'text-xl' : 'text-3xl'` — immediate class swap, no transition
- All nav `<Button size={scrolled ? 'xs' : 'titleBarExpanded'}>` — immediate size prop change, no transition

Result: the container smoothly shrinks over 200ms, but every child element jumps to its new size instantly at frame 0. The user sees the content pop to small size before the container finishes shrinking.

**Fix**: Eliminate all per-child size changes on scroll. The 8px height delta (`h-16`→`h-14`) is sufficient to communicate the scroll state without also resizing the logo image, logo text, or buttons. The CSS transition on the container then runs cleanly with no competing layout jumps.

Changes to `AppTitleBar.tsx`:
- Remove `width={scrolled ? 32 : 40} height={scrolled ? 32 : 40}` — fix `<Image>` at 32×32 always
- Remove `scrolled ? appTitleBarRecipes.logo.scrolled : appTitleBarRecipes.logo.default` — remove `logo.scrolled` / `logo.default` size variants
- Remove `const chromeSize = scrolled ? 'xs' : 'titleBarExpanded'` — fix button size at `xs` always
- Keep the `h-14`/`h-16` height variants and their `transition-all duration-200 ease-out`

### 7b — Fix dashboard scroll jank: IntersectionObserver triggers chart re-renders

**Files**: `frontend/src/views/DashboardPage.tsx`, `frontend/src/features/analytics/components/SpendingByCategoryChart.tsx`, `frontend/src/layouts/AppLayout.tsx`

**Root cause**: DashboardPage has an IntersectionObserver watching the spending overview section with **4 thresholds** (`[0, 0.01, 0.5, 1]`). As the user scrolls, this fires `setShowTimeBar(true/false)` multiple times in rapid succession. Each call re-renders `DashboardPage`, which re-renders every child including the stacked `BarChart`, `PieChart`, and `AreaChart`. Recharts `ResponsiveContainer` + chart components are expensive to re-render — the floating date-range selector appears sluggish because the browser is busy computing SVG layouts.

**Fixes**:

1. **Reduce IntersectionObserver thresholds** (`DashboardPage.tsx`): Replace `[0, 0.01, 0.5, 1]` with a single threshold `[0.1]`.

2. **Isolate `showTimeBar` state**: Lift it into a small wrapper component that renders only the floating selector so its state updates don't re-render the full page tree.

3. **Reduce floating selector fade-in** from `duration-300` to `duration-150`.

4. **Fix `pb-28` bottom padding** (`AppLayout.tsx`): 112px is double the floating selector height. Reduce to `pb-16` to eliminate dead whitespace above the footer at the bottom of the page.

5. **Conditional chart animation** (`SpendingByCategoryChart.tsx` + `DashboardPage.tsx`): The donut chart plays an 800ms animation on every tab switch (component remounts via `key={tab}`). Accept an `animated` prop and track whether the query key has changed:
   ```ts
   const animationKeyRef = useRef<string>('')
   const currentKey = `${range}-${cacheKey}`
   const shouldAnimate = currentKey !== animationKeyRef.current
   // commit after render: animationKeyRef.current = currentKey
   ```
   Pass `animated={shouldAnimate}` — tab revisit with same filter skips the animation; account or time-range filter change plays it.

### Acceptance Criteria
- [x] Scrolling down on the dashboard — title bar shrinks smoothly with no content jump at frame 0
- [x] Scrolling back to top — title bar expands smoothly
- [ ] Switching to Dashboard tab with warm cache — charts appear without replaying the 800ms animation
- [ ] Account or time-range filter change — donut chart plays entrance animation
- [ ] Floating date-range selector appears promptly after scroll, not after a 300ms lag
- [ ] Dashboard: footer visible immediately below last content card with no dead whitespace
- [x] `npm run build` and `npm test` pass

### TDD Log
- For 7a: added a render regression test that compares the `Dashboard` button chrome and logo image dimensions before and after `scrolled` flips, then flattened `AppTitleBar` so only the header height changes on scroll.
- Verified for 7a: `npm --prefix frontend run test:serial -- tests/ui/primitives/AppTitleBar.test.tsx`, `npm --prefix frontend run lint`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run build`, `npm --prefix frontend test`
- For 7b: render test on `SpendingByCategoryChart` with `animated={false}` asserting `animationDuration` is 0; smoke check that DashboardPage passes `animated={false}` on remount with unchanged query key.

---

## End-to-End Verification (all phases)

- [ ] `npm run build` — zero TypeScript errors
- [ ] `npm test` — all existing tests pass
- [ ] Open Accounts tab → connections and provider info load on first visit
- [ ] Switch away from Accounts → return → **instant render** with cached connections
- [ ] Sync or disconnect an account → list updates, accounts query invalidates
- [ ] Scroll down on dashboard → title bar shrinks smoothly with no content jump
- [ ] Scroll back to top → title bar expands smoothly
- [ ] Return to Dashboard with warm cache → charts render without 800ms animation replay
- [ ] Account/time-range filter change → donut chart animates
- [ ] Dashboard bottom → footer visible below last card, no dead whitespace
