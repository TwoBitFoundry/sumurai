/**
 * Types for provider catalogue API responses.
 */

import type { FinancialProvider } from '@/types/api';

export interface ProviderCatalogue {
  available_providers: FinancialProvider[];
  user_provider?: FinancialProvider | null;
}

export interface ProviderSelectionResult {
  user_provider: FinancialProvider;
}
