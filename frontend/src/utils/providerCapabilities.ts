/**
 * Derives which providers are listed and ready to connect.
 */

import type { FinancialProvider } from '@/types/api';
import type { ProviderCatalogue } from '@/types/providerCatalog';

export function isProviderListed(
  provider: FinancialProvider,
  catalogue: ProviderCatalogue
): boolean {
  return catalogue.available_providers.includes(provider);
}

export function isProviderConnectable(
  provider: FinancialProvider,
  catalogue: ProviderCatalogue | null
): boolean {
  if (!catalogue) {
    return provider !== 'teller';
  }

  if (!isProviderListed(provider, catalogue)) {
    return false;
  }

  if (provider === 'teller') {
    return Boolean(catalogue.teller_application_id?.trim());
  }

  return true;
}

export function isPickerEnabled(
  provider: FinancialProvider,
  catalogue: ProviderCatalogue | null
): boolean {
  if (provider === 'simplefin') {
    return true;
  }

  return isProviderConnectable(provider, catalogue);
}

export function getConnectBlockedReason(
  provider: FinancialProvider,
  catalogue: ProviderCatalogue | null
): string | null {
  if (provider === 'simplefin') {
    return null;
  }

  if (!catalogue) {
    return provider === 'teller' ? 'Missing credentials' : null;
  }

  if (isProviderConnectable(provider, catalogue)) {
    return null;
  }

  return 'Missing credentials';
}

export function resolveConnectProvider(
  catalogue: ProviderCatalogue | null,
  preferred: FinancialProvider
): FinancialProvider {
  if (!catalogue) {
    return preferred;
  }

  if (isProviderConnectable(preferred, catalogue)) {
    return preferred;
  }

  const fallback = catalogue.available_providers.find((provider) =>
    isProviderConnectable(provider, catalogue)
  );

  return fallback ?? preferred;
}
