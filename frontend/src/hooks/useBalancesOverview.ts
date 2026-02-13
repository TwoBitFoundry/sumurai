import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnalyticsService } from '../services/AnalyticsService';
import type { BalancesOverview } from '../types/analytics';
import { useAccountFilter } from './useAccountFilter';
import { useDebouncedValue } from './useDebouncedValue';

export type DateRange = { startDate?: string; endDate?: string };

export type UseBalancesOverview = {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  data: BalancesOverview | null;
  refresh: () => Promise<void>;
};

/**
 * Fetches the latest Balances Overview and updates when the provided endDate changes (debounced).
 * Note: Backend is latest-only; date range is accepted for API symmetry and future extension.
 */
export function useBalancesOverview(range?: DateRange, debounceMs = 300): UseBalancesOverview {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BalancesOverview | null>(null);

  const {
    selectedAccountIds,
    isAllAccountsSelected,
    allAccountIds,
    loading: accountsLoading,
  } = useAccountFilter();

  const endDate = range?.endDate;
  const debouncedEnd = useDebouncedValue(endDate, debounceMs);
  const [lastTriggeredEnd, setLastTriggeredEnd] = useState<string | undefined>(debouncedEnd);
  const hasLoadedRef = useRef(false);

  const load = useCallback(async () => {
    if (accountsLoading) {
      return;
    }

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
        setData(null);
        hasLoadedRef.current = true;
        return;
      }

      const accountIds =
        !isAllAccountsSelected && selectedAccountIds.length > 0 ? selectedAccountIds : undefined;
      const result = await AnalyticsService.getBalancesOverview(accountIds);
      setData(result);
      hasLoadedRef.current = true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load balances overview';
      setError(message);
    } finally {
      if (showBlockingState) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  }, [isAllAccountsSelected, selectedAccountIds, allAccountIds, accountsLoading]);

  // Load data when load function changes (includes account filter changes)
  useEffect(() => {
    load();
  }, [load]);

  // Refetch when debounced endDate changes (ignore initial mount)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (!mounted) return;
    if (debouncedEnd !== lastTriggeredEnd) {
      setLastTriggeredEnd(debouncedEnd);
      if (debouncedEnd !== undefined) {
        load();
      }
    }
  }, [debouncedEnd, lastTriggeredEnd, load, mounted]);

  return useMemo(
    () => ({ loading, refreshing, error, data, refresh: load }),
    [loading, refreshing, error, data, load]
  );
}
