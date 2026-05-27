import type { ProviderCatalogState } from '@/hooks/useProviderCatalog';
import type { FinancialProvider } from '@/types/api';
import type { ProviderCatalogue } from '@/types/providerCatalog';
import {
  getConnectBlockedReason,
  isProviderConnectable,
  isProviderListed,
  resolveConnectProvider,
} from '@/utils/providerCapabilities';
import { createMockFunction } from '../mocks/mockHttpClient';

export function makeProviderCatalogMock(
  catalogue: ProviderCatalogue,
  overrides: Partial<ProviderCatalogState> = {}
): ProviderCatalogState {
  return {
    loading: false,
    error: null,
    availableProviders: catalogue.available_providers,
    userProvider: catalogue.user_provider ?? null,
    tellerApplicationId: catalogue.teller_application_id ?? null,
    tellerEnvironment: 'development',
    isProviderAvailable: (provider: FinancialProvider) => isProviderListed(provider, catalogue),
    canConnectWith: (provider: FinancialProvider) => isProviderConnectable(provider, catalogue),
    getConnectBlockedReason: (provider: FinancialProvider) =>
      getConnectBlockedReason(provider, catalogue),
    resolveConnectProvider: (preferred: FinancialProvider) =>
      resolveConnectProvider(catalogue, preferred),
    refresh: createMockFunction(),
    chooseProvider: createMockFunction(),
    ...overrides,
  };
}
