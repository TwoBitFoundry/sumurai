import { useQuery } from '@tanstack/react-query';
import { CategoryService } from '../../../services/CategoryService';
import type { CategoryListResponse, CustomCategory } from '../../../types/api';

export interface UseCategoriesResult {
  system: string[];
  custom: CustomCategory[];
  all: string[];
  isLoading: boolean;
  error: Error | null;
}

export function useCategories(): UseCategoriesResult {
  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: async (): Promise<CategoryListResponse> => {
      return CategoryService.listCategories();
    },
    staleTime: 60 * 1000,
    gcTime: 60 * 1000,
  });

  const system = categoriesQuery.data?.system ?? [];
  const custom = categoriesQuery.data?.custom ?? [];
  const all = [...system, ...custom.map((c) => c.display_name)];

  return {
    system,
    custom,
    all,
    isLoading: categoriesQuery.isLoading,
    error: categoriesQuery.error,
  };
}
