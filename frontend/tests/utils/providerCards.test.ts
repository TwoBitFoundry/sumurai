import {
  CONNECT_ACCOUNT_PROVIDER_CONTENT,
  PROVIDER_CARD_CONFIG,
  PROVIDER_PRICE_ORDER,
  resolvePickerVisibleProviders,
} from '@/utils/providerCards';

describe('providerCards', () => {
  it('PROVIDER_PRICE_ORDER lists DIY, SimpleFIN, Teller, then Plaid', () => {
    expect(PROVIDER_PRICE_ORDER).toEqual(['diy', 'simplefin', 'teller', 'plaid']);
  });

  it('PROVIDER_CARD_CONFIG has a diy entry with expected top-level fields', () => {
    expect(PROVIDER_CARD_CONFIG.diy).toBeDefined();
    expect(PROVIDER_CARD_CONFIG.diy.title).toBe('Self-Managed');
    expect(PROVIDER_CARD_CONFIG.diy.badge).toBe('DIY');
    expect(PROVIDER_CARD_CONFIG.diy.region).toBe('Any (USD)');
  });

  it('every provider card has a Sync section', () => {
    for (const provider of PROVIDER_PRICE_ORDER) {
      const config = PROVIDER_CARD_CONFIG[provider];
      const syncSection = config.sections.find((s) => s.label === 'Sync');
      expect(syncSection).toBeDefined();
    }
  });

  it('aggregator Sync sections are marked synced with Yes value', () => {
    for (const provider of ['teller', 'simplefin', 'plaid'] as const) {
      const syncSection = PROVIDER_CARD_CONFIG[provider].sections.find((s) => s.label === 'Sync');
      expect(syncSection?.synced).toBe(true);
      expect(syncSection?.value).toBe('Yes');
    }
  });

  it('DIY Sync section is marked not synced with Import value', () => {
    const syncSection = PROVIDER_CARD_CONFIG.diy.sections.find((s) => s.label === 'Sync');
    expect(syncSection?.synced).toBe(false);
    expect(syncSection?.value).toBe('Import');
  });

  it('CONNECT_ACCOUNT_PROVIDER_CONTENT includes diy', () => {
    expect(CONNECT_ACCOUNT_PROVIDER_CONTENT.diy).toBeDefined();
    expect(CONNECT_ACCOUNT_PROVIDER_CONTENT.diy.displayName).toBe('DIY');
  });

  it('resolvePickerVisibleProviders returns all providers when no aggregator is active', () => {
    expect(resolvePickerVisibleProviders(null)).toEqual(PROVIDER_PRICE_ORDER);
  });

  it('resolvePickerVisibleProviders returns diy and the active aggregator only', () => {
    expect(resolvePickerVisibleProviders('teller')).toEqual(['diy', 'teller']);
    expect(resolvePickerVisibleProviders('plaid')).toEqual(['diy', 'plaid']);
    expect(resolvePickerVisibleProviders('simplefin')).toEqual(['diy', 'simplefin']);
  });
});
