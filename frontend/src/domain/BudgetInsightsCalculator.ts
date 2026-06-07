import type { Transaction } from '../types/api';
import type { BudgetStats } from './BudgetCalculator';
import { BudgetCalculator } from './BudgetCalculator';

export interface BudgetInsightsInput {
  stats: BudgetStats;
  month: Date;
  referenceDate: Date;
  transactions: Transaction[];
  range: { start: string; end: string };
  computedBudgets: Array<{ amount: number; spent: number }>;
}

export interface BudgetInsights {
  dailyPacing: number | null;
  income: number;
  freeSpend: number;
  runoutDate: Date | null;
  hasActivity: boolean;
}

export function computeBudgetInsights(input: BudgetInsightsInput): BudgetInsights {
  const { stats, month, referenceDate, transactions, range, computedBudgets } = input;

  const { totalBudgeted, totalSpent, remaining } = stats;

  const hasActivity = totalBudgeted > 0 || totalSpent > 0;

  const isCurrentMonth =
    month.getFullYear() === referenceDate.getFullYear() &&
    month.getMonth() === referenceDate.getMonth();
  const isPastMonth =
    month.getFullYear() < referenceDate.getFullYear() ||
    (month.getFullYear() === referenceDate.getFullYear() &&
      month.getMonth() < referenceDate.getMonth());
  const currentDayOfMonth = referenceDate.getDate();

  let dailyPacing: number | null = null;
  if (totalSpent > 0) {
    if (isCurrentMonth && currentDayOfMonth > 0) {
      dailyPacing = totalSpent / currentDayOfMonth;
    } else if (isPastMonth && stats.totalDays > 0) {
      dailyPacing = totalSpent / stats.totalDays;
    }
  }

  const income = BudgetCalculator.calculateIncome(transactions, range.start, range.end);
  const overages = BudgetCalculator.computeOverages(computedBudgets);
  const freeSpend = income - totalBudgeted - overages;

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

  return {
    dailyPacing,
    income,
    freeSpend,
    runoutDate,
    hasActivity,
  };
}
