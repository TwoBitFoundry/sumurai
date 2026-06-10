import {
  FIXED_EXPENSE_CADENCE_LABELS,
  FIXED_EXPENSE_CADENCE_ORDER,
  groupFixedExpensesByCadence,
  normalizeFixedExpenseCadence,
} from '@/domain/fixedExpenseCadences';

describe('fixedExpenseCadences', () => {
  it('normalizes cadence strings from the API', () => {
    expect(normalizeFixedExpenseCadence('Monthly')).toBe('monthly');
    expect(normalizeFixedExpenseCadence('quarterly')).toBe('quarterly');
    expect(normalizeFixedExpenseCadence('yearly')).toBe('annual');
    expect(normalizeFixedExpenseCadence('Biweekly')).toBe('biweekly');
    expect(normalizeFixedExpenseCadence('bi-weekly')).toBe('biweekly');
    expect(normalizeFixedExpenseCadence('bi_weekly')).toBe('biweekly');
    expect(normalizeFixedExpenseCadence('unknown')).toBeNull();
  });

  it('exposes all cadence categories in display order including biweekly', () => {
    expect(FIXED_EXPENSE_CADENCE_ORDER).toEqual(['biweekly', 'monthly', 'quarterly', 'annual']);
    expect(FIXED_EXPENSE_CADENCE_LABELS.biweekly).toBe('Biweekly');
    expect(FIXED_EXPENSE_CADENCE_LABELS.annual).toBe('Yearly');
  });

  it('groups items by cadence with monthly as the fallback for unknown cadences', () => {
    const grouped = groupFixedExpensesByCadence([
      { cadence: 'monthly', merchant: 'Spotify', first_charged: '2026-05-01' },
      { cadence: 'Quarterly', merchant: 'Adobe', first_charged: '2026-05-01' },
      { cadence: 'unknown', merchant: 'Other', first_charged: '2026-05-01' },
    ]);

    expect(grouped.monthly.map((item) => item.merchant)).toEqual(['Other', 'Spotify']);
    expect(grouped.quarterly.map((item) => item.merchant)).toEqual(['Adobe']);
    expect(grouped.annual).toEqual([]);
    expect(grouped.biweekly).toEqual([]);
  });

  it('places biweekly items into the biweekly group', () => {
    const grouped = groupFixedExpensesByCadence([
      { cadence: 'biweekly', merchant: 'Gym', first_charged: '2026-05-01' },
      { cadence: 'monthly', merchant: 'Spotify', first_charged: '2026-05-01' },
    ]);

    expect(grouped.biweekly.map((item) => item.merchant)).toEqual(['Gym']);
    expect(grouped.monthly.map((item) => item.merchant)).toEqual(['Spotify']);
  });

  it('omits cadence groups that have no items when filtered externally', () => {
    const grouped = groupFixedExpensesByCadence([
      { cadence: 'monthly', merchant: 'Spotify', first_charged: '2026-05-01' },
    ]);

    expect(grouped.biweekly).toEqual([]);
    expect(grouped.quarterly).toEqual([]);
    expect(grouped.annual).toEqual([]);
  });

  it('sorts items within a cadence by since date then merchant name', () => {
    const grouped = groupFixedExpensesByCadence([
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
