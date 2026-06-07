import {
  computeSubscriptionMonthCost,
  computeSubscriptionYtdCost,
  resolveYtdReferenceDate,
  SubscriptionCalculator,
} from '../../src/domain/SubscriptionCalculator';
import type { SubscriptionSummary } from '../../src/types/api';

const makeSummary = (
  overrides: Partial<SubscriptionSummary> & Pick<SubscriptionSummary, 'merchant' | 'monthly_cost'>
): SubscriptionSummary => ({
  normalized_merchant: overrides.merchant.toLowerCase(),
  cadence: 'monthly',
  first_charged: '2024-03-01',
  last_charged: '2024-03-01',
  occurrence_count: 3,
  account_ids: [],
  ...overrides,
});

describe('resolveYtdReferenceDate', () => {
  const today = new Date(2026, 5, 7);

  it('uses today while viewing the current month', () => {
    expect(resolveYtdReferenceDate(new Date(2026, 5, 1), today)).toEqual(new Date(2026, 5, 7));
  });

  it('uses the end of a past month', () => {
    expect(resolveYtdReferenceDate(new Date(2026, 2, 1), today)).toEqual(new Date(2026, 2, 31));
  });
});

describe('computeSubscriptionMonthCost', () => {
  const today = new Date(2026, 5, 7);

  it('sums charges that occurred in the selected month', () => {
    const summary = makeSummary({
      merchant: 'Spotify',
      monthly_cost: '9.99',
      first_charged: '2026-01-15',
      last_charged: '2026-05-15',
      occurrence_count: 5,
    });

    expect(computeSubscriptionMonthCost(summary, new Date(2026, 4, 1), today)).toBeCloseTo(9.99);
    expect(computeSubscriptionMonthCost(summary, new Date(2026, 5, 1), today)).toBeCloseTo(0);
  });

  it('uses the quarterly charge amount when a quarterly subscription bills that month', () => {
    const summary = makeSummary({
      merchant: 'Adobe',
      monthly_cost: '10.00',
      cadence: 'quarterly',
      first_charged: '2026-03-01',
      last_charged: '2026-03-01',
      occurrence_count: 1,
    });

    expect(computeSubscriptionMonthCost(summary, new Date(2026, 2, 1), today)).toBeCloseTo(30);
    expect(computeSubscriptionMonthCost(summary, new Date(2026, 3, 1), today)).toBeCloseTo(0);
  });
});

describe('computeSubscriptionYtdCost', () => {
  const referenceDate = new Date(2026, 5, 7);

  it('sums monthly charges that occurred in the current calendar year through the reference date', () => {
    const summary = makeSummary({
      merchant: 'Spotify',
      monthly_cost: '9.99',
      first_charged: '2026-01-15',
      last_charged: '2026-05-15',
      occurrence_count: 5,
    });

    expect(computeSubscriptionYtdCost(summary, referenceDate)).toBeCloseTo(9.99 * 5);
  });

  it('excludes charges before the current calendar year', () => {
    const summary = makeSummary({
      merchant: 'Spotify',
      monthly_cost: '9.99',
      first_charged: '2025-11-15',
      last_charged: '2026-02-15',
      occurrence_count: 4,
    });

    expect(computeSubscriptionYtdCost(summary, referenceDate)).toBeCloseTo(9.99 * 2);
  });

  it('uses the annual charge amount for yearly subscriptions', () => {
    const summary = makeSummary({
      merchant: 'Domain',
      monthly_cost: '10.00',
      cadence: 'annual',
      first_charged: '2026-02-01',
      last_charged: '2026-02-01',
      occurrence_count: 1,
    });

    expect(computeSubscriptionYtdCost(summary, referenceDate)).toBeCloseTo(120);
  });
});

describe('SubscriptionCalculator.computeSubscriptionHeroStats', () => {
  const today = new Date(2026, 5, 7);

  const twoActiveSubs = [
    makeSummary({
      merchant: 'Spotify',
      monthly_cost: '9.99',
      first_charged: '2026-01-15',
      last_charged: '2026-05-15',
      occurrence_count: 5,
    }),
    makeSummary({
      merchant: 'Netflix',
      monthly_cost: '15.99',
      first_charged: '2026-02-15',
      last_charged: '2026-05-15',
      occurrence_count: 4,
    }),
  ];

  it('returns zero totals for empty summaries', () => {
    expect(
      SubscriptionCalculator.computeSubscriptionHeroStats([], new Date(2026, 4, 1), today)
    ).toEqual({ monthlyTotal: 0, yearToDate: 0 });
  });

  it('only counts subscription charges that occurred in the selected month', () => {
    expect(
      SubscriptionCalculator.computeSubscriptionHeroStats(
        twoActiveSubs,
        new Date(2026, 4, 1),
        today
      )
    ).toEqual({ monthlyTotal: 25.98, yearToDate: 9.99 * 5 + 15.99 * 4 });
  });

  it('excludes subscriptions not charged in the selected month from monthlyTotal', () => {
    const result = SubscriptionCalculator.computeSubscriptionHeroStats(
      twoActiveSubs,
      new Date(2026, 5, 1),
      today
    );
    expect(result.monthlyTotal).toBe(0);
    expect(result.yearToDate).toBeCloseTo(9.99 * 5 + 15.99 * 4);
  });

  it('caps year-to-date at end of a past month', () => {
    const result = SubscriptionCalculator.computeSubscriptionHeroStats(
      twoActiveSubs,
      new Date(2026, 2, 1),
      today
    );
    expect(result.monthlyTotal).toBeCloseTo(25.98);
    expect(result.yearToDate).toBeCloseTo(9.99 * 3 + 15.99 * 2);
  });
});
