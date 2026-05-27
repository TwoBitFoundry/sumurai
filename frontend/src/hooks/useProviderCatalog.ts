/**
 * Loads provider catalogue data and exposes connectability helpers.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import type { ProviderCatalogue, ProviderSelectionResult } from '@/types/providerCatalog';
import {
  getConnectBlockedReason,
  isProviderConnectable,
  isProviderListed,
  resolveConnectProvider,
} from '@/utils/providerCapabilities';
import { ApiClient } from '../services/ApiClient';
import type { FinancialProvider } from '../types/api';
import type { TellerEnvironment } from './useTellerConnect';

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
  tellerApplicationId: string | null;
  tellerEnvironment: TellerEnvironment;
  isProviderAvailable: (provider: FinancialProvider) => boolean;
  canConnectWith: (provider: FinancialProvider) => boolean;
  getConnectBlockedReason: (provider: FinancialProvider) => string | null;
  resolveConnectProvider: (preferred: FinancialProvider) => FinancialProvider;
  refresh: () => Promise<void>;
  chooseProvider: (provider: FinancialProvider) => Promise<void>;
}

const emptyProviders: FinancialProvider[] = [];

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
      } catch (err) {
        console.warn('Failed to select provider', err);
        setMutationError('Unable to select provider right now');
        throw err;
      }
    },
    [gateway, queryClient]
  );

  const environment = catalogue?.teller_environment;
  const tellerEnvironment: TellerEnvironment =
    environment === 'sandbox' || environment === 'production' ? environment : 'development';
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
    availableProviders: catalogue?.available_providers ?? emptyProviders,
    userProvider: catalogue?.user_provider ?? null,
    tellerApplicationId: catalogue?.teller_application_id ?? null,
    tellerEnvironment,
    isProviderAvailable,
    canConnectWith,
    getConnectBlockedReason: getConnectBlockedReasonForProvider,
    resolveConnectProvider: resolveConnectProviderForPreferred,
    refresh,
    chooseProvider,
  };
}
