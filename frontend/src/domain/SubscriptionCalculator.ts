import type { SubscriptionSummary } from '../types/api';

export interface SubscriptionHeroStats {
  monthlyTotal: number;
  annualized: number;
}

export class SubscriptionCalculator {
  static computeSubscriptionHeroStats(summaries: SubscriptionSummary[]): SubscriptionHeroStats {
    const monthlyTotal = summaries.reduce(
      (sum, summary) => sum + parseFloat(summary.monthly_cost),
      0
    );
    return {
      monthlyTotal,
      annualized: monthlyTotal * 12,
    };
  }
}
