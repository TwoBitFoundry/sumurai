/**
 * Loads transaction category options.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAccountFilter } from '@/hooks/useAccountFilter';
import { TransactionService } from '@/services/TransactionService';
import { mergeTransactionFilterCategories } from '@/utils/categories';
import { useCategories } from './useCategories';

export function useTransactionCategories() {
  const { loading: accountsLoading } = useAccountFilter();
  const { custom, isLoading: categoriesLoading } = useCategories();

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

  const categories = useMemo(
    () => mergeTransactionFilterCategories(categoriesQuery.data ?? [], custom),
    [categoriesQuery.data, custom]
  );

  return {
    categories,
    loading: categoriesQuery.isLoading || categoriesLoading,
  };
}
