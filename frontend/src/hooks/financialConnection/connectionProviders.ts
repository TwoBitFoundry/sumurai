/**
 * Registry mapping each provider to its connection strategy.
 */
import { useMemo } from 'react';
import type {
  FinancialConnectionStrategy,
  FinancialConnectionStrategyContext,
} from '@/hooks/financialConnection/types';
import { useDiyConnectionStrategy } from '@/hooks/financialConnection/useDiyConnectionStrategy';
import { usePlaidConnectionStrategy } from '@/hooks/financialConnection/usePlaidConnectionStrategy';
import { useSimpleFinConnectionStrategy } from '@/hooks/financialConnection/useSimpleFinConnectionStrategy';
import type { FinancialProvider } from '@/types/api';

export type UseConnectionStrategyHook = (
  context: FinancialConnectionStrategyContext
) => FinancialConnectionStrategy;

interface ConnectionProvider<P extends FinancialProvider> {
  readonly provider: P;
  useStrategy: UseConnectionStrategyHook;
}

function defineConnectionProvider<P extends FinancialProvider>(
  provider: P,
  useStrategy: UseConnectionStrategyHook
): ConnectionProvider<P> {
  return {
    provider,
    useStrategy,
  };
}

function useLegacyTellerConnectionStrategy(
  _context: FinancialConnectionStrategyContext
): FinancialConnectionStrategy {
  return useMemo(
    () => ({
      getReady: () => true,
      open: () => {
        throw new Error(
          'Teller is no longer supported because the provider no longer offers API access.'
        );
      },
      load: async () => {},
      reset: () => {},
      loadFailedMessage:
        'Teller is no longer supported because the provider no longer offers API access.',
      render: () => null,
      connect: async () => {
        throw new Error(
          'Teller is no longer supported because the provider no longer offers API access.'
        );
      },
    }),
    []
  );
}

export const connectionProviders = {
  plaid: defineConnectionProvider('plaid', usePlaidConnectionStrategy),
  teller: defineConnectionProvider('teller', useLegacyTellerConnectionStrategy),
  simplefin: defineConnectionProvider('simplefin', useSimpleFinConnectionStrategy),
  diy: defineConnectionProvider('diy', useDiyConnectionStrategy),
} as const satisfies Record<FinancialProvider, ConnectionProvider<FinancialProvider>>;
