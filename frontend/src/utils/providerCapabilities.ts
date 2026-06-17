import type { FinancialProvider } from '@/types/api';
import type { ProviderCatalogue } from '@/types/providerCatalog';

const AGGREGATORS: ReadonlySet<FinancialProvider> = new Set(['plaid', 'teller', 'simplefin']);

function isAggregator(provider: FinancialProvider): boolean {
  return AGGREGATORS.has(provider);
}

function getConnectedAggregator(catalogue: ProviderCatalogue | null): FinancialProvider | null {
  if (!catalogue?.user_provider) return null;
  return isAggregator(catalogue.user_provider) ? catalogue.user_provider : null;
}

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

  if (provider !== 'diy' && !isProviderListed(provider, catalogue)) {
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
  if (provider === 'diy') {
    return true;
  }

  const connectedAggregator = getConnectedAggregator(catalogue);
  if (connectedAggregator && isAggregator(provider) && connectedAggregator !== provider) {
    return false;
  }

  if (provider === 'simplefin') {
    return true;
  }

  return isProviderConnectable(provider, catalogue);
}

export function getConnectBlockedReason(
  provider: FinancialProvider,
  catalogue: ProviderCatalogue | null
): string | null {
  if (provider === 'diy') {
    return null;
  }

  const connectedAggregator = getConnectedAggregator(catalogue);
  if (connectedAggregator && isAggregator(provider) && connectedAggregator !== provider) {
    return `Disconnect ${connectedAggregator} first`;
  }

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
