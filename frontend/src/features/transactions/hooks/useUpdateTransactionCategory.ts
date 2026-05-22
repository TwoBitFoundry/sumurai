import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TransactionService } from '../../../services/TransactionService';
import type { PaginatedTransactionsResponse, Transaction } from '../../../types/api';

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
      await queryClient.cancelQueries({ queryKey: ['transactions'] });

      const transactionsData = queryClient.getQueryData<PaginatedTransactionsResponse>([
        'transactions',
        'list',
      ]);
      const previous = transactionsData ? { ...transactionsData } : null;

      queryClient.setQueryData<PaginatedTransactionsResponse>(['transactions', 'list'], (old) => {
        if (!old) return old;
        return {
          ...old,
          transactions: old.transactions.map((txn) =>
            txn.id === variables.transactionId
              ? {
                  ...txn,
                  category: {
                    ...txn.category,
                    primary: variables.categoryName,
                    is_custom: variables.isCustom,
                    is_overridden: true,
                  },
                }
              : txn
          ),
        };
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['transactions', 'list'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', 'list'] });
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
