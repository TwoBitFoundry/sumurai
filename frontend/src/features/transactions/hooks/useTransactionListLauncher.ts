import { createContext, type RefObject, useContext } from 'react';
import type { TransactionListContext } from '@/features/transactions/models/transactionWindow';

export interface TransactionListLauncherContextType {
  openTransactionList: (context: TransactionListContext, anchorRef: RefObject<HTMLElement>) => void;
  close: () => void;
}

export const TransactionListLauncherContext =
  createContext<TransactionListLauncherContextType | null>(null);

export function useTransactionListLauncher(): TransactionListLauncherContextType {
  const ctx = useContext(TransactionListLauncherContext);
  if (!ctx) {
    throw new Error(
      'useTransactionListLauncher must be used within a TransactionListLauncherProvider'
    );
  }
  return ctx;
}
