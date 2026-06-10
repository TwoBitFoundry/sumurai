import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { computeYtdIncomeExpenses } from '@/domain/YtdTotalsCalculator';
import { useAccountFilter } from '@/hooks/useAccountFilter';
import { TransactionService } from '@/services/TransactionService';
import { accountIdsCacheKey } from '@/utils/cacheKeys';

export type UseYtdIncomeExpensesResult = {
  incomeYtd: number;
  expensesYtd: number;
  loading: boolean;
  error: string | null;
};

export function useYtdIncomeExpenses(): UseYtdIncomeExpensesResult {
  const year = new Date().getFullYear();
  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    return {
      startDate: `${year}-01-01`,
      endDate: today.toISOString().slice(0, 10),
    };
  }, [year]);

  const {
    selectedAccountIds,
    isAllAccountsSelected,
    allAccountIds,
    loading: accountsLoading,
  } = useAccountFilter();

  const cacheKey = accountIdsCacheKey(allAccountIds, selectedAccountIds, isAllAccountsSelected);

  const query = useQuery({
    queryKey: ['transactions', 'ytd-income-expenses', year, startDate, endDate, cacheKey],
    enabled: !accountsLoading,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (allAccountIds.length > 0 && selectedAccountIds.length === 0) {
        return { incomeYtd: 0, expensesYtd: 0 };
      }

      const accountIds =
        !isAllAccountsSelected && selectedAccountIds.length > 0 ? selectedAccountIds : undefined;
      const transactions = await TransactionService.getTransactions({
        startDate,
        endDate,
        accountIds,
      });

      return computeYtdIncomeExpenses(transactions, year);
    },
  });

  const loading =
    (accountsLoading && query.data === undefined) ||
    (!accountsLoading && query.fetchStatus === 'fetching' && query.data === undefined);

  return {
    incomeYtd: query.data?.incomeYtd ?? 0,
    expensesYtd: query.data?.expensesYtd ?? 0,
    loading,
    error: query.error?.message ?? null,
  };
}
