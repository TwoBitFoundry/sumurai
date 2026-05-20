/**
 * Backward-compatible alias for the provider catalogue hook.
 */

export {
  type ProviderCatalogGateway as TellerProviderGateway,
  type ProviderCatalogState as TellerProviderInfoState,
  type UseProviderCatalogOptions as UseTellerProviderInfoOptions,
  useProviderCatalog as useTellerProviderInfo,
} from '@/hooks/useProviderCatalog';
export type {
  ProviderCatalogue as TellerProviderCatalogue,
  ProviderSelectionResult as TellerProviderSelectionResult,
} from '@/types/providerCatalog';
