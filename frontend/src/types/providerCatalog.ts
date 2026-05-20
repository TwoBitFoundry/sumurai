/**
 * Types for provider catalogue API responses.
 */

import type { FinancialProvider } from '@/types/api';

export interface ProviderCatalogue {
  available_providers: FinancialProvider[];
  default_provider: FinancialProvider;
  user_provider?: FinancialProvider;
  teller_application_id?: string;
  teller_environment?: string;
}

export interface ProviderSelectionResult {
  user_provider: FinancialProvider;
}
