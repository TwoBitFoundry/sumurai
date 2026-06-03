/**
 * Loads analytics aggregates for dashboard charts.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAccountFilter } from '../../../hooks/useAccountFilter';
import { AnalyticsService } from '../../../services/AnalyticsService';
import type {
  AnalyticsCategoryResponse,
  AnalyticsMonthlyTotalsResponse,
  AnalyticsTopMerchantsResponse,
} from '../../../types/api';
import { accountIdsCacheKey } from '../../../utils/cacheKeys';
import { computeDateRange, type DateRangeKey } from '../../../utils/dateRanges';

export type UseAnalyticsResult = {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  spendingTotal: number;
  categories: AnalyticsCategoryResponse[];
  topMerchants: AnalyticsTopMerchantsResponse[];
  monthlyTotals: AnalyticsMonthlyTotalsResponse[];
  cacheKey: string;
  start?: string;
  end?: string;
};

type AnalyticsQueryData = {
  spendingTotal: number;
  categories: AnalyticsCategoryResponse[];
  topMerchants: AnalyticsTopMerchantsResponse[];
  monthlyTotals: AnalyticsMonthlyTotalsResponse[];
};

export function useAnalytics(range: DateRangeKey): UseAnalyticsResult {
  const {
    selectedAccountIds,
    isAllAccountsSelected,
    allAccountIds,
    loading: accountsLoading,
  } = useAccountFilter();

  const { start, end } = useMemo(() => computeDateRange(range), [range]);
  const cacheKey = accountIdsCacheKey(allAccountIds, selectedAccountIds, isAllAccountsSelected);
  const accountsReady =
    !accountsLoading && (allAccountIds.length === 0 || selectedAccountIds.length > 0);

  const query = useQuery<AnalyticsQueryData, Error>({
    queryKey: ['analytics', range, cacheKey],
    enabled: accountsReady,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (allAccountIds.length > 0 && selectedAccountIds.length === 0) {
        return {
          spendingTotal: 0,
          categories: [],
          topMerchants: [],
          monthlyTotals: [],
        };
      }

      const accountIds =
        !isAllAccountsSelected && selectedAccountIds.length > 0 ? selectedAccountIds : undefined;
      const [total, categories, topMerchants, monthlyTotals] = await Promise.all([
        AnalyticsService.getSpendingTotal(start, end, accountIds),
        AnalyticsService.getCategorySpendingByDateRange(start, end, accountIds),
        AnalyticsService.getTopMerchantsByDateRange(start, end, accountIds),
        AnalyticsService.getMonthlyTotals(6, accountIds),
      ]);

      return {
        spendingTotal: Number(total) || 0,
        categories: Array.isArray(categories) ? categories : [],
        topMerchants: Array.isArray(topMerchants) ? topMerchants : [],
        monthlyTotals: Array.isArray(monthlyTotals) ? monthlyTotals : [],
      };
    },
  });

  const loading =
    (!accountsReady && query.data === undefined) ||
    (accountsReady && query.fetchStatus === 'fetching' && query.data === undefined);

  return {
    loading,
    refreshing: query.isFetching && !query.isPending && accountsReady,
    error: query.error?.message ?? null,
    spendingTotal: query.data?.spendingTotal ?? 0,
    categories: query.data?.categories ?? [],
    topMerchants: query.data?.topMerchants ?? [],
    monthlyTotals: query.data?.monthlyTotals ?? [],
    cacheKey,
    start,
    end,
  };
}
