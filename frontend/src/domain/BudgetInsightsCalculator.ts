import type { SubscriptionSummary } from '../types/api';
import type { BudgetStats } from './BudgetCalculator';
import { computeSubscriptionNextDueDate } from './subscriptionDates';

export interface BudgetInsightsInput {
  stats: BudgetStats;
  subscriptions: SubscriptionSummary[];
  month: Date;
  referenceDate: Date;
  isAccountFiltered: boolean;
  filteredBudgetSpend: number;
  totalBudgetSpend: number;
}

export interface BudgetInsights {
  dailyPacing: number | null;
  safeToSpend: number;
  upcomingSubscriptionsTotal: number;
  runoutDate: Date | null;
  accountWeightPct: number | null;
  budgetSlack: number;
  hasActivity: boolean;
}

function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function computeBudgetInsights(input: BudgetInsightsInput): BudgetInsights {
  const {
    stats,
    subscriptions,
    month,
    referenceDate,
    isAccountFiltered,
    filteredBudgetSpend,
    totalBudgetSpend,
  } = input;

  const { totalBudgeted, totalSpent, remaining, daysRemaining } = stats;

  const hasActivity = totalBudgeted > 0 || totalSpent > 0;

  const dailyPacing = daysRemaining > 0 ? remaining / daysRemaining : null;

  const refIso = isoDate(referenceDate);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const monthEndIso = isoDate(monthEnd);

  const upcomingSubscriptionsTotal = subscriptions.reduce((sum, sub) => {
    const nextDue = computeSubscriptionNextDueDate(sub.last_charged, sub.cadence, referenceDate);
    if (nextDue >= refIso && nextDue <= monthEndIso) {
      return sum + parseFloat(sub.monthly_cost);
    }
    return sum;
  }, 0);

  const safeToSpend = Math.max(0, remaining - upcomingSubscriptionsTotal);

  const isCurrentMonth =
    month.getFullYear() === referenceDate.getFullYear() &&
    month.getMonth() === referenceDate.getMonth();
  const currentDayOfMonth = referenceDate.getDate();

  let runoutDate: Date | null = null;
  if (isCurrentMonth && totalSpent > 0 && currentDayOfMonth > 0 && remaining > 0) {
    const burnRate = totalSpent / currentDayOfMonth;
    const daysUntilExhaustion = remaining / burnRate;
    runoutDate = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate() + Math.ceil(daysUntilExhaustion)
    );
  }

  let accountWeightPct: number | null = null;
  let budgetSlack = 0;

  if (isAccountFiltered) {
    accountWeightPct = totalBudgetSpend > 0 ? (filteredBudgetSpend / totalBudgetSpend) * 100 : 0;
  } else {
    budgetSlack = Math.max(0, remaining - upcomingSubscriptionsTotal);
  }

  return {
    dailyPacing,
    safeToSpend,
    upcomingSubscriptionsTotal,
    runoutDate,
    accountWeightPct,
    budgetSlack,
    hasActivity,
  };
}
