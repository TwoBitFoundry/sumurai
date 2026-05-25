'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { OnboardingProviderConnectModal } from '@/components/onboarding/OnboardingProviderConnectModal';
import { ProviderSelectionPanel } from '@/features/plaid/components/ProviderSelectionPanel';
import { useFinancialConnection } from '@/hooks/useFinancialConnection';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useProviderCatalog } from '@/hooks/useProviderCatalog';
import { useScrollDetection } from '@/hooks/useScrollDetection';
import { AuthService } from '@/services/authService';
import type { FinancialProvider } from '@/types/api';
import { AppTitleBar, Button, GradientShell } from '@/ui/primitives';
import { cn } from '@/ui/primitives/utils';

interface OnboardingProviderPickerProps {
  onComplete: () => void;
  onLogout?: () => void;
}

export function OnboardingProviderPicker({ onComplete, onLogout }: OnboardingProviderPickerProps) {
  const scrolled = useScrollDetection();
  const isOnline = useOnlineStatus();
  const providerCatalog = useProviderCatalog();
  const [connectingProvider, setConnectingProvider] = useState<FinancialProvider | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const plaidConnectionFlow = useFinancialConnection({
    provider: 'plaid',
    isOnline,
  });
  const tellerConnectionFlow = useFinancialConnection({
    provider: 'teller',
    isOnline,
  });
  const prevInProgressRef = useRef(false);
  const providerReadyState = {
    plaid: plaidConnectionFlow.isReady,
    teller: tellerConnectionFlow.isReady,
    simplefin: true,
  } satisfies Partial<Record<FinancialProvider, boolean>>;

  const activeConnectionFlow =
    connectingProvider === 'plaid'
      ? plaidConnectionFlow
      : connectingProvider === 'teller'
        ? tellerConnectionFlow
        : null;

  const handleSelectProvider = useCallback(
    async (provider: FinancialProvider) => {
      setConnectingProvider(provider);
      if (provider === 'plaid') {
        await plaidConnectionFlow.initiateConnection();
      }
      if (provider === 'teller') {
        await tellerConnectionFlow.initiateConnection();
      }
    },
    [plaidConnectionFlow, tellerConnectionFlow]
  );

  const completeAndExit = useCallback(async () => {
    setIsCompleting(true);
    try {
      await AuthService.completeOnboarding();
      onComplete();
    } finally {
      setIsCompleting(false);
    }
  }, [onComplete]);

  const handleConnectComplete = useCallback(
    async (provider: (typeof providerCatalog.availableProviders)[number]) => {
      try {
        await providerCatalog.chooseProvider(provider);
      } catch (err) {
        console.warn('Failed to select provider after connection', err);
      }
      await completeAndExit();
    },
    [completeAndExit, providerCatalog]
  );

  const handleConnectClose = useCallback(() => {
    setConnectingProvider(null);
  }, []);

  useEffect(() => {
    if (!activeConnectionFlow || connectingProvider === 'simplefin') {
      prevInProgressRef.current = false;
      return;
    }

    const wasInProgress = prevInProgressRef.current;
    prevInProgressRef.current = activeConnectionFlow.connectionInProgress;

    if (
      wasInProgress &&
      !activeConnectionFlow.connectionInProgress &&
      !activeConnectionFlow.isConnected
    ) {
      setConnectingProvider(null);
    }
  }, [activeConnectionFlow, connectingProvider]);

  useEffect(() => {
    if (!activeConnectionFlow || !connectingProvider || connectingProvider === 'simplefin') {
      return;
    }

    if (
      activeConnectionFlow.isConnected &&
      !activeConnectionFlow.connectionInProgress &&
      !activeConnectionFlow.isSyncing
    ) {
      void handleConnectComplete(connectingProvider);
    }
  }, [activeConnectionFlow, connectingProvider, handleConnectComplete]);

  return (
    <GradientShell>
      <div className={cn('flex', 'min-h-screen', 'flex-col')}>
        <AppTitleBar
          state="onboarding"
          scrolled={scrolled}
          isOnline={isOnline}
          onLogout={onLogout}
        />

        <main className={cn('flex', 'flex-1', 'items-center', 'px-4', 'py-8')}>
          <div className={cn('mx-auto', 'flex', 'w-full', 'max-w-7xl', 'flex-col', 'gap-6')}>
            <ProviderSelectionPanel
              loading={providerCatalog.loading}
              error={providerCatalog.error}
              availableProviders={providerCatalog.availableProviders}
              tellerApplicationId={providerCatalog.tellerApplicationId}
              providerReadyState={providerReadyState}
              connectingProvider={connectingProvider}
              onSelectProvider={handleSelectProvider}
              footerContent={
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={() => void completeAndExit()}
                  disabled={isCompleting}
                >
                  Skip for now
                </Button>
              }
            />
          </div>
        </main>

        <div hidden>
          {plaidConnectionFlow.connectionMount}
          {tellerConnectionFlow.connectionMount}
        </div>

        {connectingProvider === 'simplefin' ? (
          <OnboardingProviderConnectModal
            provider={connectingProvider}
            isOpen
            onClose={handleConnectClose}
            onConnected={handleConnectComplete}
          />
        ) : null}
      </div>
    </GradientShell>
  );
}

export default OnboardingProviderPicker;
