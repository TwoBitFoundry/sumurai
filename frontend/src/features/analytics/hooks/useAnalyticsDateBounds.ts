import { useQuery } from '@tanstack/react-query';
import { useAccountFilter } from '../../../hooks/useAccountFilter';
import { AnalyticsService } from '../../../services/AnalyticsService';
import { accountIdsCacheKey } from '../../../utils/cacheKeys';
import type { DashboardDateBounds } from '../../../utils/dateRanges';

export type UseAnalyticsDateBoundsResult = {
  bounds: DashboardDateBounds | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  cacheKey: string;
};

export function useAnalyticsDateBounds(): UseAnalyticsDateBoundsResult {
  const {
    selectedAccountIds,
    isAllAccountsSelected,
    allAccountIds,
    loading: accountsLoading,
  } = useAccountFilter();

  const cacheKey = accountIdsCacheKey(allAccountIds, selectedAccountIds, isAllAccountsSelected);

  const query = useQuery<DashboardDateBounds | null, Error>({
    queryKey: ['analytics', 'date-bounds', cacheKey],
    enabled: !accountsLoading,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      if (allAccountIds.length > 0 && selectedAccountIds.length === 0) {
        return null;
      }

      const accountIds =
        !isAllAccountsSelected && selectedAccountIds.length > 0 ? selectedAccountIds : undefined;
      const response = await AnalyticsService.getDateBounds(accountIds);

      if (!response.start_date || !response.end_date) {
        return null;
      }

      return {
        start: response.start_date,
        end: response.end_date,
      };
    },
  });

  const loading =
    (accountsLoading && query.data === undefined) ||
    (!accountsLoading && query.fetchStatus === 'fetching' && query.data === undefined);

  return {
    bounds: query.data ?? null,
    loading,
    refreshing: query.isFetching && !query.isPending && !accountsLoading,
    error: query.error?.message ?? null,
    cacheKey,
  };
}
