import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CategoryService } from '../../../services/CategoryService';

export function useDeleteCustomCategory() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      return CategoryService.deleteCustomCategory(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'list'] });
    },
  });

  return {
    deleteCustomCategory: mutation.mutate,
    deleteCustomCategoryAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
