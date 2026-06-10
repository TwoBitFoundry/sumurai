import {
  computeFixedExpenseMonthCost,
  computeFixedExpenseYtdCost,
  FixedExpenseCalculator,
  formatFixedExpenseDueDatesInMonth,
  hasFixedExpenseChargeInMonth,
  listFixedExpenseDueDatesInMonth,
  resolveFixedExpenseMonthState,
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

describe('hasFixedExpenseChargeInMonth', () => {
  it('includes items when a transaction occurred in the selected month', () => {
    const summary = makeSummary({
      merchant: 'Spotify',
      monthly_cost: '9.99',
      first_charged: '2026-01-15',
      last_charged: '2026-05-15',
      occurrence_count: 5,
    });

    expect(hasFixedExpenseChargeInMonth(summary, new Date(2026, 4, 1))).toBe(true);
    expect(hasFixedExpenseChargeInMonth(summary, new Date(2026, 3, 1))).toBe(true);
  });

  it('includes items due later in the selected month before the charge posts', () => {
    const summary = makeSummary({
      merchant: 'Netflix',
      monthly_cost: '15.99',
      first_charged: '2026-01-15',
      last_charged: '2026-05-15',
      occurrence_count: 5,
    });

    expect(hasFixedExpenseChargeInMonth(summary, new Date(2026, 5, 1))).toBe(true);
  });

  it('excludes items with no charge or due date in the selected month', () => {
    const summary = makeSummary({
      merchant: 'Adobe',
      monthly_cost: '10.00',
      cadence: 'quarterly',
      first_charged: '2026-03-01',
      last_charged: '2026-03-01',
      occurrence_count: 1,
    });

    expect(hasFixedExpenseChargeInMonth(summary, new Date(2026, 3, 1))).toBe(false);
    expect(hasFixedExpenseChargeInMonth(summary, new Date(2026, 2, 1))).toBe(true);
  });
});

describe('formatFixedExpenseDueDatesInMonth', () => {
  const june2026 = new Date(2026, 5, 1);

  it('lists each weekly due date in the selected month', () => {
    const summary = makeSummary({
      merchant: 'CenturyLink',
      monthly_cost: '50.00',
      cadence: 'weekly',
      first_charged: '2026-06-02',
      last_charged: '2026-06-18',
      occurrence_count: 3,
    });

    expect(formatFixedExpenseDueDatesInMonth(summary, june2026)).toBe('Jun 2, 9, 16, 23, 30');
  });

  it('lists each biweekly due date in the selected month', () => {
    const summary = makeSummary({
      merchant: 'Gym',
      monthly_cost: '40.00',
      cadence: 'biweekly',
      first_charged: '2026-06-02',
      last_charged: '2026-06-16',
      occurrence_count: 2,
    });

    expect(formatFixedExpenseDueDatesInMonth(summary, june2026)).toBe('Jun 2, 16, 30');
  });

  it('formats a single monthly due date', () => {
    const summary = makeSummary({
      merchant: 'Spotify',
      monthly_cost: '9.99',
      first_charged: '2026-01-15',
      last_charged: '2026-05-15',
      occurrence_count: 5,
    });

    expect(formatFixedExpenseDueDatesInMonth(summary, june2026)).toBe('Jun 15');
  });
});

describe('listFixedExpenseDueDatesInMonth', () => {
  const june2026 = new Date(2026, 5, 1);

  it('marks paid, upcoming, and missed dates for weekly charges in the current month', () => {
    const summary = makeSummary({
      merchant: 'CenturyLink',
      monthly_cost: '502.88',
      cadence: 'weekly',
      first_charged: '2026-06-02',
      last_charged: '2026-06-16',
      occurrence_count: 3,
    });

    expect(listFixedExpenseDueDatesInMonth(summary, june2026, new Date(2026, 5, 20))).toEqual([
      { isoDate: '2026-06-02', day: 2, status: 'paid' },
      { isoDate: '2026-06-09', day: 9, status: 'paid' },
      { isoDate: '2026-06-16', day: 16, status: 'paid' },
      { isoDate: '2026-06-23', day: 23, status: 'upcoming' },
      { isoDate: '2026-06-30', day: 30, status: 'upcoming' },
    ]);
  });

  it('marks every due date upcoming in a future month', () => {
    const summary = makeSummary({
      merchant: 'CenturyLink',
      monthly_cost: '502.88',
      cadence: 'weekly',
      first_charged: '2026-05-06',
      last_charged: '2026-06-24',
      occurrence_count: 8,
    });

    expect(
      listFixedExpenseDueDatesInMonth(summary, new Date(2026, 6, 1), new Date(2026, 5, 9)).map(
        (entry) => entry.status
      )
    ).toEqual(['upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming']);
  });
});

describe('resolveFixedExpenseMonthState', () => {
  const today = new Date(2026, 5, 20);
  const month = new Date(2026, 5, 1);

  it('returns due when some due dates are still upcoming', () => {
    const summary = makeSummary({
      merchant: 'CenturyLink',
      monthly_cost: '502.88',
      cadence: 'weekly',
      first_charged: '2026-06-02',
      last_charged: '2026-06-16',
      occurrence_count: 3,
    });

    expect(resolveFixedExpenseMonthState(summary, month, today)).toBe('due');
  });

  it('returns paid when every due date in the month is paid', () => {
    const summary = makeSummary({
      merchant: 'Spotify',
      monthly_cost: '9.99',
      first_charged: '2026-01-15',
      last_charged: '2026-06-15',
      occurrence_count: 6,
    });

    expect(resolveFixedExpenseMonthState(summary, month, today)).toBe('paid');
  });

  it('returns paid for a past month when charges posted there even if last_charged is later', () => {
    const summary = makeSummary({
      merchant: 'CenturyLink',
      monthly_cost: '502.88',
      cadence: 'weekly',
      first_charged: '2026-03-18',
      last_charged: '2026-06-24',
      occurrence_count: 8,
    });

    expect(
      resolveFixedExpenseMonthState(summary, new Date(2026, 2, 1), new Date(2026, 5, 20))
    ).toBe('paid');
  });

  it('returns due when the scheduled charge is later in the month', () => {
    const summary = makeSummary({
      merchant: 'Netflix',
      monthly_cost: '15.99',
      first_charged: '2026-01-15',
      last_charged: '2026-05-15',
      occurrence_count: 5,
    });

    expect(resolveFixedExpenseMonthState(summary, month, new Date(2026, 5, 10))).toBe('due');
  });

  it('returns missed when the due date passed without a transaction in the month', () => {
    const summary = makeSummary({
      merchant: 'Hulu',
      monthly_cost: '11.99',
      first_charged: '2026-01-15',
      last_charged: '2026-05-15',
      occurrence_count: 5,
    });

    expect(resolveFixedExpenseMonthState(summary, month, today)).toBe('missed');
  });

  it('returns due when viewing a future month before any charge can post', () => {
    const summary = makeSummary({
      merchant: 'CenturyLink',
      monthly_cost: '502.88',
      cadence: 'weekly',
      first_charged: '2026-05-06',
      last_charged: '2026-06-24',
      occurrence_count: 8,
    });

    expect(resolveFixedExpenseMonthState(summary, new Date(2026, 6, 1), new Date(2026, 5, 9))).toBe(
      'due'
    );
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
