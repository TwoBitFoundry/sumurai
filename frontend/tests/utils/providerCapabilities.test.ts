import type { ProviderCatalogue } from '@/types/providerCatalog';
import {
  getConnectBlockedReason,
  isProviderConnectable,
  isProviderListed,
  resolveConnectProvider,
} from '@/utils/providerCapabilities';

const plaidOnlyCatalogue: ProviderCatalogue = {
  available_providers: ['plaid'],
  default_provider: 'plaid',
};

const tellerWithoutAppId: ProviderCatalogue = {
  available_providers: ['plaid', 'teller'],
  default_provider: 'teller',
  user_provider: 'teller',
};

const tellerReadyCatalogue: ProviderCatalogue = {
  ...tellerWithoutAppId,
  teller_application_id: 'app-123',
};

describe('providerCapabilities', () => {
  it('given missing catalogue when checked then plaid is connectable and teller is not', () => {
    expect(isProviderConnectable('plaid', null)).toBe(true);
    expect(isProviderConnectable('teller', null)).toBe(false);
  });

  it('given provider not in catalogue when checked then is not listed or connectable', () => {
    expect(isProviderListed('teller', plaidOnlyCatalogue)).toBe(false);
    expect(isProviderConnectable('teller', plaidOnlyCatalogue)).toBe(false);
  });

  it('given teller without application id when checked then is listed but not connectable', () => {
    expect(isProviderListed('teller', tellerWithoutAppId)).toBe(true);
    expect(isProviderConnectable('teller', tellerWithoutAppId)).toBe(false);
    expect(getConnectBlockedReason('teller', tellerWithoutAppId)).toContain(
      'Teller application ID'
    );
  });

  it('given teller with application id when checked then is connectable', () => {
    expect(isProviderConnectable('teller', tellerReadyCatalogue)).toBe(true);
    expect(getConnectBlockedReason('teller', tellerReadyCatalogue)).toBeNull();
  });

  it('given preferred provider is not connectable when resolved then falls back to connectable provider', () => {
    expect(resolveConnectProvider(tellerWithoutAppId, 'teller')).toBe('plaid');
    expect(resolveConnectProvider(tellerReadyCatalogue, 'teller')).toBe('teller');
  });
});
