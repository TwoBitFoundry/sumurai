import { type MutableRefObject, useLayoutEffect } from 'react';
import type {
  FinancialConnectionStrategy,
  FinancialConnectionStrategyContext,
} from '@/hooks/financialConnection/types';
import { useActiveConnectionStrategy } from '@/hooks/financialConnection/useActiveConnectionStrategy';
import type { SyncProvider } from '@/utils/queryInvalidation';

interface FinancialConnectionStrategyBridgeProps {
  provider: SyncProvider;
  context: FinancialConnectionStrategyContext;
  strategyRef: MutableRefObject<FinancialConnectionStrategy>;
}

export function FinancialConnectionStrategyBridge({
  provider,
  context,
  strategyRef,
}: FinancialConnectionStrategyBridgeProps) {
  const strategy = useActiveConnectionStrategy(provider, context);

  useLayoutEffect(() => {
    strategyRef.current = strategy;
  });

  return strategy.render();
}
