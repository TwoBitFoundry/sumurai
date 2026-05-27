import { type MutableRefObject, useLayoutEffect } from 'react';
import type {
  FinancialConnectionStrategy,
  FinancialConnectionStrategyContext,
} from '@/hooks/financialConnection/types';
import { usePlaidConnectionStrategy } from '@/hooks/financialConnection/usePlaidConnectionStrategy';
import { useSimpleFinConnectionStrategy } from '@/hooks/financialConnection/useSimpleFinConnectionStrategy';
import { useTellerConnectionStrategy } from '@/hooks/financialConnection/useTellerConnectionStrategy';
import type { SyncProvider } from '@/utils/queryInvalidation';

interface FinancialConnectionStrategyBridgeProps {
  provider: SyncProvider;
  context: FinancialConnectionStrategyContext;
  strategyRef: MutableRefObject<FinancialConnectionStrategy>;
}

function PlaidStrategyBridge({
  context,
  strategyRef,
}: Omit<FinancialConnectionStrategyBridgeProps, 'provider'>) {
  const strategy = usePlaidConnectionStrategy(context);

  useLayoutEffect(() => {
    strategyRef.current = strategy;
  });

  return strategy.render();
}

function TellerStrategyBridge({
  context,
  strategyRef,
}: Omit<FinancialConnectionStrategyBridgeProps, 'provider'>) {
  const strategy = useTellerConnectionStrategy(context);

  useLayoutEffect(() => {
    strategyRef.current = strategy;
  });

  return strategy.render();
}

function SimpleFinStrategyBridge({
  context,
  strategyRef,
}: Omit<FinancialConnectionStrategyBridgeProps, 'provider'>) {
  const strategy = useSimpleFinConnectionStrategy(context);

  useLayoutEffect(() => {
    strategyRef.current = strategy;
  });

  return strategy.render();
}

export function FinancialConnectionStrategyBridge({
  provider,
  context,
  strategyRef,
}: FinancialConnectionStrategyBridgeProps) {
  switch (provider) {
    case 'plaid':
      return <PlaidStrategyBridge context={context} strategyRef={strategyRef} />;
    case 'teller':
      return <TellerStrategyBridge context={context} strategyRef={strategyRef} />;
    case 'simplefin':
      return <SimpleFinStrategyBridge context={context} strategyRef={strategyRef} />;
  }
}
