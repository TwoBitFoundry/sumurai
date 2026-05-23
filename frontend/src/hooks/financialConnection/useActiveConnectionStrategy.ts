/**
 * Activates the connection strategy for the current provider.
 */

import { connectionProviders } from '@/hooks/financialConnection/connectionProviders';
import type {
  FinancialConnectionStrategy,
  FinancialConnectionStrategyContext,
} from '@/hooks/financialConnection/types';
import type { SyncProvider } from '@/utils/queryInvalidation';

export function useActiveConnectionStrategy(
  provider: SyncProvider,
  context: FinancialConnectionStrategyContext
): FinancialConnectionStrategy {
  switch (provider) {
    case 'plaid':
      // biome-ignore lint/correctness/useHookAtTopLevel: keyed bridge remount
      return connectionProviders.plaid.useStrategy(context);
    case 'teller':
      // biome-ignore lint/correctness/useHookAtTopLevel: keyed bridge remount
      return connectionProviders.teller.useStrategy(context);
    case 'simplefin':
      // biome-ignore lint/correctness/useHookAtTopLevel: keyed bridge remount
      return connectionProviders.simplefin.useStrategy(context);
  }
}
