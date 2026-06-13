import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { deriveInsightStateFromFilters } from '@/features/transactions/domain/deriveInsightStateFromFilters';
import { useAccountFilter } from '@/hooks/useAccountFilter';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { TransactionService } from '@/services/TransactionService';
import type { ContextualInsightsResponse, InsightState } from '@/types/api';
import { accountIdsCacheKey } from '@/utils/cacheKeys';
import { computeDateRange, type DateRangeKey } from '@/utils/dateRanges';

export interface UseTransactionsContextualInsightsOptions {
  search: string;
  selectedCategory: string | null;
  dateRange?: string;
}

export interface UseTransactionsContextualInsightsResult {
  insights: ContextualInsightsResponse | null;
  displayState: InsightState;
  isLoading: boolean;
  error: string | null;
  accountKey: string;
}

export function useTransactionsContextualInsights(
  options: UseTransactionsContextualInsightsOptions
): UseTransactionsContextualInsightsResult {
  const { search, selectedCategory, dateRange } = options;
  const {
    selectedAccountIds,
    isAllAccountsSelected,
    allAccountIds,
    loading: accountsLoading,
  } = useAccountFilter();
  const debouncedSearch = useDebouncedValue(search, 300);
  const normalizedSearch = debouncedSearch.trim().toLowerCase();
  const dateRangeBounds = computeDateRange(dateRange as DateRangeKey | undefined);
  const cacheKey = accountIdsCacheKey(allAccountIds, selectedAccountIds, isAllAccountsSelected);
  const singleAccountSelected =
    allAccountIds.length > 0 && !isAllAccountsSelected && selectedAccountIds.length === 1;
  const categoryActive = selectedCategory != null && selectedCategory !== '';

  const query = useQuery({
    queryKey: [
      'transactions',
      'contextual-insights',
      normalizedSearch,
      selectedCategory ?? '',
      dateRange ?? '',
      cacheKey,
    ],
    queryFn: async (): Promise<ContextualInsightsResponse> => {
      if (allAccountIds.length > 0 && selectedAccountIds.length === 0) {
        return {
          state: 'a',
          card1: {
            value: 0,
            format: 'currency',
            secondary: 0,
            comparison: null,
            share: null,
            label: null,
          },
          card2: {
            value: null,
            format: 'currency',
            secondary: null,
            comparison: null,
            share: null,
            label: null,
          },
          card3: null,
        };
      }

      return TransactionService.getTransactionsContextualInsights({
        search: normalizedSearch || undefined,
        categoryPrimary: selectedCategory ?? undefined,
        startDate: dateRangeBounds.start,
        endDate: dateRangeBounds.end,
        accountIds: isAllAccountsSelected
          ? undefined
          : selectedAccountIds.length > 0
            ? selectedAccountIds
            : undefined,
      });
    },
    enabled: !accountsLoading,
    staleTime: 60 * 1000,
    gcTime: 60 * 1000,
  });

  const displayState = useMemo((): InsightState => {
    if (query.data !== undefined) {
      return query.data.state;
    }

    return deriveInsightStateFromFilters({
      singleAccountSelected,
      categoryActive,
      merchantActive: false,
    });
  }, [categoryActive, query.data, singleAccountSelected]);

  return {
    insights: query.data ?? null,
    displayState,
    isLoading: !accountsLoading && query.fetchStatus === 'fetching' && query.data === undefined,
    error: query.error ? 'Failed to load insights.' : null,
    accountKey: cacheKey,
  };
}
