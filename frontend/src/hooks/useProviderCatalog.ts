/**
 * Loads provider catalogue data and exposes connectability helpers.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import type { ProviderCatalogue, ProviderSelectionResult } from '@/types/providerCatalog';
import {
  getConnectBlockedReason,
  isProviderConnectable,
  isProviderListed,
  resolveConnectProvider,
} from '@/utils/providerCapabilities';
import { ApiClient } from '../services/ApiClient';
import type { FinancialProvider } from '../types/api';
import { invalidateStaleCacheQueries, type SyncProvider } from '../utils/queryInvalidation';

export interface ProviderCatalogGateway {
  fetchInfo: () => Promise<ProviderCatalogue>;
  selectProvider: (provider: FinancialProvider) => Promise<ProviderSelectionResult>;
}

const apiGateway: ProviderCatalogGateway = {
  async fetchInfo() {
    return ApiClient.get<ProviderCatalogue>('/providers/info');
  },
  async selectProvider(provider) {
    return ApiClient.post<ProviderSelectionResult>('/providers/select', { provider });
  },
};

export interface UseProviderCatalogOptions {
  gateway?: ProviderCatalogGateway;
}

export interface ProviderCatalogState {
  loading: boolean;
  error: string | null;
  availableProviders: FinancialProvider[];
  userProvider: FinancialProvider | null;
  isProviderAvailable: (provider: FinancialProvider) => boolean;
  canConnectWith: (provider: FinancialProvider) => boolean;
  getConnectBlockedReason: (provider: FinancialProvider) => string | null;
  resolveConnectProvider: (preferred: FinancialProvider) => FinancialProvider;
  refresh: () => Promise<void>;
  chooseProvider: (provider: FinancialProvider) => Promise<void>;
}

const emptyProviders: FinancialProvider[] = [];

const supportedFinancialProviders = new Set<FinancialProvider>([
  'plaid',
  'teller',
  'simplefin',
  'diy',
]);

const isSupportedFinancialProvider = (value: string): value is FinancialProvider =>
  supportedFinancialProviders.has(value as FinancialProvider);

export function useProviderCatalog(options: UseProviderCatalogOptions = {}): ProviderCatalogState {
  const gateway = options.gateway ?? apiGateway;
  const queryClient = useQueryClient();
  const [mutationError, setMutationError] = useState<string | null>(null);
  const query = useQuery<ProviderCatalogue, Error>({
    queryKey: ['provider', 'catalog'],
    queryFn: () => gateway.fetchInfo(),
    staleTime: 5 * 60 * 1000,
  });
  const catalogue = query.data ?? null;
  const availableProviders = useMemo(
    () => (catalogue?.available_providers ?? []).filter(isSupportedFinancialProvider),
    [catalogue]
  );
  const userProvider = useMemo(() => {
    const provider = catalogue?.user_provider;
    return provider && isSupportedFinancialProvider(provider) ? provider : null;
  }, [catalogue]);

  const chooseProvider = useCallback(
    async (provider: FinancialProvider) => {
      try {
        const result = await gateway.selectProvider(provider);
        setMutationError(null);
        queryClient.setQueryData<ProviderCatalogue>(['provider', 'catalog'], (prev) => {
          if (!prev) {
            return {
              available_providers: [result.user_provider],
              user_provider: result.user_provider,
            };
          }
          return {
            ...prev,
            user_provider: result.user_provider,
          };
        });
        await invalidateStaleCacheQueries(queryClient, [provider as SyncProvider], {
          resetTransactions: 'remove',
        });
      } catch (err) {
        console.warn('Failed to select provider', err);
        setMutationError('Unable to select provider right now');
        throw err;
      }
    },
    [gateway, queryClient]
  );

  const refresh = useCallback(async () => {
    const result = await query.refetch();
    if (result.error) {
      throw result.error;
    }
  }, [query]);

  const isProviderAvailable = useCallback(
    (provider: FinancialProvider) => (catalogue ? isProviderListed(provider, catalogue) : false),
    [catalogue]
  );

  const canConnectWith = useCallback(
    (provider: FinancialProvider) => isProviderConnectable(provider, catalogue),
    [catalogue]
  );

  const getConnectBlockedReasonForProvider = useCallback(
    (provider: FinancialProvider) => getConnectBlockedReason(provider, catalogue),
    [catalogue]
  );

  const resolveConnectProviderForPreferred = useCallback(
    (preferred: FinancialProvider) => resolveConnectProvider(catalogue, preferred),
    [catalogue]
  );

  return {
    loading: query.isPending,
    error: mutationError ?? query.error?.message ?? null,
    availableProviders: availableProviders.length > 0 ? availableProviders : emptyProviders,
    userProvider,
    isProviderAvailable,
    canConnectWith,
    getConnectBlockedReason: getConnectBlockedReasonForProvider,
    resolveConnectProvider: resolveConnectProviderForPreferred,
    refresh,
    chooseProvider,
  };
}
