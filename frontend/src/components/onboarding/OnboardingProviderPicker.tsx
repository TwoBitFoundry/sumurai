'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { OnboardingProviderConnectModal } from '@/components/onboarding/OnboardingProviderConnectModal';
import { DiyInstitutionModal } from '@/features/diy/DiyInstitutionModal';
import { ProviderSelectionPanel } from '@/features/plaid/components/ProviderSelectionPanel';
import { useFinancialConnection } from '@/hooks/useFinancialConnection';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useProviderCatalog } from '@/hooks/useProviderCatalog';
import { useScrollDetection } from '@/hooks/useScrollDetection';
import { AuthService } from '@/services/authService';
import type { FinancialProvider } from '@/types/api';
import { AppTitleBar, GradientShell } from '@/ui/primitives';
import { cn } from '@/ui/primitives/utils';
import { appLayout } from '@/ui/recipes';

interface OnboardingProviderPickerProps {
  onComplete: () => void;
  onBack?: () => void;
  onLogout?: () => void;
}

export function OnboardingProviderPicker({
  onComplete,
  onBack,
  onLogout,
}: OnboardingProviderPickerProps) {
  const scrolled = useScrollDetection();
  const isOnline = useOnlineStatus();
  const providerCatalog = useProviderCatalog();
  const [connectingProvider, setConnectingProvider] = useState<FinancialProvider | null>(null);
  const [isDiyModalOpen, setIsDiyModalOpen] = useState(false);
  const plaidConnectionFlow = useFinancialConnection({
    provider: 'plaid',
    isOnline,
  });
  const prevInProgressRef = useRef(false);
  const providerReadyState = {
    plaid: plaidConnectionFlow.isReady,
    simplefin: true,
  } satisfies Partial<Record<FinancialProvider, boolean>>;

  const activeConnectionFlow = connectingProvider === 'plaid' ? plaidConnectionFlow : null;

  const handleSelectProvider = useCallback(
    async (provider: FinancialProvider) => {
      if (provider === 'diy') {
        setIsDiyModalOpen(true);
        return;
      }

      if (provider === 'teller') {
        return;
      }

      setConnectingProvider(provider);
      if (provider === 'plaid') {
        await plaidConnectionFlow.initiateConnection();
      }
    },
    [plaidConnectionFlow]
  );

  const completeAndExit = useCallback(async () => {
    await AuthService.completeOnboarding();
    onComplete();
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

  const handleDiyComplete = useCallback(
    async (_connectionId: string) => {
      try {
        await providerCatalog.chooseProvider('diy');
      } catch (err) {
        console.warn('Failed to select DIY provider after institution creation', err);
      } finally {
        setIsDiyModalOpen(false);
      }
      await completeAndExit();
    },
    [completeAndExit, providerCatalog]
  );

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

        <main className={cn('flex', 'flex-1', 'items-start', 'pt-3', 'pb-8', 'md:pt-6', 'lg:pt-8')}>
          <div
            className={cn(
              ...appLayout.contentShellWithGutter,
              'flex',
              'min-w-0',
              'flex-col',
              'gap-6'
            )}
          >
            <ProviderSelectionPanel
              loading={providerCatalog.loading}
              error={providerCatalog.error}
              availableProviders={providerCatalog.availableProviders}
              providerReadyState={providerReadyState}
              connectingProvider={connectingProvider}
              onSelectProvider={handleSelectProvider}
              onBack={onBack}
            />
          </div>
        </main>

        <div hidden>{plaidConnectionFlow.connectionMount}</div>

        {connectingProvider === 'simplefin' ? (
          <OnboardingProviderConnectModal
            provider={connectingProvider}
            isOpen
            onClose={handleConnectClose}
            onConnected={handleConnectComplete}
          />
        ) : null}
        <DiyInstitutionModal
          isOpen={isDiyModalOpen}
          onClose={() => setIsDiyModalOpen(false)}
          onComplete={handleDiyComplete}
        />
      </div>
    </GradientShell>
  );
}

export default OnboardingProviderPicker;
