import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { TransactionService } from '../../../services/TransactionService';
import type { Transaction } from '../../../types/api';
import type { TransactionWindowFilters } from '../models/transactionWindow';
import { useTransactionFilters } from './useTransactionFilters';

export const TRANSACTION_PAGE_LIMIT = 40;
export const PREFETCH_THRESHOLD = 5;

export interface UseInfiniteTransactionsResult {
  rows: Transaction[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  isInitialLoading: boolean;
  error: Error | null;
  limit: number;
  filterKey: string;
}

export function useInfiniteTransactions(
  filters: TransactionWindowFilters
): UseInfiniteTransactionsResult {
  const { resolvedFilters, filterKey, accountsReady } = useTransactionFilters(filters);

  const query = useInfiniteQuery({
    queryKey: ['transactions', 'infinite', filterKey],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      if (!accountsReady && resolvedFilters.accountIds?.length === 0) {
        return {
          transactions: [],
          next_cursor: null,
          prev_cursor: null,
          has_more: false,
        };
      }
      return TransactionService.getTransactionsPage({
        ...resolvedFilters,
        cursor: pageParam,
        limit: TRANSACTION_PAGE_LIMIT,
      });
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    staleTime: 60 * 1000,
    gcTime: 60 * 1000,
    enabled: accountsReady || resolvedFilters.accountIds?.length === 0,
  });

  const rows = useMemo(
    () => query.data?.pages.flatMap((page) => page.transactions) ?? [],
    [query.data]
  );

  return {
    rows,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    isInitialLoading: query.isLoading,
    error: query.error,
    limit: TRANSACTION_PAGE_LIMIT,
    filterKey,
  };
}
