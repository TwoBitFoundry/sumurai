/**
 * Owns transaction list filter state.
 */

import { useCallback, useState } from 'react';
import {
  getSessionTransactionsCategory,
  getSessionTransactionsPage,
  getSessionTransactionsSearch,
  setSessionTransactionsCategory,
  setSessionTransactionsPage,
  setSessionTransactionsSearch,
} from '@/utils/sessionPreferences';

export function useTransactionFilterState(initial?: { search?: string; category?: string | null }) {
  const [search, setSearchState] = useState(
    () => initial?.search ?? getSessionTransactionsSearch() ?? ''
  );
  const [selectedCategory, setSelectedCategoryState] = useState<string | null>(
    () => initial?.category ?? getSessionTransactionsCategory() ?? null
  );
  const [currentPage, setCurrentPageState] = useState(() => getSessionTransactionsPage() ?? 1);

  const setCurrentPage = useCallback((page: number) => {
    setCurrentPageState(page);
    setSessionTransactionsPage(page);
  }, []);

  const setSearch = useCallback(
    (value: string) => {
      setSearchState(value);
      setSessionTransactionsSearch(value);
      setCurrentPage(1);
    },
    [setCurrentPage]
  );

  const setSelectedCategory = useCallback(
    (value: string | null) => {
      setSelectedCategoryState(value);
      setSessionTransactionsCategory(value);
      setCurrentPage(1);
    },
    [setCurrentPage]
  );

  return {
    search,
    setSearch,
    selectedCategory,
    setSelectedCategory,
    currentPage,
    setCurrentPage,
  };
}

export type TransactionFilterControl = ReturnType<typeof useTransactionFilterState>;
