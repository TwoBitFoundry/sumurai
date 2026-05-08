import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAccountFilter } from '../../../hooks/useAccountFilter';
import { AnalyticsService } from '../../../services/AnalyticsService';
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
  const [series, setSeries] = useState<NetWorthPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    selectedAccountIds,
    isAllAccountsSelected,
    allAccountIds,
    loading: accountsLoading,
  } = useAccountFilter();

  const abortRef = useRef<AbortController | null>(null);
  const hasLoadedRef = useRef(false);
  const loadGenerationRef = useRef(0);
  const prevAccountsLoadingRef = useRef(accountsLoading);
  const pendingLoadAfterAccountsRef = useRef(false);
  const accountsLoadingRef = useRef(accountsLoading);
  accountsLoadingRef.current = accountsLoading;

  const { start, end } = useMemo(() => computeDateRange(range), [range]);

  const load = useCallback(async () => {
    if (!start || !end) {
      abortRef.current?.abort();
      abortRef.current = null;
      setSeries([]);
      setLoading(false);
      setRefreshing(false);
      setError(null);
      hasLoadedRef.current = true;
      return;
    }

    if (accountsLoadingRef.current) {
      pendingLoadAfterAccountsRef.current = true;
      return;
    }

    abortRef.current?.abort();
    const generation = ++loadGenerationRef.current;
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
        setSeries([]);
        hasLoadedRef.current = true;
        return;
      }

      const accountIds =
        !isAllAccountsSelected && selectedAccountIds.length > 0 ? selectedAccountIds : undefined;
      const raw = await AnalyticsService.getNetWorthOverTime(start, end, accountIds);
      if (ac.signal.aborted) return;
      const normalized = Array.isArray(raw)
        ? raw.map((point) => ({
            date: point?.date ?? '',
            value: Number(point?.value) || 0,
          }))
        : [];
      setSeries(normalized);
      hasLoadedRef.current = true;
    } catch (error: unknown) {
      if (ac.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return;
      const message = error instanceof Error ? error.message : 'Failed to load net worth';
      setError(message);
      setSeries([]);
    } finally {
      if (generation === loadGenerationRef.current) {
        if (showBlockingState) {
          setLoading(false);
        }
        setRefreshing(false);
      }
    }
  }, [start, end, isAllAccountsSelected, selectedAccountIds, allAccountIds]);

  useEffect(() => {
    load();
    return () => {
      abortRef.current?.abort();
    };
  }, [load]);

  useEffect(() => {
    const wasLoading = prevAccountsLoadingRef.current;
    prevAccountsLoadingRef.current = accountsLoading;
    if (wasLoading && !accountsLoading && pendingLoadAfterAccountsRef.current) {
      pendingLoadAfterAccountsRef.current = false;
      load();
    }
  }, [accountsLoading, load]);

  return { series, loading, refreshing, error, start, end, reload: load };
}
