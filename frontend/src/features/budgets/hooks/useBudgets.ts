/**
 * Loads and mutates budget data for the budgets feature.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { BudgetCalculator } from '../../../domain/BudgetCalculator';
import { hasFixedExpenseChargeInMonth } from '../../../domain/FixedExpenseCalculator';
import { useAccountFilter } from '../../../hooks/useAccountFilter';
import { AnalyticsService } from '../../../services/AnalyticsService';
import { BudgetService } from '../../../services/BudgetService';
import type {
  Budget,
  BudgetSummaryResponse,
  BudgetsOverviewResponse,
  FixedExpenseSummary,
} from '../../../types/api';
import { accountIdsCacheKey } from '../../../utils/cacheKeys';
import {
  formatCategoryName,
  isBudgetEligibleCategory,
  sortCategoryNamesAlphabetically,
} from '../../../utils/categories';
import { invalidateBudgetQueries } from '../../../utils/queryInvalidation';
import { useCategories } from '../../transactions/hooks/useCategories';
import { type BudgetMonthControl, useBudgetMonth } from './useBudgetMonth';

export interface BudgetProgressEntry extends Budget {
  spent: number;
  percentage: number;
}

export interface UseBudgetsResult {
  isLoading: boolean;
  summaryLoading: boolean;
  error: string | null;
  validationError: string | null;
  budgets: Budget[];
  fixedExpenses: FixedExpenseSummary[];
  filteredFixedExpenses: FixedExpenseSummary[];
  insightsFixedExpenses: FixedExpenseSummary[];
  filterKey: string;
  computedBudgets: BudgetProgressEntry[];
  income: number;
  load: () => Promise<void>;
  add: (category: string, amount: number) => Promise<void>;
  update: (id: string, amount: number) => Promise<void>;
  remove: (id: string) => Promise<void>;
  categories: string[];
  categoryOptions: string[];
  availableCategoryOptions: string[];
  usedCategories: Set<string>;
  month: Date;
  monthLabel: string;
  range: { start: string; end: string };
  setMonth: (month: Date) => void;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  goToCurrentMonth: () => void;
}

export function useBudgets(monthControl?: BudgetMonthControl): UseBudgetsResult {
  const [validationError, setValidationError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const internalMonth = useBudgetMonth();
  const { month, monthLabel, range, setMonth, goToPreviousMonth, goToNextMonth, goToCurrentMonth } =
    monthControl ?? internalMonth;

  const queryClient = useQueryClient();
  const { all: rosterCategories } = useCategories();
  const {
    selectedAccountIds,
    isAllAccountsSelected,
    allAccountIds,
    loading: accountsLoading,
  } = useAccountFilter();
  const cacheKey = accountIdsCacheKey(allAccountIds, selectedAccountIds, isAllAccountsSelected);

  const budgetsQuery = useQuery({
    queryKey: ['budgets'],
    queryFn: () => BudgetService.getOverview(),
    staleTime: 5 * 60 * 1000,
  });

  const budgetSummaryQuery = useQuery({
    queryKey: ['analytics', 'budget-summary', range, cacheKey],
    queryFn: async (): Promise<BudgetSummaryResponse> => {
      if (allAccountIds.length > 0 && selectedAccountIds.length === 0) {
        return { income: 0, category_spending: [] };
      }
      const shouldFilter = selectedAccountIds.length > 0 && !isAllAccountsSelected;
      const accountIds = shouldFilter ? selectedAccountIds : undefined;
      return AnalyticsService.getBudgetSummary(range.start, range.end, accountIds);
    },
    enabled: !accountsLoading && budgetsQuery.isSuccess,
    staleTime: 2 * 60 * 1000,
  });

  const budgets = budgetsQuery.data?.budgets ?? [];
  const fixedExpenses = budgetsQuery.data?.fixed_expenses ?? [];
  const budgetSummaryIncome = Number(budgetSummaryQuery.data?.income) || 0;
  const budgetSummaryCategorySpending = budgetSummaryQuery.data?.category_spending ?? [];

  const hasAccountRoster = allAccountIds.length > 0;
  const hasEmptyAccountSelection = hasAccountRoster && selectedAccountIds.length === 0;
  const isAccountFiltered =
    hasAccountRoster && !isAllAccountsSelected && selectedAccountIds.length > 0;

  const insightsFixedExpenses = useMemo(() => {
    if (hasEmptyAccountSelection) {
      return [];
    }

    if (!isAccountFiltered) {
      return fixedExpenses;
    }

    return fixedExpenses.filter((item) =>
      item.account_ids.some((id) => selectedAccountIds.includes(id))
    );
  }, [hasEmptyAccountSelection, isAccountFiltered, selectedAccountIds, fixedExpenses]);

  const filteredFixedExpenses = useMemo(() => {
    return insightsFixedExpenses.filter((item) => hasFixedExpenseChargeInMonth(item, month));
  }, [insightsFixedExpenses, month]);

  const loadError = useMemo(() => {
    if (!budgetsQuery.isError || budgetsQuery.error == null) {
      return null;
    }
    const status = extractStatus(budgetsQuery.error);
    if (status === 401) {
      return 'You are not authenticated. Please log in again.';
    }
    return 'Failed to load budgets.';
  }, [budgetsQuery.isError, budgetsQuery.error]);

  const error = loadError ?? mutationError;

  const addMutation = useMutation({
    mutationFn: (variables: { category: string; amount: number }) =>
      BudgetService.createBudget(variables),
    onMutate: async (newBudget) => {
      await queryClient.cancelQueries({ queryKey: ['budgets'] });
      const previous = queryClient.getQueryData<BudgetsOverviewResponse>(['budgets']);
      const id = generateId();
      queryClient.setQueryData<BudgetsOverviewResponse>(['budgets'], (old) => ({
        budgets: [
          ...(old?.budgets ?? []),
          { id, category: newBudget.category, amount: newBudget.amount },
        ],
        fixed_expenses: old?.fixed_expenses ?? [],
      }));
      return { previous, tempId: id };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['budgets'], context.previous);
      }
    },
    onSuccess: (createdBudget, _variables, context) => {
      queryClient.setQueryData<BudgetsOverviewResponse>(['budgets'], (old) => ({
        budgets: [
          ...(old?.budgets ?? []).filter((budget) => budget.id !== context?.tempId),
          createdBudget,
        ],
        fixed_expenses: old?.fixed_expenses ?? [],
      }));
    },
    onSettled: () => {
      void invalidateBudgetQueries(queryClient);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (variables: { id: string; amount: number }) =>
      BudgetService.updateBudget(variables.id, { amount: variables.amount }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['budgets'] });
      const previous = queryClient.getQueryData<BudgetsOverviewResponse>(['budgets']);
      queryClient.setQueryData<BudgetsOverviewResponse>(['budgets'], (old) => ({
        budgets: (old?.budgets ?? []).map((b) =>
          b.id === variables.id ? { ...b, amount: variables.amount } : b
        ),
        fixed_expenses: old?.fixed_expenses ?? [],
      }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['budgets'], context.previous);
      }
    },
    onSuccess: (updatedBudget) => {
      queryClient.setQueryData<BudgetsOverviewResponse>(['budgets'], (old) => ({
        budgets: (old?.budgets ?? []).map((budget) =>
          budget.id === updatedBudget.id
            ? {
                ...budget,
                category: updatedBudget.category,
                amount: updatedBudget.amount,
              }
            : budget
        ),
        fixed_expenses: old?.fixed_expenses ?? [],
      }));
    },
    onSettled: () => {
      void invalidateBudgetQueries(queryClient);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (variables: { id: string }) => BudgetService.deleteBudget(variables.id),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['budgets'] });
      const previous = queryClient.getQueryData<BudgetsOverviewResponse>(['budgets']);
      queryClient.setQueryData<BudgetsOverviewResponse>(['budgets'], (old) => ({
        budgets: (old?.budgets ?? []).filter((b) => b.id !== variables.id),
        fixed_expenses: old?.fixed_expenses ?? [],
      }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['budgets'], context.previous);
      }
    },
    onSettled: () => {
      void invalidateBudgetQueries(queryClient);
    },
  });

  const load = useCallback(async () => {
    setValidationError(null);
    setMutationError(null);
    await queryClient.refetchQueries({ queryKey: ['budgets'] });
    await queryClient.refetchQueries({
      queryKey: ['analytics', 'budget-summary', range, cacheKey],
    });
  }, [queryClient, range, cacheKey]);

  const categories = useMemo(() => budgets.map((b) => b.category).sort(), [budgets]);

  const usedCategories = useMemo(() => new Set(budgets.map((b) => b.category)), [budgets]);

  const categoryOptions = useMemo(() => {
    const unique = new Set<string>(rosterCategories);
    for (const item of budgetSummaryCategorySpending) {
      unique.add(item.name);
    }
    return sortCategoryNamesAlphabetically(Array.from(unique).filter(isBudgetEligibleCategory));
  }, [budgetSummaryCategorySpending, rosterCategories]);

  const availableCategoryOptions = useMemo(() => {
    const usedLower = new Set([...usedCategories].map((category) => category.toLowerCase()));
    return categoryOptions.filter((category) => !usedLower.has(category.toLowerCase()));
  }, [categoryOptions, usedCategories]);

  const computedBudgets = useMemo(() => {
    const spentByCategory = new Map<string, number>();
    for (const item of budgetSummaryCategorySpending) {
      const key = formatCategoryName(item.name).toLowerCase();
      spentByCategory.set(key, (spentByCategory.get(key) ?? 0) + Number(item.value ?? 0));
    }

    return budgets.map<BudgetProgressEntry>((b) => {
      const spent = spentByCategory.get(formatCategoryName(b.category).toLowerCase()) ?? 0;
      const percentage = BudgetCalculator.calculatePercentage(b.amount, spent);
      return { ...b, spent, percentage };
    });
  }, [budgetSummaryCategorySpending, budgets]);

  const add = useCallback(
    async (category: string, amount: number) => {
      setValidationError(null);
      setMutationError(null);
      const list = queryClient.getQueryData<BudgetsOverviewResponse>(['budgets'])?.budgets ?? [];
      const exists = list.some(
        (b) => (b.category || '').toLowerCase() === (category || '').toLowerCase()
      );
      if (exists) {
        const msg = `A budget for "${category}" already exists.`;
        setValidationError(msg);
        return Promise.reject(new Error(msg));
      }
      if (!isBudgetEligibleCategory(category)) {
        const msg = 'Budgets cannot be created for income or transfer categories.';
        setValidationError(msg);
        return Promise.reject(new Error(msg));
      }
      try {
        await addMutation.mutateAsync({ category, amount });
      } catch (err: unknown) {
        const status = extractStatus(err);
        const msg =
          status === 409
            ? `A budget for "${category}" already exists.`
            : status === 401
              ? 'You are not authenticated. Please log in again.'
              : 'Failed to create budget.';
        setMutationError(msg);
        throw err;
      }
    },
    [addMutation, queryClient]
  );

  const update = useCallback(
    async (id: string, amount: number) => {
      setMutationError(null);
      try {
        await updateMutation.mutateAsync({ id, amount });
      } catch (err: unknown) {
        const status = extractStatus(err);
        const msg =
          status === 401
            ? 'You are not authenticated. Please log in again.'
            : 'Failed to update budget.';
        setMutationError(msg);
      }
    },
    [updateMutation]
  );

  const remove = useCallback(
    async (id: string) => {
      setMutationError(null);
      try {
        await removeMutation.mutateAsync({ id });
      } catch (err: unknown) {
        const status = extractStatus(err);
        const msg =
          status === 401
            ? 'You are not authenticated. Please log in again.'
            : 'Failed to delete budget.';
        setMutationError(msg);
      }
    },
    [removeMutation]
  );

  return {
    isLoading: budgetsQuery.isPending,
    summaryLoading: budgetSummaryQuery.isFetching,
    error,
    validationError,
    budgets,
    fixedExpenses,
    filteredFixedExpenses,
    insightsFixedExpenses,
    filterKey: cacheKey,
    computedBudgets,
    income: budgetSummaryIncome,
    load,
    add,
    update,
    remove,
    categories,
    categoryOptions,
    availableCategoryOptions,
    usedCategories,
    month,
    monthLabel,
    range,
    setMonth,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
  };
}

function generateId(): string {
  if (typeof globalThis !== 'undefined') {
    const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
    if (cryptoObj?.randomUUID) {
      return cryptoObj.randomUUID();
    }
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function extractStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}
