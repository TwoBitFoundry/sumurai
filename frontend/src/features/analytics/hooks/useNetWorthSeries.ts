/**
 * Loads net-worth time series for analytics charts.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useAccountFilter } from '../../../hooks/useAccountFilter';
import { AnalyticsService } from '../../../services/AnalyticsService';
import { accountIdsCacheKey } from '../../../utils/cacheKeys';
import { computeDateRange, type DateRangeKey } from '../../../utils/dateRanges';

export type NetWorthPoint = { date: string; value: number };

export type UseNetWorthSeriesResult = {
  series: NetWorthPoint[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  start?: string;
  end?: string;
  reload: () => Promise<void>;
};

export function useNetWorthSeries(range: DateRangeKey): UseNetWorthSeriesResult {
  const {
    selectedAccountIds,
    isAllAccountsSelected,
    allAccountIds,
    loading: accountsLoading,
  } = useAccountFilter();

  const { start, end } = useMemo(() => computeDateRange(range), [range]);
  const cacheKey = accountIdsCacheKey(allAccountIds, selectedAccountIds, isAllAccountsSelected);

  const query = useQuery<NetWorthPoint[], Error>({
    queryKey: ['analytics', 'net-worth', range, cacheKey],
    enabled: !accountsLoading && !!start && !!end,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!start || !end) {
        return [];
      }

      if (allAccountIds.length > 0 && selectedAccountIds.length === 0) {
        return [];
      }

      const accountIds =
        !isAllAccountsSelected && selectedAccountIds.length > 0 ? selectedAccountIds : undefined;
      const raw = await AnalyticsService.getNetWorthOverTime(start, end, accountIds);
      return Array.isArray(raw)
        ? raw.map((point) => ({
            date: point?.date ?? '',
            value: Number(point?.value) || 0,
          }))
        : [];
    },
  });

  const loading =
    (accountsLoading && query.data === undefined) ||
    (!accountsLoading && query.fetchStatus === 'fetching' && query.data === undefined);

  const reload = useCallback(async () => {
    if (accountsLoading || !start || !end) {
      return;
    }

    await query.refetch();
  }, [accountsLoading, end, query.refetch, start]);

  return {
    series: query.data ?? [],
    loading,
    refreshing: query.isFetching && !query.isPending && !accountsLoading,
    error: query.error?.message ?? null,
    start,
    end,
    reload,
  };
}
