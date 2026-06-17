/**
 * Registry mapping each provider to its connection strategy.
 */
import type {
  FinancialConnectionStrategy,
  FinancialConnectionStrategyContext,
} from '@/hooks/financialConnection/types';
import { useDiyConnectionStrategy } from '@/hooks/financialConnection/useDiyConnectionStrategy';
import { usePlaidConnectionStrategy } from '@/hooks/financialConnection/usePlaidConnectionStrategy';
import { useSimpleFinConnectionStrategy } from '@/hooks/financialConnection/useSimpleFinConnectionStrategy';
import { useTellerConnectionStrategy } from '@/hooks/financialConnection/useTellerConnectionStrategy';
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

export const connectionProviders = {
  plaid: defineConnectionProvider('plaid', usePlaidConnectionStrategy),
  teller: defineConnectionProvider('teller', useTellerConnectionStrategy),
  simplefin: defineConnectionProvider('simplefin', useSimpleFinConnectionStrategy),
  diy: defineConnectionProvider('diy', useDiyConnectionStrategy),
} as const satisfies Record<FinancialProvider, ConnectionProvider<FinancialProvider>>;
