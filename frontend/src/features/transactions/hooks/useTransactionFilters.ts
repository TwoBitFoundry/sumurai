import { useEffect, useMemo, useState } from 'react';
import { useAccountFilter } from '../../../hooks/useAccountFilter';
import { accountIdsCacheKey } from '../../../utils/cacheKeys';
import type { TransactionWindowFilters } from '../models/transactionWindow';

function useDebounce<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setV(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return v;
}

export interface TransactionFiltersResult {
  resolvedFilters: {
    search?: string;
    categoryPrimary?: string;
    accountIds?: string[];
    startDate?: string;
    endDate?: string;
    merchant?: string;
  };
  filterKey: string;
  accountsReady: boolean;
  isAllAccountsSelected: boolean;
}

export function useTransactionFilters(filters: TransactionWindowFilters): TransactionFiltersResult {
  const {
    selectedAccountIds,
    isAllAccountsSelected,
    allAccountIds,
    loading: accountsLoading,
  } = useAccountFilter();

  const debouncedSearch = useDebounce(filters.search ?? '', 300);
  const searchKey = debouncedSearch.trim().toLowerCase();
  const accountKey = selectedAccountIds.join(',');

  const filterKey = useMemo(() => {
    return [
      searchKey,
      filters.categoryPrimary ?? '',
      filters.startDate ?? '',
      filters.endDate ?? '',
      filters.merchant ?? '',
      accountKey,
      allAccountIds.join(','),
      isAllAccountsSelected ? 'all' : 'subset',
    ].join('|');
  }, [
    searchKey,
    filters.categoryPrimary,
    filters.startDate,
    filters.endDate,
    filters.merchant,
    accountKey,
    allAccountIds,
    isAllAccountsSelected,
  ]);

  const cacheKey = accountIdsCacheKey(allAccountIds, selectedAccountIds, isAllAccountsSelected);
  void cacheKey;

  const accountsReady =
    !accountsLoading && (allAccountIds.length === 0 || selectedAccountIds.length > 0);

  const effectiveAccountIds =
    allAccountIds.length > 0 && selectedAccountIds.length === 0
      ? null
      : isAllAccountsSelected
        ? undefined
        : selectedAccountIds.length > 0
          ? selectedAccountIds
          : undefined;

  const resolvedFilters = {
    search: searchKey || undefined,
    categoryPrimary: filters.categoryPrimary || undefined,
    accountIds: effectiveAccountIds === null ? [] : effectiveAccountIds,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    merchant: filters.merchant || undefined,
  };

  return { resolvedFilters, filterKey, accountsReady, isAllAccountsSelected };
}
