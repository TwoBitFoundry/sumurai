import type { ProviderCatalogue } from '@/types/providerCatalog';
import {
  getConnectBlockedReason,
  isPickerEnabled,
  isProviderConnectable,
  isProviderListed,
  resolveConnectProvider,
} from '@/utils/providerCapabilities';

const plaidOnlyCatalogue: ProviderCatalogue = {
  available_providers: ['plaid'],
};

const tellerWithoutAppId: ProviderCatalogue = {
  available_providers: ['plaid', 'teller'],
  user_provider: 'teller',
};

const tellerReadyCatalogue: ProviderCatalogue = {
  ...tellerWithoutAppId,
  teller_application_id: 'app-123',
};

describe('providerCapabilities', () => {
  it('given missing catalogue when checked then plaid and simplefin are connectable', () => {
    expect(isProviderConnectable('plaid', null)).toBe(true);
    expect(isProviderConnectable('simplefin', null)).toBe(true);
    expect(isProviderConnectable('teller', null)).toBe(false);
  });

  it('given provider not in catalogue when checked then is not listed or connectable', () => {
    expect(isProviderListed('teller', plaidOnlyCatalogue)).toBe(false);
    expect(isProviderConnectable('teller', plaidOnlyCatalogue)).toBe(false);
  });

  it('given teller without application id when checked then is listed but not connectable', () => {
    expect(isProviderListed('teller', tellerWithoutAppId)).toBe(true);
    expect(isProviderConnectable('teller', tellerWithoutAppId)).toBe(false);
    expect(isPickerEnabled('teller', tellerWithoutAppId)).toBe(false);
    expect(getConnectBlockedReason('teller', tellerWithoutAppId)).toBe('Missing credentials');
  });

  it('given teller with application id when checked then is connectable', () => {
    expect(isProviderConnectable('teller', tellerReadyCatalogue)).toBe(true);
    expect(getConnectBlockedReason('teller', tellerReadyCatalogue)).toBeNull();
    expect(isPickerEnabled('teller', tellerReadyCatalogue)).toBe(true);
  });

  it('given simplefin missing from catalogue when checked then remains enabled', () => {
    expect(isProviderListed('simplefin', plaidOnlyCatalogue)).toBe(false);
    expect(isPickerEnabled('simplefin', plaidOnlyCatalogue)).toBe(true);
    expect(getConnectBlockedReason('simplefin', plaidOnlyCatalogue)).toBeNull();
  });

  it('given preferred provider is not connectable when resolved then falls back to connectable provider', () => {
    expect(resolveConnectProvider(tellerWithoutAppId, 'teller')).toBe('plaid');
    expect(resolveConnectProvider(tellerReadyCatalogue, 'teller')).toBe('teller');
  });

  it('given providers are fully configured when checked then picker enables all three', () => {
    const fullCatalogue: ProviderCatalogue = {
      available_providers: ['plaid', 'teller', 'simplefin'],
      teller_application_id: 'app-123',
    };

    expect(isPickerEnabled('plaid', fullCatalogue)).toBe(true);
    expect(isPickerEnabled('teller', fullCatalogue)).toBe(true);
    expect(isPickerEnabled('simplefin', fullCatalogue)).toBe(true);
    expect(getConnectBlockedReason('plaid', fullCatalogue)).toBeNull();
    expect(getConnectBlockedReason('teller', fullCatalogue)).toBeNull();
    expect(getConnectBlockedReason('simplefin', fullCatalogue)).toBeNull();
  });

  it('given diy when checked then is always enabled regardless of catalogue', () => {
    expect(isPickerEnabled('diy', null)).toBe(true);
    expect(isPickerEnabled('diy', plaidOnlyCatalogue)).toBe(true);
    expect(getConnectBlockedReason('diy', null)).toBeNull();
    expect(getConnectBlockedReason('diy', plaidOnlyCatalogue)).toBeNull();
  });

  it('given an aggregator is connected when checking a competing aggregator then it is gated', () => {
    const tellerConnected: ProviderCatalogue = {
      available_providers: ['plaid', 'teller', 'simplefin'],
      teller_application_id: 'app-123',
      user_provider: 'teller',
    };

    expect(isPickerEnabled('plaid', tellerConnected)).toBe(false);
    expect(isPickerEnabled('simplefin', tellerConnected)).toBe(false);
    expect(isPickerEnabled('teller', tellerConnected)).toBe(true);
    expect(getConnectBlockedReason('plaid', tellerConnected)).toBe('Disconnect teller first');
    expect(getConnectBlockedReason('simplefin', tellerConnected)).toBe('Disconnect teller first');
    expect(getConnectBlockedReason('teller', tellerConnected)).toBeNull();
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
