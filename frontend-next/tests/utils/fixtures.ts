import type { ProviderConnectionStatus, ProviderStatusResponse } from '@/types/api';

export const createProviderConnection = (
  overrides: Partial<ProviderConnectionStatus> = {}
): ProviderConnectionStatus => ({
  is_connected: false,
  last_sync_at: null,
  institution_name: null,
  connection_id: null,
  transaction_count: 0,
  account_count: 0,
  sync_in_progress: false,
  ...overrides,
});

export const createProviderStatus = (
  overrides: Partial<ProviderStatusResponse> = {}
): ProviderStatusResponse => ({
  provider: 'plaid',
  connections: [],
  ...overrides,
});
