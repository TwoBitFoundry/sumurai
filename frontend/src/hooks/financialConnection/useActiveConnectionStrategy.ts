import type {
  FinancialConnectionStrategy,
  FinancialConnectionStrategyContext,
} from '@/hooks/financialConnection/types';
import type { SyncProvider } from '@/utils/queryInvalidation';

export function useActiveConnectionStrategy(
  _provider: SyncProvider,
  _context: FinancialConnectionStrategyContext
): FinancialConnectionStrategy {
  throw new Error('useActiveConnectionStrategy is no longer used');
}
