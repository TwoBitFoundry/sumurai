import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { CategoryService } from '../../../services/CategoryService';
import type { CategoryListResponse, CustomCategory } from '../../../types/api';
import {
  buildCategoryAccentIndex,
  sortCategoryNamesAlphabetically,
} from '../../../utils/categories';

export interface UseCategoriesResult {
  system: string[];
  custom: CustomCategory[];
  all: string[];
  accentIndexByName: ReadonlyMap<string, number>;
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
  const all = useMemo(
    () =>
      sortCategoryNamesAlphabetically([
        ...system,
        ...custom.map((category) => category.display_name),
      ]),
    [custom, system]
  );
  const accentIndexByName = useMemo(() => buildCategoryAccentIndex(all), [all]);

  return {
    system,
    custom,
    all,
    accentIndexByName,
    isLoading: categoriesQuery.isLoading,
    error: categoriesQuery.error,
  };
}
