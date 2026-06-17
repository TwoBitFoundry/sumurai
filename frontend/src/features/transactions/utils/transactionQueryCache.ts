import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { CursorTransactionsResponse, Transaction } from '@/types/api';

export const TRANSACTIONS_QUERY_ROOT_KEY = ['transactions'] as const;
export const TRANSACTIONS_INFINITE_QUERY_KEY = ['transactions', 'infinite'] as const;

export type TransactionQueryResetMode = 'reset' | 'remove';

export async function resetTransactionQueries(
  queryClient: QueryClient,
  mode: TransactionQueryResetMode
): Promise<void> {
  await queryClient.cancelQueries({ queryKey: TRANSACTIONS_QUERY_ROOT_KEY });
  if (mode === 'remove') {
    queryClient.removeQueries({ queryKey: TRANSACTIONS_QUERY_ROOT_KEY });
    return;
  }
  await queryClient.resetQueries({ queryKey: TRANSACTIONS_QUERY_ROOT_KEY });
}

export type TransactionCategoryUpdate = {
  transactionId: string;
  categoryName: string;
  isCustom: boolean;
};

export function withUpdatedTransactionCategory(
  transaction: Transaction,
  update: TransactionCategoryUpdate
): Transaction {
  if (transaction.id !== update.transactionId) {
    return transaction;
  }

  return {
    ...transaction,
    category: {
      ...transaction.category,
      primary: update.categoryName,
      is_custom: update.isCustom,
      is_overridden: true,
    },
  };
}

export function withUpdatedTransactionCategoryInInfiniteData(
  data: InfiniteData<CursorTransactionsResponse>,
  update: TransactionCategoryUpdate
): InfiniteData<CursorTransactionsResponse> {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      transactions: page.transactions.map((transaction) =>
        withUpdatedTransactionCategory(transaction, update)
      ),
    })),
  };
}
