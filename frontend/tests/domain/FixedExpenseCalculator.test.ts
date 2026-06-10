import {
  computeFixedExpenseMonthCost,
  computeFixedExpenseYtdCost,
  FixedExpenseCalculator,
  resolveYtdReferenceDate,
} from '../../src/domain/FixedExpenseCalculator';
import type { FixedExpenseSummary } from '../../src/types/api';

const makeSummary = (
  overrides: Partial<FixedExpenseSummary> & Pick<FixedExpenseSummary, 'merchant' | 'monthly_cost'>
): FixedExpenseSummary => ({
  normalized_merchant: overrides.merchant.toLowerCase(),
  cadence: 'monthly',
  category: 'subscription',
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

describe('computeFixedExpenseMonthCost', () => {
  const today = new Date(2026, 5, 7);

  it('sums charges that occurred in the selected month', () => {
    const summary = makeSummary({
      merchant: 'Spotify',
      monthly_cost: '9.99',
      first_charged: '2026-01-15',
      last_charged: '2026-05-15',
      occurrence_count: 5,
    });

    expect(computeFixedExpenseMonthCost(summary, new Date(2026, 4, 1), today)).toBeCloseTo(9.99);
    expect(computeFixedExpenseMonthCost(summary, new Date(2026, 5, 1), today)).toBeCloseTo(0);
  });

  it('uses the quarterly charge amount when a quarterly item bills that month', () => {
    const summary = makeSummary({
      merchant: 'Adobe',
      monthly_cost: '10.00',
      cadence: 'quarterly',
      first_charged: '2026-03-01',
      last_charged: '2026-03-01',
      occurrence_count: 1,
    });

    expect(computeFixedExpenseMonthCost(summary, new Date(2026, 2, 1), today)).toBeCloseTo(30);
    expect(computeFixedExpenseMonthCost(summary, new Date(2026, 3, 1), today)).toBeCloseTo(0);
  });

  it('works for bill items (category = bill) the same as subscriptions', () => {
    const summary = makeSummary({
      merchant: 'Comcast',
      monthly_cost: '79.99',
      category: 'bill',
      first_charged: '2026-01-05',
      last_charged: '2026-05-05',
      occurrence_count: 5,
    });

    expect(computeFixedExpenseMonthCost(summary, new Date(2026, 4, 1), today)).toBeCloseTo(79.99);
  });
});

describe('computeFixedExpenseYtdCost', () => {
  const referenceDate = new Date(2026, 5, 7);

  it('sums monthly charges that occurred in the current calendar year through the reference date', () => {
    const summary = makeSummary({
      merchant: 'Spotify',
      monthly_cost: '9.99',
      first_charged: '2026-01-15',
      last_charged: '2026-05-15',
      occurrence_count: 5,
    });

    expect(computeFixedExpenseYtdCost(summary, referenceDate)).toBeCloseTo(9.99 * 5);
  });

  it('excludes charges before the current calendar year', () => {
    const summary = makeSummary({
      merchant: 'Spotify',
      monthly_cost: '9.99',
      first_charged: '2025-11-15',
      last_charged: '2026-02-15',
      occurrence_count: 4,
    });

    expect(computeFixedExpenseYtdCost(summary, referenceDate)).toBeCloseTo(9.99 * 2);
  });

  it('uses the annual charge amount for yearly items', () => {
    const summary = makeSummary({
      merchant: 'Domain',
      monthly_cost: '10.00',
      cadence: 'annual',
      first_charged: '2026-02-01',
      last_charged: '2026-02-01',
      occurrence_count: 1,
    });

    expect(computeFixedExpenseYtdCost(summary, referenceDate)).toBeCloseTo(120);
  });

  it('accumulates ytd across mixed subscription and bill items', () => {
    const sub = makeSummary({
      merchant: 'Spotify',
      monthly_cost: '9.99',
      category: 'subscription',
      first_charged: '2026-01-15',
      last_charged: '2026-05-15',
      occurrence_count: 5,
    });
    const bill = makeSummary({
      merchant: 'Comcast',
      monthly_cost: '79.99',
      category: 'bill',
      first_charged: '2026-01-05',
      last_charged: '2026-05-05',
      occurrence_count: 5,
    });

    const { yearToDate } = FixedExpenseCalculator.computeFixedExpenseHeroStats(
      [sub, bill],
      new Date(2026, 4, 1),
      referenceDate
    );
    expect(yearToDate).toBeCloseTo(9.99 * 5 + 79.99 * 5);
  });
});

describe('FixedExpenseCalculator.computeFixedExpenseHeroStats', () => {
  const today = new Date(2026, 5, 7);

  const twoActiveItems = [
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
      FixedExpenseCalculator.computeFixedExpenseHeroStats([], new Date(2026, 4, 1), today)
    ).toEqual({ monthlyTotal: 0, yearToDate: 0 });
  });

  it('only counts charges that occurred in the selected month', () => {
    expect(
      FixedExpenseCalculator.computeFixedExpenseHeroStats(
        twoActiveItems,
        new Date(2026, 4, 1),
        today
      )
    ).toEqual({ monthlyTotal: 25.98, yearToDate: 9.99 * 5 + 15.99 * 4 });
  });

  it('excludes items not charged in the selected month from monthlyTotal', () => {
    const result = FixedExpenseCalculator.computeFixedExpenseHeroStats(
      twoActiveItems,
      new Date(2026, 5, 1),
      today
    );
    expect(result.monthlyTotal).toBe(0);
    expect(result.yearToDate).toBeCloseTo(9.99 * 5 + 15.99 * 4);
  });

  it('caps year-to-date at end of a past month', () => {
    const result = FixedExpenseCalculator.computeFixedExpenseHeroStats(
      twoActiveItems,
      new Date(2026, 2, 1),
      today
    );
    expect(result.monthlyTotal).toBeCloseTo(25.98);
    expect(result.yearToDate).toBeCloseTo(9.99 * 3 + 15.99 * 2);
  });
});
