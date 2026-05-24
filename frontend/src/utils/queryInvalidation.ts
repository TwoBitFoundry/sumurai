/**
 * Invalidates shared client caches after financial data changes.
 */

import type { QueryClient } from '@tanstack/react-query';

export type SyncProvider = 'plaid' | 'teller' | 'simplefin';

const BASE_QUERY_KEYS = [['accounts'], ['transactions'], ['analytics'], ['budgets']] as const;

const CONNECTION_QUERY_KEYS: Record<SyncProvider, readonly [string, string]> = {
  plaid: ['plaid', 'connections'],
  teller: ['teller', 'connections'],
  simplefin: ['simplefin', 'connections'],
} as const;

export async function invalidateStaleCacheQueries(
  queryClient: QueryClient,
  providers: SyncProvider[]
): Promise<void> {
  const providerKeys = Array.from(new Set(providers)).map(
    (provider) => CONNECTION_QUERY_KEYS[provider]
  );
  const queryKeys = [...BASE_QUERY_KEYS, ...providerKeys];

  await Promise.all(
    queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey, refetchType: 'active' }))
  );
}

export async function refreshFinancialDataAfterProviderChange(
  queryClient: QueryClient,
  providers: SyncProvider[]
): Promise<void> {
  await invalidateStaleCacheQueries(queryClient, providers);
  await queryClient.refetchQueries({ queryKey: ['accounts'], type: 'active' });
}

const CATEGORIZATION_DEPENDENT_QUERY_KEYS = [['transactions'], ['analytics'], ['budgets']] as const;

export async function invalidateCategorizationDependentQueries(
  queryClient: QueryClient
): Promise<void> {
  await Promise.all(
    CATEGORIZATION_DEPENDENT_QUERY_KEYS.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey, refetchType: 'active' })
    )
  );
}
