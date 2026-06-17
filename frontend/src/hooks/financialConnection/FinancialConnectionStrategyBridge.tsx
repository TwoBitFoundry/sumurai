import { type MutableRefObject, useLayoutEffect } from 'react';
import type {
  FinancialConnectionStrategy,
  FinancialConnectionStrategyContext,
} from '@/hooks/financialConnection/types';
import { useDiyConnectionStrategy } from '@/hooks/financialConnection/useDiyConnectionStrategy';
import { usePlaidConnectionStrategy } from '@/hooks/financialConnection/usePlaidConnectionStrategy';
import { useSimpleFinConnectionStrategy } from '@/hooks/financialConnection/useSimpleFinConnectionStrategy';
import { useTellerConnectionStrategy } from '@/hooks/financialConnection/useTellerConnectionStrategy';
import type { FinancialProvider } from '@/types/api';

interface FinancialConnectionStrategyBridgeProps {
  provider: FinancialProvider;
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

function DiyStrategyBridge({
  context,
  strategyRef,
}: Omit<FinancialConnectionStrategyBridgeProps, 'provider'>) {
  const strategy = useDiyConnectionStrategy(context);

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
    case 'diy':
      return <DiyStrategyBridge context={context} strategyRef={strategyRef} />;
  }
}
