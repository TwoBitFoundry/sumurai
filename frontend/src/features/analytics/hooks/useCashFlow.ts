/**
 * Loads cash flow (income vs expenses) time series for analytics charts.
 */

import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAccountFilter } from '../../../hooks/useAccountFilter';
import { AnalyticsService } from '../../../services/AnalyticsService';
import { accountIdsCacheKey } from '../../../utils/cacheKeys';
import type { AnalyticsCashFlowPoint } from '../../../types/api';

export type UseCashFlowResult = {
  series: AnalyticsCashFlowPoint[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export function useCashFlow(months: number = 6): UseCashFlowResult {
  const {
    selectedAccountIds,
    isAllAccountsSelected,
    allAccountIds,
    loading: accountsLoading,
  } = useAccountFilter();

  const cacheKey = accountIdsCacheKey(allAccountIds, selectedAccountIds, isAllAccountsSelected);

  const query = useQuery<AnalyticsCashFlowPoint[], Error>({
    queryKey: ['analytics', 'cash-flow', months, cacheKey],
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
