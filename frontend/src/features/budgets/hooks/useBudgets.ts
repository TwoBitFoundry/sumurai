/**
 * Loads and mutates budget data for the budgets feature.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { BudgetCalculator } from '../../../domain/BudgetCalculator';
import { useAccountFilter } from '../../../hooks/useAccountFilter';
import { BudgetService } from '../../../services/BudgetService';
import { TransactionService } from '../../../services/TransactionService';
import type { Budget, Transaction } from '../../../types/api';
import { accountIdsCacheKey } from '../../../utils/cacheKeys';
import { sortCategoryNamesAlphabetically } from '../../../utils/categories';
import { useCategories } from '../../transactions/hooks/useCategories';
import { type BudgetMonthControl, useBudgetMonth } from './useBudgetMonth';

export interface BudgetProgressEntry extends Budget {
  spent: number;
  percentage: number;
}

export interface UseBudgetsResult {
  isLoading: boolean;
  transactionsLoading: boolean;
  error: string | null;
  validationError: string | null;
  budgets: Budget[];
  computedBudgets: BudgetProgressEntry[];
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
    queryFn: () => BudgetService.getBudgets(),
    staleTime: 5 * 60 * 1000,
  });

  const txnsQuery = useQuery({
    queryKey: ['transactions', 'budget-month', range, cacheKey],
    queryFn: async (): Promise<Transaction[]> => {
      if (allAccountIds.length > 0 && selectedAccountIds.length === 0) {
        return [];
      }
      const shouldFilter = selectedAccountIds.length > 0 && !isAllAccountsSelected;
      const accountIds = shouldFilter ? selectedAccountIds : undefined;
      return TransactionService.getTransactions({
        startDate: range.start,
        endDate: range.end,
        accountIds,
      });
    },
    enabled: !accountsLoading && budgetsQuery.isSuccess,
    staleTime: 2 * 60 * 1000,
  });

  const budgets = budgetsQuery.data ?? [];
  const transactions = txnsQuery.data ?? [];

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
      const previous = queryClient.getQueryData<Budget[]>(['budgets']);
      const id = generateId();
      queryClient.setQueryData<Budget[]>(['budgets'], (old) => [
        ...(old ?? []),
        { id, category: newBudget.category, amount: newBudget.amount },
      ]);
      return { previous, tempId: id };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['budgets'], context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (variables: { id: string; amount: number }) =>
      BudgetService.updateBudget(variables.id, { amount: variables.amount }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['budgets'] });
      const previous = queryClient.getQueryData<Budget[]>(['budgets']);
      queryClient.setQueryData<Budget[]>(['budgets'], (old) =>
        (old ?? []).map((b) => (b.id === variables.id ? { ...b, amount: variables.amount } : b))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['budgets'], context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (variables: { id: string }) => BudgetService.deleteBudget(variables.id),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['budgets'] });
      const previous = queryClient.getQueryData<Budget[]>(['budgets']);
      queryClient.setQueryData<Budget[]>(['budgets'], (old) =>
        (old ?? []).filter((b) => b.id !== variables.id)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['budgets'], context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });

  const load = useCallback(async () => {
    setValidationError(null);
    setMutationError(null);
    await queryClient.refetchQueries({ queryKey: ['budgets'] });
    await queryClient.refetchQueries({
      queryKey: ['transactions', 'budget-month', range, cacheKey],
    });
  }, [queryClient, range, cacheKey]);

  const categories = useMemo(() => budgets.map((b) => b.category).sort(), [budgets]);

  const usedCategories = useMemo(() => new Set(budgets.map((b) => b.category)), [budgets]);

  const categoryOptions = useMemo(() => {
    const unique = new Set<string>(rosterCategories);
    for (const txn of transactions) {
      const primary = txn.category?.primary || 'OTHER';
      unique.add(primary);
    }
    return sortCategoryNamesAlphabetically(Array.from(unique));
  }, [rosterCategories, transactions]);

  const availableCategoryOptions = useMemo(() => {
    const usedLower = new Set([...usedCategories].map((category) => category.toLowerCase()));
    return categoryOptions.filter((category) => !usedLower.has(category.toLowerCase()));
  }, [categoryOptions, usedCategories]);

  const computedBudgets = useMemo(() => {
    return budgets.map<BudgetProgressEntry>((b) => {
      const spent = BudgetCalculator.calculateSpent(
        transactions,
        b.category,
        range.start,
        range.end
      );
      const percentage = BudgetCalculator.calculatePercentage(b.amount, spent);
      return { ...b, spent, percentage };
    });
  }, [budgets, range.end, range.start, transactions]);

  const add = useCallback(
    async (category: string, amount: number) => {
      setValidationError(null);
      setMutationError(null);
      const list = queryClient.getQueryData<Budget[]>(['budgets']) ?? [];
      const exists = list.some(
        (b) => (b.category || '').toLowerCase() === (category || '').toLowerCase()
      );
      if (exists) {
        const msg = `A budget for "${category}" already exists.`;
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
    transactionsLoading: txnsQuery.isFetching,
    error,
    validationError,
    budgets,
    computedBudgets,
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
