import type { BudgetStats } from '../../src/domain/BudgetCalculator';
import type { BudgetInsightsInput } from '../../src/domain/BudgetInsightsCalculator';
import { computeBudgetInsights } from '../../src/domain/BudgetInsightsCalculator';
import type { Transaction } from '../../src/types/api';

const makeStats = (overrides: Partial<BudgetStats> = {}): BudgetStats => ({
  totalBudgeted: 500,
  totalSpent: 200,
  remaining: 300,
  variance: 300,
  overBudgetCount: 0,
  overBudgetCategories: [],
  daysRemaining: 20,
  totalDays: 30,
  activeBudgetCategories: ['FOOD'],
  nearLimitCategories: [],
  ...overrides,
});

const makeTxn = (date: string, amount: number, category = 'INCOME'): Transaction => ({
  id: `txn-${date}-${amount}`,
  date,
  amount,
  category: { primary: category },
  merchant_name: 'Employer',
  normalized_merchant: 'employer',
  provider_account_id: 'acct-1',
});

const baseInput = (): BudgetInsightsInput => ({
  stats: makeStats(),
  month: new Date(2026, 5, 1),
  referenceDate: new Date(2026, 5, 10),
  transactions: [makeTxn('2026-06-01', 5000)],
  range: { start: '2026-06-01', end: '2026-06-30' },
  computedBudgets: [{ amount: 500, spent: 200 }],
});

describe('computeBudgetInsights', () => {
  describe('Daily burn rate (Runway Pace)', () => {
    it('computes totalSpent divided by elapsed days in the current month', () => {
      const result = computeBudgetInsights(baseInput());
      expect(result.dailyPacing).toBeCloseTo(200 / 10);
    });

    it('returns null when totalSpent is 0', () => {
      const input = { ...baseInput(), stats: makeStats({ totalSpent: 0, remaining: 500 }) };
      expect(computeBudgetInsights(input).dailyPacing).toBeNull();
    });
  });

  describe('Free Spend', () => {
    it('equals income minus total planned minus overages', () => {
      const result = computeBudgetInsights(baseInput());
      expect(result.income).toBeCloseTo(5000);
      expect(result.freeSpend).toBeCloseTo(5000 - 500);
    });

    it('subtracts category overages from income after planned budgets', () => {
      const input = {
        ...baseInput(),
        stats: makeStats({ totalBudgeted: 500, totalSpent: 650, remaining: 0, overBudgetCount: 1 }),
        computedBudgets: [{ amount: 500, spent: 650 }],
      };

      expect(computeBudgetInsights(input).freeSpend).toBeCloseTo(5000 - 500 - 150);
    });

    it('excludes transfer inflows from income', () => {
      const input = {
        ...baseInput(),
        transactions: [
          makeTxn('2026-06-01', 5000, 'INCOME'),
          makeTxn('2026-06-02', 250, 'TRANSFER_IN'),
        ],
      };

      expect(computeBudgetInsights(input).freeSpend).toBeCloseTo(5000 - 500);
    });

    it('returns a negative value when planned budgets and overages exceed income', () => {
      const input = {
        ...baseInput(),
        transactions: [makeTxn('2026-06-01', 1000)],
        stats: makeStats({ totalBudgeted: 800, totalSpent: 900, remaining: 0, overBudgetCount: 1 }),
        computedBudgets: [{ amount: 800, spent: 900 }],
      };

      expect(computeBudgetInsights(input).freeSpend).toBeCloseTo(1000 - 800 - 100);
    });
  });

  describe('Exhaustion Projection (Runway Pace runout)', () => {
    it('computes runoutDate from burn rate for current month', () => {
      const result = computeBudgetInsights(baseInput());
      expect(result.runoutDate).not.toBeNull();
      const runout = result.runoutDate!;
      expect(runout.getFullYear()).toBe(2026);
      expect(runout.getMonth()).toBe(5);
      expect(runout.getDate()).toBe(25);
    });

    it('returns null when totalSpent is 0', () => {
      const input = {
        ...baseInput(),
        stats: makeStats({ totalSpent: 0, remaining: 500 }),
      };
      expect(computeBudgetInsights(input).runoutDate).toBeNull();
    });
  });

  describe('hasActivity flag', () => {
    it('is true when there is spend', () => {
      expect(computeBudgetInsights(baseInput()).hasActivity).toBe(true);
    });

    it('is false when both budget and spend are 0', () => {
      const input = {
        ...baseInput(),
        stats: makeStats({ totalBudgeted: 0, totalSpent: 0, remaining: 0, daysRemaining: 20 }),
      };
      expect(computeBudgetInsights(input).hasActivity).toBe(false);
    });
  });
});
