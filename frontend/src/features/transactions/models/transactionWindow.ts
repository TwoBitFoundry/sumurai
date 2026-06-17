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
