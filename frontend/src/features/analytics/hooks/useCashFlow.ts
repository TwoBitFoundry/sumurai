/**
 * Loads cash flow (income vs expenses) time series for analytics charts.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useAccountFilter } from '../../../hooks/useAccountFilter';
import { AnalyticsService } from '../../../services/AnalyticsService';
import type { AnalyticsCashFlowPoint } from '../../../types/api';
import { accountIdsCacheKey } from '../../../utils/cacheKeys';
import { computeDateRange, type DateRangeKey } from '../../../utils/dateRanges';
import { chartSeriesStartDate, generateMonthRange } from '../utils/chartMonth';

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

  const chartStart = useMemo(() => {
    if (!start) {
      return undefined;
    }
    return chartSeriesStartDate(start);
  }, [start]);

  const monthsToFetch = useMemo(() => {
    if (!chartStart || !end) {
      return months;
    }
    const startDate = new Date(chartStart);
    const endDate = new Date(end);
    const monthDiff =
      (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth()) +
      1;
    return Math.max(1, monthDiff);
  }, [chartStart, end, months]);

  const cacheKey = accountIdsCacheKey(allAccountIds, selectedAccountIds, isAllAccountsSelected);

  const query = useQuery<AnalyticsCashFlowPoint[], Error>({
    queryKey: ['analytics', 'cash-flow', monthsToFetch, cacheKey, dateRange],
    enabled: !accountsLoading,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (allAccountIds.length > 0 && selectedAccountIds.length === 0) {
        return [];
      }

      const accountIds =
        !isAllAccountsSelected && selectedAccountIds.length > 0 ? selectedAccountIds : undefined;
      const response = await AnalyticsService.getCashFlow(monthsToFetch, accountIds);
      const data = response.series ?? [];

      if (!chartStart || !end) {
        return data;
      }

      const allMonths = generateMonthRange(chartStart, end);
      const dataMap = new Map(data.map((point) => [point.month, point]));

      return allMonths.map((month) => {
        const point = dataMap.get(month);
        if (point) {
          return point;
        }
        return {
          month,
          income: 0,
          expenses: 0,
          net: 0,
        };
      });
    },
  });

  const loading =
    (accountsLoading && query.data === undefined) ||
    (!accountsLoading && query.fetchStatus === 'fetching' && query.data === undefined);

  const reload = useCallback(async () => {
    if (accountsLoading) {
      return;
    }

    await query.refetch();
  }, [accountsLoading, query]);

  return {
    series: query.data ?? [],
    loading,
    refreshing: query.isFetching && !query.isPending && !accountsLoading,
    error: query.error?.message ?? null,
    reload,
  };
}
