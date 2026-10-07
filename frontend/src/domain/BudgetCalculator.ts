import type { Budget, BudgetFrequency, Transaction } from '../types/api';
import {
  formatCategoryName,
  isSpendingExcludedCategory,
  resolveMajorCategory,
} from '../utils/categories';
import type { MonthYearSelection } from '../utils/dateRanges';
import { getNetSpendingAmount } from '../utils/transactionAmounts';

interface ComputedBudget {
  id: string;
  category: string;
  amount: number;
  spent: number;
}

export interface RolloverBudgetResult {
  monthlyAmount: number;
  frequency: BudgetFrequency;
  rollover: boolean;
  periodMultiplier: number;
  periodAmount: number;
  monthSpent: number;
  ytdSpent: number;
  priorMonthsSpent: number;
  priorMonthsAllocated: number;
  priorCarryover: number;
  availableThisMonth: number;
  remainingThisMonth: number;
  isOverBudget: boolean;
  percentageUsed: number;
}

export interface CompositeBudgetResult {
  monthlyAmount: number;
  availableThisMonth: number;
  monthSpent: number;
  ytdSpent: number;
  remainingThisMonth: number;
  isOverBudget: boolean;
  percentageUsed: number;
  hasRollover: boolean;
  totalPriorCarryover: number;
  directBudgetResult: RolloverBudgetResult | null;
  subcategoryResults: Array<{
    subcategory: string;
    result: RolloverBudgetResult;
  }>;
}

export interface BudgetStats {
  totalBudgeted: number;
  totalSpent: number;
  remaining: number;
  variance: number;
  overBudgetCount: number;
  overBudgetCategories: string[];
  daysRemaining: number;
  totalDays: number;
  activeBudgetCategories: string[];
  nearLimitCategories: string[];
}

export class BudgetCalculator {
  static calculateSpent(
    transactions: Transaction[],
    categoryId: string,
    start: string,
    end: string,
    subcategoryId?: string | null
  ): number {
    const targetCat = categoryId.toLowerCase();
    const targetSub = subcategoryId ? subcategoryId.toLowerCase() : null;

    return transactions
      .filter((t) => {
        const primary = t.category?.primary || '';
        if (isSpendingExcludedCategory(primary)) return false;

        const detailed = (
          t.category?.detailed ||
          t.custom_subcategory ||
          t.rule_subcategory ||
          ''
        ).toLowerCase();

        if (targetSub) {
          const subMatches = detailed === targetSub;
          const primaryMatches =
            primary.toLowerCase() === targetCat ||
            formatCategoryName(primary).toLowerCase() ===
              formatCategoryName(categoryId).toLowerCase() ||
            resolveMajorCategory(primary).toLowerCase() ===
              resolveMajorCategory(categoryId).toLowerCase();
          return primaryMatches && subMatches;
        }

        if (
          detailed &&
          (detailed === targetCat ||
            formatCategoryName(detailed).toLowerCase() ===
              formatCategoryName(categoryId).toLowerCase())
        ) {
          return true;
        }

        const isTargetCatMajor = resolveMajorCategory(categoryId).toLowerCase() === targetCat;

        const primaryMatches = primary.toLowerCase() === targetCat;
        const primaryFriendlyMatches =
          formatCategoryName(primary).toLowerCase() ===
          formatCategoryName(categoryId).toLowerCase();
        const majorMatches =
          isTargetCatMajor &&
          resolveMajorCategory(primary).toLowerCase() ===
            resolveMajorCategory(categoryId).toLowerCase();
        return primaryMatches || primaryFriendlyMatches || majorMatches;
      })
      .filter((t) => {
        const dateString = new Date(t.date).toISOString().slice(0, 10);
        return dateString >= start && dateString <= end;
      })
      .reduce((sum, t) => sum + getNetSpendingAmount(t), 0);
  }

