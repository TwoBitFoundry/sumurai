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

const tellerLegacyCatalogue: ProviderCatalogue = {
  available_providers: ['plaid', 'simplefin'],
  user_provider: 'teller',
};

const fullCatalogue: ProviderCatalogue = {
  available_providers: ['plaid', 'simplefin', 'diy'],
};

describe('providerCapabilities', () => {
  it('given missing catalogue when checked then no provider is connectable', () => {
    expect(isProviderConnectable('plaid', null)).toBe(false);
    expect(isProviderConnectable('simplefin', null)).toBe(false);
    expect(isProviderConnectable('teller', null)).toBe(false);
    expect(isProviderConnectable('diy', null)).toBe(false);
  });

  it('given provider not in catalogue when checked then is not listed or connectable', () => {
    expect(isProviderListed('teller', plaidOnlyCatalogue)).toBe(false);
    expect(isProviderConnectable('teller', plaidOnlyCatalogue)).toBe(false);
  });

  it('given teller when checked then is never connectable or picker-enabled', () => {
    expect(isProviderConnectable('teller', tellerLegacyCatalogue)).toBe(false);
    expect(isPickerEnabled('teller', tellerLegacyCatalogue)).toBe(false);
    expect(getConnectBlockedReason('teller', tellerLegacyCatalogue)).toBe(
      'Teller is no longer supported'
    );
  });

  it('given simplefin missing from catalogue when checked then remains enabled', () => {
    expect(isProviderListed('simplefin', plaidOnlyCatalogue)).toBe(false);
    expect(isPickerEnabled('simplefin', plaidOnlyCatalogue)).toBe(true);
    expect(getConnectBlockedReason('simplefin', plaidOnlyCatalogue)).toBeNull();
  });

  it('given preferred provider is teller when resolved then falls back to connectable provider', () => {
    expect(resolveConnectProvider(tellerLegacyCatalogue, 'teller')).toBe('plaid');
    expect(resolveConnectProvider(fullCatalogue, 'teller')).toBe('plaid');
  });

  it('given providers are fully configured when checked then picker enables connectable providers', () => {
    expect(isPickerEnabled('plaid', fullCatalogue)).toBe(true);
    expect(isPickerEnabled('teller', fullCatalogue)).toBe(false);
    expect(isPickerEnabled('simplefin', fullCatalogue)).toBe(true);
    expect(getConnectBlockedReason('plaid', fullCatalogue)).toBeNull();
    expect(getConnectBlockedReason('teller', fullCatalogue)).toBe('Teller is no longer supported');
    expect(getConnectBlockedReason('simplefin', fullCatalogue)).toBeNull();
  });

  it('given diy when checked then is always enabled regardless of catalogue', () => {
    expect(isPickerEnabled('diy', null)).toBe(true);
    expect(isPickerEnabled('diy', plaidOnlyCatalogue)).toBe(true);
    expect(getConnectBlockedReason('diy', null)).toBeNull();
    expect(getConnectBlockedReason('diy', plaidOnlyCatalogue)).toBeNull();
  });

  it('given teller connections remain when checking plaid then plaid stays gated', () => {
    expect(isPickerEnabled('plaid', tellerLegacyCatalogue)).toBe(false);
    expect(isPickerEnabled('simplefin', tellerLegacyCatalogue)).toBe(true);
    expect(isPickerEnabled('teller', tellerLegacyCatalogue)).toBe(false);
    expect(getConnectBlockedReason('plaid', tellerLegacyCatalogue)).toBe('Disconnect teller first');
    expect(getConnectBlockedReason('simplefin', tellerLegacyCatalogue)).toBeNull();
  });

  it('given plaid without credentials when checked then credentials are unavailable', () => {
    expect(isCredentialsEnvUnavailable('teller', tellerLegacyCatalogue)).toBe(false);
    expect(isCredentialsEnvUnavailable('plaid', { available_providers: ['simplefin'] })).toBe(true);
    expect(isCredentialsEnvUnavailable('simplefin', tellerLegacyCatalogue)).toBe(false);
    expect(isCredentialsEnvUnavailable('diy', tellerLegacyCatalogue)).toBe(false);
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
