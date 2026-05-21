import { useQuery } from '@tanstack/react-query';
import { useAccountFilter } from '@/hooks/useAccountFilter';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { TransactionService } from '@/services/TransactionService';
import type { TransactionsInsightsResponse } from '@/types/api';
import { accountIdsCacheKey } from '@/utils/cacheKeys';
import { computeDateRange, type DateRangeKey } from '@/utils/dateRanges';

export interface UseTransactionsInsightsOptions {
  search: string;
  selectedCategory: string | null;
  dateRange?: string;
}

export interface UseTransactionsInsightsResult {
  insights: TransactionsInsightsResponse | null;
  isLoading: boolean;
  loading: boolean;
  error: string | null;
}

export function useTransactionsInsights(
  options: UseTransactionsInsightsOptions
): UseTransactionsInsightsResult {
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

  const query = useQuery({
    queryKey: [
      'transactions',
      'insights',
      normalizedSearch,
      selectedCategory ?? '',
      dateRange ?? '',
      cacheKey,
    ],
    queryFn: async (): Promise<TransactionsInsightsResponse> => {
      if (allAccountIds.length > 0 && selectedAccountIds.length === 0) {
        return {
          total_count: 0,
          total_spent: 0,
          average_amount: 0,
          largest: null,
          recurring_count: 0,
          recurring_merchants: [],
          top_categories: [],
        };
      }

      return TransactionService.getTransactionsInsights({
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

  const errorMessage = getQueryErrorMessage(query.error);

  return {
    insights: query.data ?? null,
    isLoading: !accountsLoading && query.fetchStatus === 'fetching' && query.data === undefined,
    loading: !accountsLoading && query.fetchStatus === 'fetching' && query.data === undefined,
    error: errorMessage,
  };
}

function getQueryErrorMessage(error: unknown): string | null {
  if (!error) {
    return null;
  }

  const status = getStatus(error);
  if (status === 401) {
    return 'You are not authenticated. Please log in again.';
  }

  return 'Failed to load transaction insights.';
}

function getStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}