  static computeRolloverBudget(
    budget: Budget,
    allYtdTransactions: Transaction[],
    period: MonthYearSelection,
    selectedSubcategory?: string | null
  ): RolloverBudgetResult {
    const isFullYear = period.month === null;
    const monthlyAmount = budget.amount;
    const frequency: BudgetFrequency = budget.frequency || 'monthly';
    const rollover = Boolean(budget.rollover);
    const periodMultiplier = isFullYear
      ? frequency === 'quarterly'
        ? 4
        : frequency === 'semi_annual'
          ? 2
          : frequency === 'annual'
            ? 1
            : 12
      : frequency === 'quarterly'
        ? 3
        : frequency === 'semi_annual'
          ? 6
          : frequency === 'annual'
            ? 12
            : 1;
    const periodAmount = monthlyAmount * periodMultiplier;

    const monthStart = isFullYear
      ? `${period.year}-01-01`
      : `${period.year}-${String(period.month + 1).padStart(2, '0')}-01`;
    const lastDayOfMonth = isFullYear
      ? 31
      : new Date(period.year, (period.month ?? 0) + 1, 0).getDate();
    const monthEnd = isFullYear
      ? `${period.year}-12-31`
      : `${period.year}-${String((period.month ?? 0) + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
    const yearStart = `${period.year}-01-01`;

    const monthSpent = BudgetCalculator.calculateSpent(
      allYtdTransactions,
      budget.category,
      monthStart,
      monthEnd,
      selectedSubcategory
    );

    const ytdSpent = BudgetCalculator.calculateSpent(
      allYtdTransactions,
      budget.category,
      yearStart,
      monthEnd,
      selectedSubcategory
    );

    // Determine rollover start year and month (0-indexed)
    let startYear = period.year;
    let startMonth = 0;

    if (budget.rollover_start_month) {
      const parts = budget.rollover_start_month.split('-');
      if (parts.length === 2) {
        startYear = parseInt(parts[0], 10);
        startMonth = parseInt(parts[1], 10) - 1;
      }
    } else if (budget.created_at) {
      const createdDate = new Date(budget.created_at);
      if (!isNaN(createdDate.getTime())) {
        startYear = createdDate.getFullYear();
        startMonth = createdDate.getMonth();
      }
    }

    let priorMonthsCount = 0;
    let priorMonthsSpent = 0;

    if (!isFullYear) {
      if (period.year > startYear) {
        priorMonthsCount = period.month ?? 0;
        if (priorMonthsCount > 0) {
          const priorStartDate = `${period.year}-01-01`;
          const lastDayOfPriorMonth = new Date(period.year, period.month ?? 0, 0).getDate();
          const priorEndDate = `${period.year}-${String(period.month).padStart(2, '0')}-${String(lastDayOfPriorMonth).padStart(2, '0')}`;
          priorMonthsSpent = BudgetCalculator.calculateSpent(
            allYtdTransactions,
            budget.category,
            priorStartDate,
            priorEndDate,
            selectedSubcategory
          );
        }
      } else if (period.year === startYear) {
        if ((period.month ?? 0) > startMonth) {
          priorMonthsCount = (period.month ?? 0) - startMonth;
          const priorStartDate = `${period.year}-${String(startMonth + 1).padStart(2, '0')}-01`;
          const lastDayOfPriorMonth = new Date(period.year, period.month ?? 0, 0).getDate();
          const priorEndDate = `${period.year}-${String(period.month).padStart(2, '0')}-${String(lastDayOfPriorMonth).padStart(2, '0')}`;
          priorMonthsSpent = BudgetCalculator.calculateSpent(
            allYtdTransactions,
            budget.category,
            priorStartDate,
            priorEndDate,
            selectedSubcategory
          );
        }
      }
    }

    const priorMonthsAllocated = priorMonthsCount * monthlyAmount;
    let priorCarryover = 0;
    if (rollover && priorMonthsCount > 0) {
      priorCarryover = Math.max(0, priorMonthsAllocated - priorMonthsSpent);
    }

    const availableThisMonth = isFullYear
      ? rollover
        ? periodAmount + priorCarryover
        : periodAmount
      : rollover
        ? monthlyAmount + priorCarryover
        : monthlyAmount;
    const remainingThisMonth = availableThisMonth - monthSpent;
    const isOverBudget = remainingThisMonth < 0;
    const percentageUsed =
      availableThisMonth > 0 ? Math.round((monthSpent / availableThisMonth) * 100) : 0;

    return {
      monthlyAmount,
      frequency,
      rollover,
      periodMultiplier,
      periodAmount,
      monthSpent,
      ytdSpent,
      priorMonthsSpent,
      priorMonthsAllocated,
      priorCarryover,
      availableThisMonth,
      remainingThisMonth,
      isOverBudget,
      percentageUsed,
    };
  }

  static computeCompositeMajorBudget(
    majorCategory: string,
    directBudget: Budget | null,
    subcategoryBudgets: Array<{ subcategory: string; budget: Budget }>,
    allYtdTransactions: Transaction[],
    period: MonthYearSelection
  ): CompositeBudgetResult {
    const directBudgetResult = directBudget
      ? BudgetCalculator.computeRolloverBudget(directBudget, allYtdTransactions, period, null)
      : null;

    const subcategoryResults = subcategoryBudgets.map((sb) => ({
      subcategory: sb.subcategory,
      result: BudgetCalculator.computeRolloverBudget(
        sb.budget,
        allYtdTransactions,
        period,
        sb.subcategory
      ),
    }));

    const isFullYear = period.month === null;
    const directMonthly = directBudget?.amount ?? 0;
    const subcategoriesMonthly = subcategoryBudgets.reduce((sum, sb) => sum + sb.budget.amount, 0);
    const monthlyAmount = isFullYear
      ? (directMonthly + subcategoriesMonthly) * 12
      : directMonthly + subcategoriesMonthly;

    const directAvailable =
      directBudgetResult?.availableThisMonth ?? (isFullYear ? directMonthly * 12 : directMonthly);
    const subcategoriesAvailable = subcategoryResults.reduce(
      (sum, sr) => sum + sr.result.availableThisMonth,
      0
    );
    const availableThisMonth = directAvailable + subcategoriesAvailable;

    const totalPriorCarryover =
      (directBudgetResult?.priorCarryover ?? 0) +
      subcategoryResults.reduce((sum, sr) => sum + sr.result.priorCarryover, 0);

    const hasRollover = Boolean(
      directBudget?.rollover || subcategoryBudgets.some((sb) => sb.budget.rollover)
    );

    const monthStart = isFullYear
      ? `${period.year}-01-01`
      : `${period.year}-${String(period.month + 1).padStart(2, '0')}-01`;
    const lastDayOfMonth = isFullYear
      ? 31
      : new Date(period.year, (period.month ?? 0) + 1, 0).getDate();
    const monthEnd = isFullYear
      ? `${period.year}-12-31`
      : `${period.year}-${String((period.month ?? 0) + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
    const yearStart = `${period.year}-01-01`;

    const monthSpent = BudgetCalculator.calculateSpent(
      allYtdTransactions,
      majorCategory,
      monthStart,
      monthEnd,
      null
    );

    const ytdSpent = BudgetCalculator.calculateSpent(
      allYtdTransactions,
      majorCategory,
      yearStart,
      monthEnd,
      null
    );

    const remainingThisMonth = availableThisMonth - monthSpent;
    const isOverBudget = remainingThisMonth < 0;
    const percentageUsed =
      availableThisMonth > 0 ? Math.round((monthSpent / availableThisMonth) * 100) : 0;

    return {
      monthlyAmount,
      availableThisMonth,
      monthSpent,
      ytdSpent,
      remainingThisMonth,
      isOverBudget,
      percentageUsed,
      hasRollover,
      totalPriorCarryover,
      directBudgetResult,
      subcategoryResults,
    };
  }

  static calculateRemaining(budget: number, spent: number): number {
    return Math.max(0, budget - spent);
  }

  static isOverBudget(budget: number, spent: number): boolean {
    return spent > budget;
  }

  static calculatePercentage(budget: number, spent: number): number {
    if (budget === 0) return 0;
    return Math.min(100, (spent / budget) * 100);
  }

  static computeStats(computedBudgets: ComputedBudget[], month: Date): BudgetStats {
    const year = month.getFullYear();
    const monthNum = month.getMonth();
    const lastDay = new Date(year, monthNum + 1, 0).getDate();

    if (!computedBudgets.length) {
      return {
        totalBudgeted: 0,
        totalSpent: 0,
        remaining: 0,
        variance: 0,
        overBudgetCount: 0,
        overBudgetCategories: [],
        daysRemaining: 0,
        totalDays: lastDay,
        activeBudgetCategories: [],
        nearLimitCategories: [],
      };
    }

    const totals = computedBudgets.reduce(
      (acc, budget) => {
        acc.totalBudgeted += budget.amount;
        acc.totalSpent += budget.spent;
        if (budget.spent > budget.amount) {
          acc.overBudgetCount += 1;
          acc.overBudgetCategories.push(budget.category);
        }
        return acc;
      },
      { totalBudgeted: 0, totalSpent: 0, overBudgetCount: 0, overBudgetCategories: [] as string[] }
    );

    const variance = totals.totalBudgeted - totals.totalSpent;

    const now = new Date();

    let daysRemaining = 0;
    if (now.getFullYear() === year && now.getMonth() === monthNum) {
      daysRemaining = Math.max(0, lastDay - now.getDate());
    } else if (
      now.getFullYear() < year ||
      (now.getFullYear() === year && now.getMonth() < monthNum)
    ) {
      daysRemaining = lastDay;
    } else {
      daysRemaining = 0;
    }

    const activeBudgetCategories = computedBudgets.map((b) => b.category);

    const nearLimitCategories = computedBudgets
      .filter((b) => {
        const utilization = b.amount > 0 ? b.spent / b.amount : 0;
        return utilization >= 0.8 && utilization < 1.0;
      })
      .slice(0, 3)
      .map((b) => b.category);

    return {
      totalBudgeted: totals.totalBudgeted,
      totalSpent: totals.totalSpent,
      remaining: Math.max(0, totals.totalBudgeted - totals.totalSpent),
      variance,
      overBudgetCount: totals.overBudgetCount,
      overBudgetCategories: totals.overBudgetCategories,
      daysRemaining,
      totalDays: lastDay,
      activeBudgetCategories,
      nearLimitCategories,
    };
  }
}
