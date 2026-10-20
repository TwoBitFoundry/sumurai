import type { ProviderCatalogue } from '@/types/providerCatalog';
import {
  getConnectBlockedReason,
  isCredentialsEnvUnavailable,
  isPickerEnabled,
  isProviderConnectable,
  isProviderListed,
  resolveConnectProvider,
} from '@/utils/providerCapabilities';

const plaidOnlyCatalogue: ProviderCatalogue = {
  available_providers: ['plaid'],
};

const simpleFinConnectedCatalogue: ProviderCatalogue = {
  available_providers: ['plaid', 'simplefin'],
  user_provider: 'simplefin',
};

const fullCatalogue: ProviderCatalogue = {
  available_providers: ['plaid', 'simplefin', 'diy'],
};

describe('providerCapabilities', () => {
  it('given missing catalogue when checked then no provider is connectable', () => {
    expect(isProviderConnectable('plaid', null)).toBe(false);
    expect(isProviderConnectable('simplefin', null)).toBe(false);
    expect(isProviderConnectable('diy', null)).toBe(false);
  });

  it('given provider not in catalogue when checked then is not listed or connectable', () => {
    expect(isProviderListed('plaid', { available_providers: ['simplefin'] })).toBe(false);
    expect(isProviderConnectable('plaid', { available_providers: ['simplefin'] })).toBe(false);
  });

  it('given simplefin missing from catalogue when checked then remains enabled', () => {
    expect(isProviderListed('simplefin', plaidOnlyCatalogue)).toBe(false);
    expect(isPickerEnabled('simplefin', plaidOnlyCatalogue)).toBe(true);
    expect(getConnectBlockedReason('simplefin', plaidOnlyCatalogue)).toBeNull();
  });

  it('given preferred provider is not connectable when resolved then falls back to connectable provider', () => {
    expect(resolveConnectProvider(plaidOnlyCatalogue, 'simplefin')).toBe('plaid');
    expect(resolveConnectProvider(fullCatalogue, 'simplefin')).toBe('simplefin');
    expect(resolveConnectProvider(null, 'simplefin')).toBe('simplefin');
  });

  it('given providers are fully configured when checked then picker enables connectable providers', () => {
    expect(isPickerEnabled('plaid', fullCatalogue)).toBe(true);
    expect(isPickerEnabled('simplefin', fullCatalogue)).toBe(true);
    expect(getConnectBlockedReason('plaid', fullCatalogue)).toBeNull();
    expect(getConnectBlockedReason('simplefin', fullCatalogue)).toBeNull();
  });

  it('given diy when checked then is always enabled regardless of catalogue', () => {
    expect(isPickerEnabled('diy', null)).toBe(true);
    expect(isPickerEnabled('diy', plaidOnlyCatalogue)).toBe(true);
    expect(getConnectBlockedReason('diy', null)).toBeNull();
    expect(getConnectBlockedReason('diy', plaidOnlyCatalogue)).toBeNull();
  });

  it('given simplefin connected when checking plaid then plaid stays gated', () => {
    expect(isPickerEnabled('plaid', simpleFinConnectedCatalogue)).toBe(false);
    expect(isPickerEnabled('simplefin', simpleFinConnectedCatalogue)).toBe(true);
    expect(getConnectBlockedReason('plaid', simpleFinConnectedCatalogue)).toBe(
      'Disconnect simplefin first'
    );
    expect(getConnectBlockedReason('simplefin', simpleFinConnectedCatalogue)).toBeNull();
  });

  it('given plaid without credentials when checked then credentials are unavailable', () => {
    expect(isCredentialsEnvUnavailable('plaid', { available_providers: ['simplefin'] })).toBe(true);
    expect(isCredentialsEnvUnavailable('simplefin', simpleFinConnectedCatalogue)).toBe(false);
    expect(isCredentialsEnvUnavailable('diy', simpleFinConnectedCatalogue)).toBe(false);
  });

  it('given an aggregator is connected when checking diy then diy stays enabled', () => {
    const plaidConnected: ProviderCatalogue = {
      available_providers: ['plaid', 'simplefin'],
      user_provider: 'plaid',
    };

    expect(isPickerEnabled('diy', plaidConnected)).toBe(true);
    expect(getConnectBlockedReason('diy', plaidConnected)).toBeNull();
  });
});
