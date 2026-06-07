import {
  groupSubscriptionsByCadence,
  normalizeSubscriptionCadence,
  SUBSCRIPTION_CADENCE_LABELS,
  SUBSCRIPTION_CADENCE_ORDER,
} from '@/domain/subscriptionCadences';

describe('subscriptionCadences', () => {
  it('normalizes cadence strings from the API', () => {
    expect(normalizeSubscriptionCadence('Monthly')).toBe('monthly');
    expect(normalizeSubscriptionCadence('quarterly')).toBe('quarterly');
    expect(normalizeSubscriptionCadence('yearly')).toBe('annual');
    expect(normalizeSubscriptionCadence('unknown')).toBeNull();
  });

  it('exposes all cadence categories in display order', () => {
    expect(SUBSCRIPTION_CADENCE_ORDER).toEqual(['monthly', 'quarterly', 'annual']);
    expect(SUBSCRIPTION_CADENCE_LABELS.annual).toBe('Yearly');
  });

  it('groups subscriptions by cadence with monthly as the fallback', () => {
    const grouped = groupSubscriptionsByCadence([
      { cadence: 'monthly', merchant: 'Spotify', first_charged: '2026-05-01' },
      { cadence: 'Quarterly', merchant: 'Adobe', first_charged: '2026-05-01' },
      { cadence: 'unknown', merchant: 'Other', first_charged: '2026-05-01' },
      { cadence: 'weekly', merchant: 'Gym', first_charged: '2026-05-01' },
    ]);

    expect(grouped.monthly.map((item) => item.merchant)).toEqual(['Gym', 'Other', 'Spotify']);
    expect(grouped.quarterly.map((item) => item.merchant)).toEqual(['Adobe']);
    expect(grouped.annual).toEqual([]);
  });

  it('sorts subscriptions within a cadence by since date then merchant name', () => {
    const grouped = groupSubscriptionsByCadence([
      { cadence: 'monthly', merchant: 'Walmart', first_charged: '2026-06-01' },
      { cadence: 'monthly', merchant: 'Costco', first_charged: '2026-06-01' },
      { cadence: 'monthly', merchant: 'Pdxfit Gym', first_charged: '2026-05-15' },
      { cadence: 'monthly', merchant: 'Netflix', first_charged: '2026-06-01' },
    ]);

    expect(grouped.monthly.map((item) => item.merchant)).toEqual([
      'Pdxfit Gym',
      'Costco',
      'Netflix',
      'Walmart',
    ]);
  });
});
