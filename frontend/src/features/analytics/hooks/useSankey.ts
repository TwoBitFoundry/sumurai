import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAccountFilter } from '../../../hooks/useAccountFilter';
import { AnalyticsService } from '../../../services/AnalyticsService';
import type { SankeyResponse } from '../../../types/api';
import { accountIdsCacheKey } from '../../../utils/cacheKeys';
import { computeDateRange, type DateRangeKey } from '../../../utils/dateRanges';

const emptySankeyResponse: SankeyResponse = {
  nodes: [],
  links: [],
  currency: 'USD',
  summary: {
    income: 0,
    expenses: 0,
    covered: 0,
    deficit: 0,
    surplus: 0,
    coverage_ratio: null,
  },
};

export type UseSankeyResult = {
  data: SankeyResponse | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  cacheKey: string;
  start?: string;
  end?: string;
};

export function useSankey(range: DateRangeKey): UseSankeyResult {
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

  const query = useQuery<SankeyResponse, Error>({
    queryKey: ['sankey', range, cacheKey],
    enabled: accountsReady && !!start && !!end,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!start || !end) {
        return emptySankeyResponse;
      }

      if (allAccountIds.length > 0 && selectedAccountIds.length === 0) {
        return emptySankeyResponse;
      }

      const accountIds =
        !isAllAccountsSelected && selectedAccountIds.length > 0 ? selectedAccountIds : undefined;
      const raw = await AnalyticsService.getSankey(start, end, accountIds);
      return raw ?? emptySankeyResponse;
    },
  });

  const loading =
    (!accountsReady && query.data === undefined) ||
    (accountsReady && query.fetchStatus === 'fetching' && query.data === undefined);

  return {
    data: query.data ?? null,
    loading,
    refreshing: query.isFetching && !query.isPending && accountsReady,
    error: query.error?.message ?? null,
    cacheKey,
    start,
    end,
  };
}
