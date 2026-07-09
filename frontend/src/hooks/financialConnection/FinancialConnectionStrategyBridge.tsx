import { type MutableRefObject, useLayoutEffect } from 'react';
import type {
  FinancialConnectionStrategy,
  FinancialConnectionStrategyContext,
} from '@/hooks/financialConnection/types';
import { useDiyConnectionStrategy } from '@/hooks/financialConnection/useDiyConnectionStrategy';
import { usePlaidConnectionStrategy } from '@/hooks/financialConnection/usePlaidConnectionStrategy';
import { useSimpleFinConnectionStrategy } from '@/hooks/financialConnection/useSimpleFinConnectionStrategy';
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

function TellerStrategyBridge({
  strategyRef,
}: Omit<FinancialConnectionStrategyBridgeProps, 'provider' | 'context'>) {
  useLayoutEffect(() => {
    strategyRef.current = {
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
    };
  });

  return null;
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
      return <TellerStrategyBridge strategyRef={strategyRef} />;
    case 'simplefin':
      return <SimpleFinStrategyBridge context={context} strategyRef={strategyRef} />;
    case 'diy':
      return <DiyStrategyBridge context={context} strategyRef={strategyRef} />;
  }
}
