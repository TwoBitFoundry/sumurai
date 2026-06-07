import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAccountFilter } from '@/hooks/useAccountFilter';
import { CategoryService } from '../../../services/CategoryService';
import { TransactionService } from '../../../services/TransactionService';
import type { CategoryListResponse, CustomCategory } from '../../../types/api';
import {
  buildCategoryAccentIndex,
  mergeTransactionFilterCategories,
  sortCategoryNamesAlphabetically,
} from '../../../utils/categories';

export interface UseCategoriesResult {
  system: string[];
  custom: CustomCategory[];
  all: string[];
  filterCategories: string[];
  accentIndexByName: ReadonlyMap<string, number>;
  isLoading: boolean;
  error: Error | null;
}

export function useCategories(): UseCategoriesResult {
  const { loading: accountsLoading } = useAccountFilter();
  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: async (): Promise<CategoryListResponse> => {
      return CategoryService.listCategories();
    },
    staleTime: 60 * 1000,
    gcTime: 60 * 1000,
  });

  const transactionCategoriesQuery = useQuery({
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

  const system = categoriesQuery.data?.system ?? [];
  const custom = categoriesQuery.data?.custom ?? [];
  const all = useMemo(
    () =>
      sortCategoryNamesAlphabetically([
        ...system,
        ...custom.map((category) => category.display_name),
      ]),
    [custom, system]
  );
  const filterCategories = useMemo(
    () => mergeTransactionFilterCategories(transactionCategoriesQuery.data ?? [], custom),
    [custom, transactionCategoriesQuery.data]
  );
  const accentIndexByName = useMemo(
    () => buildCategoryAccentIndex(filterCategories),
    [filterCategories]
  );

  return {
    system,
    custom,
    all,
    filterCategories,
    accentIndexByName,
    isLoading: categoriesQuery.isLoading || transactionCategoriesQuery.isLoading,
    error: categoriesQuery.error,
  };
}
