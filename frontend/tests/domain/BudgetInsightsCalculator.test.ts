import type { BudgetStats } from '../../src/domain/BudgetCalculator';
import type { BudgetInsightsInput } from '../../src/domain/BudgetInsightsCalculator';
import { computeBudgetInsights } from '../../src/domain/BudgetInsightsCalculator';
import type { SubscriptionSummary } from '../../src/types/api';

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

const makeSub = (lastCharged: string, monthlyCost = '9.99'): SubscriptionSummary => ({
  merchant: 'Test',
  normalized_merchant: 'test',
  monthly_cost: monthlyCost,
  cadence: 'monthly',
  first_charged: '2026-01-01',
  last_charged: lastCharged,
  occurrence_count: 5,
  account_ids: [],
});

const baseInput = (): BudgetInsightsInput => ({
  stats: makeStats(),
  subscriptions: [],
  month: new Date(2026, 5, 1),
  referenceDate: new Date(2026, 5, 10),
  isAccountFiltered: false,
  filteredBudgetSpend: 200,
  totalBudgetSpend: 500,
});

describe('computeBudgetInsights', () => {
  describe('Daily Pacing (Card 1)', () => {
    it('computes remaining divided by daysRemaining', () => {
      const result = computeBudgetInsights(baseInput());
      expect(result.dailyPacing).toBeCloseTo(300 / 20);
    });

    it('returns null when daysRemaining is 0', () => {
      const input = { ...baseInput(), stats: makeStats({ daysRemaining: 0 }) };
      expect(computeBudgetInsights(input).dailyPacing).toBeNull();
    });

    it('returns null when remaining is 0 (budget exhausted)', () => {
      const input = { ...baseInput(), stats: makeStats({ remaining: 0, daysRemaining: 10 }) };
      expect(computeBudgetInsights(input).dailyPacing).toBeCloseTo(0);
    });
  });

  describe('Safe-To-Spend (Card 2)', () => {
    it('equals remaining when no upcoming subscriptions', () => {
      const result = computeBudgetInsights(baseInput());
      expect(result.safeToSpend).toBeCloseTo(300);
      expect(result.upcomingSubscriptionsTotal).toBe(0);
    });

    it('subtracts upcoming subscriptions due this month from referenceDate onward', () => {
      const input = {
        ...baseInput(),
        subscriptions: [makeSub('2026-05-20')],
      };
      const result = computeBudgetInsights(input);
      expect(result.upcomingSubscriptionsTotal).toBeCloseTo(9.99);
      expect(result.safeToSpend).toBeCloseTo(300 - 9.99);
    });

    it('does not include subscriptions whose next due date is before referenceDate', () => {
      const input = {
        ...baseInput(),
        subscriptions: [makeSub('2026-05-01')],
      };
      const result = computeBudgetInsights(input);
      expect(result.upcomingSubscriptionsTotal).toBe(0);
    });

    it('does not include subscriptions whose next due date is outside the current month', () => {
      const input = {
        ...baseInput(),
        subscriptions: [makeSub('2026-06-05')],
      };
      const result = computeBudgetInsights(input);
      expect(result.upcomingSubscriptionsTotal).toBe(0);
    });

    it('clamps safeToSpend to 0 when subscriptions exceed remaining', () => {
      const input = {
        ...baseInput(),
        stats: makeStats({ remaining: 5 }),
        subscriptions: [makeSub('2026-05-20', '50.00')],
      };
      expect(computeBudgetInsights(input).safeToSpend).toBe(0);
    });

    it('sums multiple upcoming subscriptions', () => {
      const input = {
        ...baseInput(),
        subscriptions: [makeSub('2026-05-15', '10.00'), makeSub('2026-05-20', '20.00')],
      };
      expect(computeBudgetInsights(input).upcomingSubscriptionsTotal).toBeCloseTo(30);
    });
  });

  describe('Exhaustion Projection (Card 3)', () => {
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

    it('returns null for a past month', () => {
      const input = {
        ...baseInput(),
        month: new Date(2026, 3, 1),
        referenceDate: new Date(2026, 5, 10),
      };
      expect(computeBudgetInsights(input).runoutDate).toBeNull();
    });

    it('returns null for a future month', () => {
      const input = {
        ...baseInput(),
        month: new Date(2026, 7, 1),
        referenceDate: new Date(2026, 5, 10),
      };
      expect(computeBudgetInsights(input).runoutDate).toBeNull();
    });

    it('returns null when remaining is 0', () => {
      const input = {
        ...baseInput(),
        stats: makeStats({ remaining: 0, totalSpent: 300 }),
      };
      expect(computeBudgetInsights(input).runoutDate).toBeNull();
    });
  });

  describe('Account Burden / Budget Slack (Card 4)', () => {
    it('returns accountWeightPct when account is filtered', () => {
      const input = {
        ...baseInput(),
        isAccountFiltered: true,
        filteredBudgetSpend: 150,
        totalBudgetSpend: 500,
      };
      const result = computeBudgetInsights(input);
      expect(result.accountWeightPct).toBeCloseTo(30);
      expect(result.budgetSlack).toBe(0);
    });

    it('returns 0 accountWeightPct when totalBudgetSpend is 0 to avoid divide-by-zero', () => {
      const input = {
        ...baseInput(),
        isAccountFiltered: true,
        filteredBudgetSpend: 50,
        totalBudgetSpend: 0,
      };
      expect(computeBudgetInsights(input).accountWeightPct).toBe(0);
    });

    it('returns budgetSlack when not filtered', () => {
      const input = {
        ...baseInput(),
        isAccountFiltered: false,
        stats: makeStats({ remaining: 300 }),
        subscriptions: [makeSub('2026-05-20', '50.00')],
      };
      const result = computeBudgetInsights(input);
      expect(result.accountWeightPct).toBeNull();
      expect(result.budgetSlack).toBeCloseTo(300 - 50);
    });

    it('clamps budgetSlack to 0 when subscriptions exceed remaining', () => {
      const input = {
        ...baseInput(),
        isAccountFiltered: false,
        stats: makeStats({ remaining: 10 }),
        subscriptions: [makeSub('2026-05-20', '50.00')],
      };
      expect(computeBudgetInsights(input).budgetSlack).toBe(0);
    });
  });

  describe('hasActivity flag', () => {
    it('is true when there is spend', () => {
      expect(computeBudgetInsights(baseInput()).hasActivity).toBe(true);
    });

    it('is true when there is a budget but no spend', () => {
      const input = {
        ...baseInput(),
        stats: makeStats({ totalBudgeted: 500, totalSpent: 0, remaining: 500 }),
      };
      expect(computeBudgetInsights(input).hasActivity).toBe(true);
    });

    it('is false when both budget and spend are 0', () => {
      const input = {
        ...baseInput(),
        stats: makeStats({ totalBudgeted: 0, totalSpent: 0, remaining: 0, daysRemaining: 20 }),
      };
      expect(computeBudgetInsights(input).hasActivity).toBe(false);
    });
  });

  describe('zero-budget guard', () => {
    it('returns safe defaults when all budgets are 0', () => {
      const input = {
        ...baseInput(),
        stats: makeStats({ totalBudgeted: 0, totalSpent: 0, remaining: 0, daysRemaining: 0 }),
      };
      const result = computeBudgetInsights(input);
      expect(result.dailyPacing).toBeNull();
      expect(result.safeToSpend).toBe(0);
      expect(result.runoutDate).toBeNull();
    });
  });
});
