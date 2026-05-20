/**
 * Loads transaction category options.
 */

import { useQuery } from '@tanstack/react-query';
import { useAccountFilter } from '@/hooks/useAccountFilter';
import { TransactionService } from '@/services/TransactionService';

export function useTransactionCategories() {
  const { loading: accountsLoading } = useAccountFilter();

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

  return {
    categories: categoriesQuery.data ?? [],
    loading: categoriesQuery.isLoading,
  };
}
