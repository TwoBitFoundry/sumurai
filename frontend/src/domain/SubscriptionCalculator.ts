import type { FixedExpenseSummary } from '../types/api';
import type { FixedExpenseHeroStats } from './FixedExpenseCalculator';
import {
  computeFixedExpenseMonthCost,
  computeFixedExpenseYtdCost,
  FixedExpenseCalculator,
  resolveYtdReferenceDate,
} from './FixedExpenseCalculator';

export type SubscriptionHeroStats = FixedExpenseHeroStats;
export type SubscriptionSummary = FixedExpenseSummary;
export { resolveYtdReferenceDate };
export const computeSubscriptionMonthCost = computeFixedExpenseMonthCost;
export const computeSubscriptionYtdCost = computeFixedExpenseYtdCost;

export class SubscriptionCalculator {
  static computeSubscriptionHeroStats(
    summaries: FixedExpenseSummary[],
    month: Date,
    today: Date = new Date()
  ): FixedExpenseHeroStats {
    return FixedExpenseCalculator.computeFixedExpenseHeroStats(summaries, month, today);
  }
}
