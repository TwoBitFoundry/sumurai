import type { FinancialProvider } from '@/types/api';
import { PROVIDER_PRICE_ORDER } from '@/utils/providerCards';

export const STORY_AGGREGATOR_PROVIDERS = ['plaid', 'simplefin'] as FinancialProvider[];

export const STORY_ALL_PROVIDERS = ['diy', ...STORY_AGGREGATOR_PROVIDERS] as FinancialProvider[];

export const STORY_PROVIDER_PICKER_CONNECT_ORDER = [...PROVIDER_PRICE_ORDER] as FinancialProvider[];

export const STORY_PICKER_LINK_BUTTON = /^link account$/i;

export function storyProviderLogoLabel(provider: FinancialProvider): string {
  if (provider === 'simplefin') {
    return 'SimpleFIN';
  }
  if (provider === 'diy') {
    return 'Self-Managed';
  }
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function storyConnectButtonIndex(provider: FinancialProvider): number {
  return STORY_PROVIDER_PICKER_CONNECT_ORDER.indexOf(provider);
}

export const storyFullProviderCatalogInfo = {
  available_providers: STORY_ALL_PROVIDERS,
  user_provider: null,
};

export const storyProviderPickerPanelProps = {
  loading: false,
  error: null as string | null,
  availableProviders: STORY_ALL_PROVIDERS,
  connectingProvider: null as FinancialProvider | null,
};
