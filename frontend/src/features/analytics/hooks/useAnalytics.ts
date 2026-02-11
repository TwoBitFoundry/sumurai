import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAccountFilter } from '../../../hooks/useAccountFilter';
import { AnalyticsService } from '../../../services/AnalyticsService';
import type {
  AnalyticsCategoryResponse,
  AnalyticsMonthlyTotalsResponse,
  AnalyticsTopMerchantsResponse,
} from '../../../types/api';
import { computeDateRange, type DateRangeKey } from '../../../utils/dateRanges';

export type UseAnalyticsResult = {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  spendingTotal: number;
  categories: AnalyticsCategoryResponse[];
  topMerchants: AnalyticsTopMerchantsResponse[];
  monthlyTotals: AnalyticsMonthlyTotalsResponse[];
  start?: string;
  end?: string;
};

export function useAnalytics(range: DateRangeKey): UseAnalyticsResult {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spendingTotal, setSpendingTotal] = useState(0);
  const [categories, setCategories] = useState<AnalyticsCategoryResponse[]>([]);
  const [topMerchants, setTopMerchants] = useState<AnalyticsTopMerchantsResponse[]>([]);
  const [monthlyTotals, setMonthlyTotals] = useState<AnalyticsMonthlyTotalsResponse[]>([]);

  const {
    selectedAccountIds,
    isAllAccountsSelected,
    allAccountIds,
    loading: accountsLoading,
  } = useAccountFilter();

  const abortRef = useRef<AbortController | null>(null);
  const hasLoadedRef = useRef(false);

  const { start, end } = useMemo(() => computeDateRange(range), [range]);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    if (accountsLoading) {
      return;
    }
    const ac = new AbortController();
    abortRef.current = ac;
    const showBlockingState = !hasLoadedRef.current;
    if (showBlockingState) {
      setLoading(true);
      setRefreshing(false);
    } else {
      setRefreshing(true);
    }
    setError(null);
    try {
      if (allAccountIds.length > 0 && selectedAccountIds.length === 0) {
        setSpendingTotal(0);
        setCategories([]);
        setTopMerchants([]);
        setMonthlyTotals([]);
        hasLoadedRef.current = true;
        return;
      }

      const accountIds =
        !isAllAccountsSelected && selectedAccountIds.length > 0 ? selectedAccountIds : undefined;
      const [total, cats, merch, monthly] = await Promise.all([
        AnalyticsService.getSpendingTotal(start, end, accountIds),
        AnalyticsService.getCategorySpendingByDateRange(start, end, accountIds),
        AnalyticsService.getTopMerchantsByDateRange(start, end, accountIds),
        AnalyticsService.getMonthlyTotals(6, accountIds),
      ]);
      if (ac.signal.aborted) return;
      const totalNum = Number(total) || 0;
      setSpendingTotal(totalNum);
      setCategories(Array.isArray(cats) ? cats : []);
      setTopMerchants(Array.isArray(merch) ? merch : []);
      setMonthlyTotals(Array.isArray(monthly) ? monthly : []);
      hasLoadedRef.current = true;
    } catch (error: unknown) {
      if (!ac.signal.aborted) {
        const message = error instanceof Error ? error.message : 'Failed to load analytics';
        setError(message);
      }
    } finally {
      if (!ac.signal.aborted) {
        if (showBlockingState) {
          setLoading(false);
        }
        setRefreshing(false);
      }
    }
  }, [start, end, isAllAccountsSelected, selectedAccountIds, allAccountIds, accountsLoading]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  return {
    loading,
    refreshing,
    error,
    spendingTotal,
    categories,
    topMerchants,
    monthlyTotals,
    start,
    end,
  };
}
