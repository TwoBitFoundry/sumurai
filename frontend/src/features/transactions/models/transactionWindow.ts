import type { Transaction } from '../../../types/api';

export interface TransactionWindowFilters {
  search?: string;
  categoryPrimary?: string;
  accountIds?: string[];
  startDate?: string;
  endDate?: string;
  merchant?: string;
  sort?: 'date' | 'amount' | 'merchant' | 'category';
  order?: 'asc' | 'desc';
}

export type TransactionListContext =
  | { type: 'category'; category: string }
  | { type: 'account'; accountId: string }
  | { type: 'merchant'; merchant: string }
  | { type: 'budget'; category: string; startDate: string; endDate: string };

export function transactionListContextsEqual(
  left: TransactionListContext,
  right: TransactionListContext
): boolean {
  if (left.type !== right.type) {
    return false;
  }

  switch (left.type) {
    case 'category':
      return right.type === 'category' && left.category === right.category;
    case 'merchant':
      return right.type === 'merchant' && left.merchant === right.merchant;
    case 'account':
      return right.type === 'account' && left.accountId === right.accountId;
    case 'budget':
      return (
        right.type === 'budget' &&
        left.category === right.category &&
        left.startDate === right.startDate &&
        left.endDate === right.endDate
      );
  }
}

export interface TransactionWindowRow {
  transaction: Transaction;
}

export interface TransactionWindowResult {
  rows: Transaction[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isInitialLoading: boolean;
  error: Error | null;
  fetchNextPage: () => void;
  limit: number;
}
