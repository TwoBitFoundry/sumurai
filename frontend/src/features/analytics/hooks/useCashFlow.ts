/**
 * Loads cash flow (income vs expenses) time series for analytics charts.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useAccountFilter } from '../../../hooks/useAccountFilter';
import { AnalyticsService } from '../../../services/AnalyticsService';
import type { AnalyticsCashFlowPoint } from '../../../types/api';
import { accountIdsCacheKey } from '../../../utils/cacheKeys';
import {
  type CustomDateRangeBounds,
  type DateRangeKey,
  resolveDateRange,
} from '../../../utils/dateRanges';
import { chartSeriesStartDate, generateMonthRange } from '../utils/chartMonth';
import { useAnalyticsDateBounds } from './useAnalyticsDateBounds';

export type UseCashFlowResult = {
  series: AnalyticsCashFlowPoint[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export function useCashFlow(
  _months: number = 6,
  dateRange?: DateRangeKey,
  customRange?: CustomDateRangeBounds | null
): UseCashFlowResult {
  const {
    selectedAccountIds,
    isAllAccountsSelected,
    allAccountIds,
    loading: accountsLoading,
  } = useAccountFilter();
  const dateBounds = useAnalyticsDateBounds();

  const { start, end } = useMemo(() => {
    if (dateRange) {
      return resolveDateRange(dateRange, customRange, dateBounds.bounds);
    }
    return { start: undefined, end: undefined };
  }, [customRange, dateBounds.bounds, dateRange]);
  const hasValidRange = !!dateRange && !!dateBounds.bounds && !!start && !!end;

  const chartStart = useMemo(() => {
    if (!start) {
      return undefined;
    }
    if (dateRange === 'current-month') {
      return start;
    }
    return chartSeriesStartDate(start);
  }, [dateRange, start]);

  const cacheKey = accountIdsCacheKey(allAccountIds, selectedAccountIds, isAllAccountsSelected);

  const query = useQuery<AnalyticsCashFlowPoint[], Error>({
    queryKey: ['analytics', 'cash-flow', chartStart, end, cacheKey, dateRange],
    enabled: !accountsLoading && !dateBounds.loading && hasValidRange,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (allAccountIds.length > 0 && selectedAccountIds.length === 0) {
        return [];
      }

      const accountIds =
        !isAllAccountsSelected && selectedAccountIds.length > 0 ? selectedAccountIds : undefined;
      if (!chartStart || !end) {
        return [];
      }

      const response = await AnalyticsService.getCashFlow(chartStart, end, accountIds);
      const data = response.series ?? [];

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
    dateBounds.loading ||
    (accountsLoading && query.data === undefined) ||
    (!accountsLoading && query.fetchStatus === 'fetching' && query.data === undefined);

  const reload = useCallback(async () => {
    if (accountsLoading || dateBounds.loading || !chartStart || !end) {
      return;
    }

    await query.refetch();
  }, [accountsLoading, chartStart, dateBounds.loading, end, query]);

  return {
    series: query.data ?? [],
    loading,
    refreshing: query.isFetching && !query.isPending && !accountsLoading,
    error: dateBounds.error ?? query.error?.message ?? null,
    reload,
  };
}
