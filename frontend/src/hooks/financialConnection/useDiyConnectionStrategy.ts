import { useMemo } from 'react';
import type { FinancialConnectionStrategy, FinancialConnectionStrategyContext } from './types';

export function useDiyConnectionStrategy(
  _context: FinancialConnectionStrategyContext
): FinancialConnectionStrategy {
  return useMemo(
    () => ({
      getReady: () => true,
      open: () => {},
      load: async () => {},
      reset: () => {},
      loadFailedMessage: '',
      render: () => null,
    }),
    []
  );
}
