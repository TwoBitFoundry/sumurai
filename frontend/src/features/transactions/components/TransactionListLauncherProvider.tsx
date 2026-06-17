import { type ReactNode, type RefObject, useCallback, useMemo, useRef, useState } from 'react';
import {
  TransactionListLauncherContext,
  type TransactionListLauncherContextType,
} from '@/features/transactions/hooks/useTransactionListLauncher';
import type { TransactionListContext } from '@/features/transactions/models/transactionWindow';
import { TransactionListPopover } from './TransactionListPopover';

interface State {
  open: boolean;
  context: TransactionListContext | null;
  anchorRef: RefObject<HTMLElement> | null;
}

const CLOSED: State = { open: false, context: null, anchorRef: null };

export function TransactionListLauncherProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(CLOSED);
  const fallbackRef = useRef<HTMLElement>(null);

  const openTransactionList = useCallback(
    (context: TransactionListContext, anchorRef: RefObject<HTMLElement>) => {
      setState({ open: true, context, anchorRef });
    },
    []
  );

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const value = useMemo<TransactionListLauncherContextType>(
    () => ({ openTransactionList, close }),
    [openTransactionList, close]
  );

  return (
    <TransactionListLauncherContext.Provider value={value}>
      {children}
      {state.context && (
        <TransactionListPopover
          open={state.open}
          anchorRef={state.anchorRef ?? fallbackRef}
          context={state.context}
          onRequestClose={close}
        />
      )}
    </TransactionListLauncherContext.Provider>
  );
}
