import { SubscriptionCalculator } from '../../src/domain/SubscriptionCalculator';
import type { SubscriptionSummary } from '../../src/types/api';

const makeSummary = (merchant: string, monthlyCost: string): SubscriptionSummary => ({
  merchant,
  normalized_merchant: merchant.toLowerCase(),
  monthly_cost: monthlyCost,
  cadence: 'Monthly',
  last_charged: '2024-03-01',
  occurrence_count: 3,
});

describe('SubscriptionCalculator.computeSubscriptionHeroStats', () => {
  it('returns zero totals for empty summaries', () => {
    expect(SubscriptionCalculator.computeSubscriptionHeroStats([])).toEqual({
      monthlyTotal: 0,
      annualized: 0,
    });
  });

  it('sums monthly costs and annualizes', () => {
    const summaries = [makeSummary('Spotify', '9.99'), makeSummary('Netflix', '15.99')];

    expect(SubscriptionCalculator.computeSubscriptionHeroStats(summaries)).toEqual({
      monthlyTotal: 25.98,
      annualized: 311.76,
    });
  });
});
