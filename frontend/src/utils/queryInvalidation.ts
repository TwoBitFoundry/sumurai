import type { QueryClient } from '@tanstack/react-query';

export type SyncProvider = 'plaid' | 'teller';

const BASE_QUERY_KEYS = [['accounts'], ['transactions'], ['analytics'], ['budgets']] as const;

const CONNECTION_QUERY_KEYS: Record<SyncProvider, readonly [string, string]> = {
  plaid: ['plaid', 'connections'],
  teller: ['teller', 'connections'],
} as const;

export async function invalidateStaleCacheQueries(
  queryClient: QueryClient,
  providers: SyncProvider[]
): Promise<void> {
  const providerKeys = Array.from(new Set(providers)).map(
    (provider) => CONNECTION_QUERY_KEYS[provider]
  );
  const queryKeys = [...BASE_QUERY_KEYS, ...providerKeys];

  await Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
