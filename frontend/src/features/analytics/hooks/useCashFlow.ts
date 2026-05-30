/**
 * Loads cash flow (income vs expenses) time series for analytics charts.
 */

import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useAccountFilter } from '../../../hooks/useAccountFilter';
import { AnalyticsService } from '../../../services/AnalyticsService';
import type { AnalyticsCashFlowPoint } from '../../../types/api';
import { accountIdsCacheKey } from '../../../utils/cacheKeys';
import { computeDateRange, type DateRangeKey } from '../../../utils/dateRanges';

export type UseCashFlowResult = {
  series: AnalyticsCashFlowPoint[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export function useCashFlow(months: number = 6, dateRange?: DateRangeKey): UseCashFlowResult {
  const {
    selectedAccountIds,
    isAllAccountsSelected,
    allAccountIds,
    loading: accountsLoading,
  } = useAccountFilter();

  const { start, end } = useMemo(() => {
    if (dateRange) {
      return computeDateRange(dateRange);
    }
    return { start: undefined, end: undefined };
  }, [dateRange]);

  const cacheKey = accountIdsCacheKey(allAccountIds, selectedAccountIds, isAllAccountsSelected);

  const query = useQuery<AnalyticsCashFlowPoint[], Error>({
    queryKey: ['analytics', 'cash-flow', months, cacheKey, dateRange],
    enabled: !accountsLoading,
    queryFn: async () => {
      if (allAccountIds.length > 0 && selectedAccountIds.length === 0) {
        return [];
      }

      const accountIds =
        !isAllAccountsSelected && selectedAccountIds.length > 0 ? selectedAccountIds : undefined;
      const response = await AnalyticsService.getCashFlow(months, accountIds);
      return response.series ?? [];
    },
  });

  const reload = useCallback(async () => {
    if (accountsLoading) {
      return;
    }

    await query.refetch();
  }, [accountsLoading, query]);

  return {
    series: query.data ?? [],
    loading: accountsLoading || query.isPending,
    refreshing: query.isFetching && !query.isPending && !accountsLoading,
    error: query.error?.message ?? null,
    reload,
  };
}
