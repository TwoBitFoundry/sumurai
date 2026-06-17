import {
  CONNECT_ACCOUNT_PROVIDER_CONTENT,
  PROVIDER_CARD_CONFIG,
  PROVIDER_PRICE_ORDER,
} from '@/utils/providerCards';

describe('providerCards', () => {
  it('PROVIDER_PRICE_ORDER includes all four providers with diy last', () => {
    expect(PROVIDER_PRICE_ORDER).toContain('diy');
    expect(PROVIDER_PRICE_ORDER).toHaveLength(4);
    expect(PROVIDER_PRICE_ORDER[3]).toBe('diy');
  });

  it('PROVIDER_CARD_CONFIG has a diy entry with expected top-level fields', () => {
    expect(PROVIDER_CARD_CONFIG.diy).toBeDefined();
    expect(PROVIDER_CARD_CONFIG.diy.title).toBe('DIY');
    expect(PROVIDER_CARD_CONFIG.diy.badge).toBe('Self-Hosted');
    expect(PROVIDER_CARD_CONFIG.diy.region).toBe('Unlimited');
  });

  it('every provider card has a Sync section', () => {
    for (const provider of PROVIDER_PRICE_ORDER) {
      const config = PROVIDER_CARD_CONFIG[provider];
      const syncSection = config.sections.find((s) => s.label === 'Sync');
      expect(syncSection).toBeDefined();
    }
  });

  it('aggregator Sync sections are marked synced with Automatic value', () => {
    for (const provider of ['teller', 'simplefin', 'plaid'] as const) {
      const syncSection = PROVIDER_CARD_CONFIG[provider].sections.find((s) => s.label === 'Sync');
      expect(syncSection?.synced).toBe(true);
      expect(syncSection?.value).toBe('Automatic');
    }
  });

  it('DIY Sync section is marked not synced with Manual uploads value', () => {
    const syncSection = PROVIDER_CARD_CONFIG.diy.sections.find((s) => s.label === 'Sync');
    expect(syncSection?.synced).toBe(false);
    expect(syncSection?.value).toBe('Manual uploads');
  });

  it('CONNECT_ACCOUNT_PROVIDER_CONTENT includes diy', () => {
    expect(CONNECT_ACCOUNT_PROVIDER_CONTENT.diy).toBeDefined();
    expect(CONNECT_ACCOUNT_PROVIDER_CONTENT.diy.displayName).toBe('DIY');
  });
});
