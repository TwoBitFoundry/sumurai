import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { ApiClient } from '../services/ApiClient';
import type { FinancialProvider } from '../types/api';
import type { TellerEnvironment } from './useTellerConnect';

export interface TellerProviderCatalogue {
  available_providers: FinancialProvider[];
  default_provider: FinancialProvider;
  user_provider?: FinancialProvider;
  teller_application_id?: string;
  teller_environment?: string;
}

export interface TellerProviderSelectionResult {
  user_provider: FinancialProvider;
}

export interface TellerProviderGateway {
  fetchInfo: () => Promise<TellerProviderCatalogue>;
  selectProvider: (provider: FinancialProvider) => Promise<TellerProviderSelectionResult>;
}

const apiGateway: TellerProviderGateway = {
  async fetchInfo() {
    return ApiClient.get<TellerProviderCatalogue>('/providers/info');
  },
  async selectProvider(provider) {
    return ApiClient.post<TellerProviderSelectionResult>('/providers/select', { provider });
  },
};

export interface UseTellerProviderInfoOptions {
  gateway?: TellerProviderGateway;
}

export interface TellerProviderInfoState {
  loading: boolean;
  error: string | null;
  availableProviders: FinancialProvider[];
  selectedProvider: FinancialProvider | null;
  defaultProvider: FinancialProvider | null;
  userProvider: FinancialProvider | null;
  tellerApplicationId: string | null;
  tellerEnvironment: TellerEnvironment;
  refresh: () => Promise<void>;
  chooseProvider: (provider: FinancialProvider) => Promise<void>;
}

const emptyProviders: FinancialProvider[] = [];

export function useTellerProviderInfo(
  options: UseTellerProviderInfoOptions = {}
): TellerProviderInfoState {
  const gateway = options.gateway ?? apiGateway;
  const queryClient = useQueryClient();
  const [mutationError, setMutationError] = useState<string | null>(null);
  const query = useQuery<TellerProviderCatalogue, Error>({
    queryKey: ['teller', 'provider-info'],
    queryFn: () => gateway.fetchInfo(),
    staleTime: 5 * 60 * 1000,
  });
  const catalogue = query.data ?? null;

  const selectedProvider = useMemo<FinancialProvider | null>(() => {
    if (!catalogue) {
      return null;
    }
    return catalogue.user_provider ?? catalogue.default_provider ?? null;
  }, [catalogue]);

  const chooseProvider = useCallback(
    async (provider: FinancialProvider) => {
      try {
        const result = await gateway.selectProvider(provider);
        setMutationError(null);
        queryClient.setQueryData<TellerProviderCatalogue>(['teller', 'provider-info'], (prev) => {
          if (!prev) {
            return {
              available_providers: [result.user_provider],
              default_provider: result.user_provider,
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

  return {
    loading: query.isPending,
    error: mutationError ?? query.error?.message ?? null,
    availableProviders: catalogue?.available_providers ?? emptyProviders,
    selectedProvider,
    defaultProvider: catalogue?.default_provider ?? null,
    userProvider: catalogue?.user_provider ?? null,
    tellerApplicationId: catalogue?.teller_application_id ?? null,
    tellerEnvironment,
    refresh,
    chooseProvider,
  };
}
