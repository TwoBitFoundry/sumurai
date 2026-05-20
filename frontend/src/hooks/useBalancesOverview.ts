/**
 * Loads balances overview data for dashboard summaries.
 */

import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { AnalyticsService } from '../services/AnalyticsService';
import type { BalancesOverview } from '../types/analytics';
import { accountIdsCacheKey, accountRosterCacheKey } from '../utils/cacheKeys';
import { useAccountFilter } from './useAccountFilter';

export type UseBalancesOverview = {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  data: BalancesOverview | null;
  refresh: () => Promise<void>;
};

export function useBalancesOverview(): UseBalancesOverview {
  const {
    selectedAccountIds,
    isAllAccountsSelected,
    allAccountIds,
    loading: accountsLoading,
  } = useAccountFilter();

  const filterKey = accountIdsCacheKey(allAccountIds, selectedAccountIds, isAllAccountsSelected);
  const rosterKey = accountRosterCacheKey(allAccountIds);

  const query = useQuery<BalancesOverview | null, Error>({
    queryKey: ['analytics', 'balances-overview', filterKey, rosterKey],
    staleTime: 0,
    enabled: !accountsLoading,
    queryFn: async () => {
      if (allAccountIds.length > 0 && selectedAccountIds.length === 0) {
        return null;
      }

      const accountIds =
        !isAllAccountsSelected && selectedAccountIds.length > 0 ? selectedAccountIds : undefined;
      return AnalyticsService.getBalancesOverview(accountIds);
    },
  });

  const refresh = useCallback(async () => {
    if (accountsLoading) {
      return;
    }

    await query.refetch();
  }, [accountsLoading, query.refetch]);

  return {
    loading: accountsLoading || query.isPending,
    refreshing: query.isFetching && !query.isPending && !accountsLoading,
    error: query.error?.message ?? null,
    data: query.data ?? null,
    refresh,
  };
}
