import type { FinancialProvider } from '@/types/api';

export function inferBankProvider(
  connectionId: string | null,
  providerByConnectionId: ReadonlyMap<string, FinancialProvider>,
  defaultProvider: FinancialProvider
): FinancialProvider {
  if (connectionId != null) {
    const provider = providerByConnectionId.get(connectionId);
    if (provider) {
      return provider;
    }
  }

  return defaultProvider;
}
