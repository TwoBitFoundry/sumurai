import { type InfiniteData, useMutation, useQueryClient } from '@tanstack/react-query';
import { TransactionService } from '../../../services/TransactionService';
import type { CursorTransactionsResponse } from '../../../types/api';
import {
  TRANSACTIONS_INFINITE_QUERY_KEY,
  TRANSACTIONS_QUERY_ROOT_KEY,
  withUpdatedTransactionCategoryInInfiniteData,
} from '../utils/transactionQueryCache';

interface UpdateTransactionCategoryVariables {
  transactionId: string;
  categoryName: string;
  isCustom: boolean;
}

export function useUpdateTransactionCategory() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (variables: UpdateTransactionCategoryVariables): Promise<void> => {
      await TransactionService.updateTransactionCategory(
        variables.transactionId,
        variables.categoryName,
        variables.isCustom
      );
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: TRANSACTIONS_QUERY_ROOT_KEY });

      const previousInfinite = queryClient.getQueriesData<InfiniteData<CursorTransactionsResponse>>(
        {
          queryKey: TRANSACTIONS_INFINITE_QUERY_KEY,
        }
      );

      queryClient.setQueriesData<InfiniteData<CursorTransactionsResponse>>(
        { queryKey: TRANSACTIONS_INFINITE_QUERY_KEY },
        (old) => {
          if (!old) return old;
          return withUpdatedTransactionCategoryInInfiniteData(old, variables);
        }
      );

      return { previousInfinite };
    },
    onError: (_err, _vars, context) => {
      if (!context?.previousInfinite) {
        return;
      }

      for (const [queryKey, data] of context.previousInfinite) {
        queryClient.setQueryData(queryKey, data);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TRANSACTIONS_INFINITE_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  return {
    updateTransactionCategory: mutation.mutate,
    updateTransactionCategoryAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
