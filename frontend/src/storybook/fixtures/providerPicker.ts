import type { FinancialProvider } from '@/types/api';

export const STORY_TELLER_APPLICATION_ID = 'story-teller-app';

export const STORY_ALL_PROVIDERS = ['plaid', 'teller', 'simplefin'] as FinancialProvider[];

export const STORY_PROVIDER_PICKER_CONNECT_ORDER = [
  'teller',
  'simplefin',
  'plaid',
] as FinancialProvider[];

export function storyConnectButtonIndex(provider: FinancialProvider): number {
  return STORY_PROVIDER_PICKER_CONNECT_ORDER.indexOf(provider);
}

export const storyFullProviderCatalogInfo = {
  available_providers: STORY_ALL_PROVIDERS,
  user_provider: null,
  teller_application_id: STORY_TELLER_APPLICATION_ID,
  teller_environment: 'sandbox',
};

export const storyProviderPickerPanelProps = {
  loading: false,
  error: null as string | null,
  availableProviders: STORY_ALL_PROVIDERS,
  tellerApplicationId: STORY_TELLER_APPLICATION_ID,
  connectingProvider: null as FinancialProvider | null,
};
