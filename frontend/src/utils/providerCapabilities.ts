/**
 * Derives which providers are listed and ready to connect.
 */

import type { FinancialProvider } from '@/types/api';
import type { ProviderCatalogue } from '@/types/providerCatalog';
import { CONNECT_ACCOUNT_PROVIDER_CONTENT } from '@/utils/providerCards';

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
    return provider === 'plaid';
  }

  if (!isProviderListed(provider, catalogue)) {
    return false;
  }

  if (provider === 'teller') {
    return Boolean(catalogue.teller_application_id?.trim());
  }

  return true;
}

export function getConnectBlockedReason(
  provider: FinancialProvider,
  catalogue: ProviderCatalogue | null
): string | null {
  if (!catalogue) {
    return null;
  }

  if (!isProviderListed(provider, catalogue)) {
    if (provider === 'simplefin') {
      return 'SimpleFIN is not enabled for this deployment.';
    }

    return `${CONNECT_ACCOUNT_PROVIDER_CONTENT[provider].displayName} is not enabled for this deployment.`;
  }

  if (provider === 'teller' && !catalogue.teller_application_id?.trim()) {
    return (
      CONNECT_ACCOUNT_PROVIDER_CONTENT.teller.applicationIdMissingCopy ??
      'Add your Teller application ID in provider settings to continue.'
    );
  }

  return null;
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
