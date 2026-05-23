/**
 * Registry mapping each provider to its connection strategy.
 */
import type {
  FinancialConnectionStrategy,
  FinancialConnectionStrategyContext,
} from '@/hooks/financialConnection/types';
import { usePlaidConnectionStrategy } from '@/hooks/financialConnection/usePlaidConnectionStrategy';
import { useSimpleFinConnectionStrategy } from '@/hooks/financialConnection/useSimpleFinConnectionStrategy';
import { useTellerConnectionStrategy } from '@/hooks/financialConnection/useTellerConnectionStrategy';
import type { SyncProvider } from '@/utils/queryInvalidation';

export type UseConnectionStrategyHook = (
  context: FinancialConnectionStrategyContext
) => FinancialConnectionStrategy;

interface ConnectionProvider<P extends SyncProvider> {
  readonly provider: P;
  useStrategy: UseConnectionStrategyHook;
}

function defineConnectionProvider<P extends SyncProvider>(
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
} as const satisfies Record<SyncProvider, ConnectionProvider<SyncProvider>>;
