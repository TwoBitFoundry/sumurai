import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAccountFilter } from '../../../hooks/useAccountFilter';
import { TransactionService } from '../../../services/TransactionService';
import type { PaginatedTransactionsResponse, Transaction } from '../../../types/api';
import { accountIdsCacheKey } from '../../../utils/cacheKeys';

export type DateRangeKey = string | undefined;

export interface UseTransactionsOptions {
  initialSearch?: string;
  initialCategory?: string | null;
  initialDateRange?: DateRangeKey;
  pageSize?: number;
}

export interface UseTransactionsResult {
  isLoading: boolean;
  loading: boolean;
  error: string | null;
  transactions: Transaction[];
  categories: string[];
  search: string;
  setSearch: (s: string) => void;
  selectedCategory: string | null;
  setSelectedCategory: (c: string | null) => void;
  dateRange: DateRangeKey;
  setDateRange: (r: DateRangeKey) => void;
  currentPage: number;
  setCurrentPage: (p: number) => void;
  pageItems: Transaction[];
  totalItems: number;
  total: number;
  totalPages: number;
}

export function useTransactions(options: UseTransactionsOptions = {}): UseTransactionsResult {
  const { initialSearch = '', initialCategory = null, initialDateRange, pageSize = 10 } = options;

  const [search, setSearchState] = useState(initialSearch);
  const [selectedCategory, setSelectedCategoryState] = useState<string | null>(initialCategory);
  const [dateRange, setDateRangeState] = useState<DateRangeKey>(initialDateRange);
  const [currentPage, setCurrentPage] = useState(1);

  const {
    selectedAccountIds,
    isAllAccountsSelected,
    allAccountIds,
    loading: accountsLoading,
  } = useAccountFilter();

  const lastFilterKeyRef = useRef<string | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const searchKey = debouncedSearch.trim().toLowerCase();
  const accountKey = selectedAccountIds.join(',');
  const filterKey = useMemo(() => {
    return [
      searchKey,
      selectedCategory ?? '',
      dateRange ?? '',
      accountKey,
      allAccountIds.join(','),
      String(pageSize),
      isAllAccountsSelected ? 'all' : 'subset',
    ].join('|');
  }, [
    accountKey,
    allAccountIds,
    dateRange,
    isAllAccountsSelected,
    pageSize,
    searchKey,
    selectedCategory,
  ]);

  const cacheKey = accountIdsCacheKey(allAccountIds, selectedAccountIds, isAllAccountsSelected);

  const query = useQuery({
    queryKey: [
      'transactions',
      'list',
      dateRange ?? '',
      cacheKey,
      searchKey,
      selectedCategory ?? '',
      currentPage,
      pageSize,
    ],
    queryFn: async (): Promise<PaginatedTransactionsResponse> => {
      if (allAccountIds.length > 0 && selectedAccountIds.length === 0) {
        return { transactions: [], total: 0, page: 1, page_size: pageSize };
      }

      const result = (await TransactionService.getTransactions({
        page: currentPage,
        page_size: pageSize,
        search: searchKey || undefined,
        categoryPrimary: selectedCategory ?? undefined,
        accountIds: isAllAccountsSelected
          ? undefined
          : selectedAccountIds.length > 0
            ? selectedAccountIds
            : undefined,
      })) as unknown as PaginatedTransactionsResponse;

      return result;
    },
    enabled: !accountsLoading,
    staleTime: 60 * 1000,
    gcTime: 60 * 1000,
  });

  const categoriesQuery = useQuery({
    queryKey: ['transactions', 'categories'],
    queryFn: async (): Promise<string[]> => {
      try {
        const serverCategories = await TransactionService.getTransactionCategories();
        return Array.isArray(serverCategories) ? serverCategories : [];
      } catch {
        return [];
      }
    },
    enabled: !accountsLoading,
    staleTime: 60 * 1000,
    gcTime: 60 * 1000,
  });

  const categories = categoriesQuery.data ?? [];

  useEffect(() => {
    if (accountsLoading) {
      return;
    }

    if (lastFilterKeyRef.current !== filterKey) {
      lastFilterKeyRef.current = filterKey;
      if (currentPage !== 1) {
        setCurrentPage(1);
      }
    }
  }, [accountsLoading, currentPage, filterKey]);

  const paginated = query.data;
  const transactions = paginated?.transactions ?? [];
  const totalItems = paginated?.total ?? 0;

  useEffect(() => {
    const serverPage = paginated?.page;
    if (serverPage != null && serverPage !== currentPage) {
      setCurrentPage(serverPage);
    }
  }, [paginated?.page, currentPage]);

  const errorMessage = useMemo(() => {
    const err = query.error;
    if (!err) {
      return null;
    }
    const status = getStatus(err);
    return status === 401
      ? 'You are not authenticated. Please log in again.'
      : 'Failed to load transactions.';
  }, [query.error]);

  const isLoading =
    !accountsLoading && query.fetchStatus === 'fetching' && query.data === undefined;

  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    setCurrentPage(1);
  }, []);

  const setSelectedCategory = useCallback((value: string | null) => {
    setSelectedCategoryState(value);
    setCurrentPage(1);
  }, []);

  const setDateRange = useCallback((value: DateRangeKey) => {
    setDateRangeState(value);
    setCurrentPage(1);
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  return {
    isLoading,
    loading: isLoading,
    error: errorMessage,
    transactions,
    categories,
    search,
    setSearch,
    selectedCategory,
    setSelectedCategory,
    dateRange,
    setDateRange,
    currentPage,
    setCurrentPage,
    pageItems: transactions,
    totalItems,
    total: totalItems,
    totalPages,
  };
}

function useDebounce<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setV(value), delay);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [value, delay]);
  return v;
}

function getStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}
