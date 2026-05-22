import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CategoryService } from '../../../services/CategoryService';
import type { CustomCategory } from '../../../types/api';

export function useCreateCustomCategory() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (name: string): Promise<CustomCategory> => {
      return CategoryService.createCustomCategory(name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  return {
    createCustomCategory: mutation.mutate,
    createCustomCategoryAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
