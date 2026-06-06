import { useCategories } from './useCategories';

export function useTransactionCategories() {
  const { filterCategories, isLoading } = useCategories();

  return {
    categories: filterCategories,
    loading: isLoading,
  };
}
