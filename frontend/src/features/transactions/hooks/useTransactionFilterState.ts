/**
 * Owns transaction list filter state.
 */

import { useCallback, useState } from 'react';
import {
  getSessionTransactionsCategory,
  getSessionTransactionsSearch,
  setSessionTransactionsCategory,
  setSessionTransactionsSearch,
} from '@/utils/sessionPreferences';

export function useTransactionFilterState(initial?: { search?: string; category?: string | null }) {
  const [search, setSearchState] = useState(
    () => initial?.search ?? getSessionTransactionsSearch() ?? ''
  );
  const [selectedCategory, setSelectedCategoryState] = useState<string | null>(
    () => initial?.category ?? getSessionTransactionsCategory() ?? null
  );

  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    setSessionTransactionsSearch(value);
  }, []);

  const setSelectedCategory = useCallback((value: string | null) => {
    setSelectedCategoryState(value);
    setSessionTransactionsCategory(value);
  }, []);

  return {
    search,
    setSearch,
    selectedCategory,
    setSelectedCategory,
  };
}

export type TransactionFilterControl = ReturnType<typeof useTransactionFilterState>;
