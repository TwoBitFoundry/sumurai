'use client';

import { useCallback, useState } from 'react';
import { ProviderSelectionPanel } from '@/features/plaid/components/ProviderSelectionPanel';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useProviderCatalog } from '@/hooks/useProviderCatalog';
import { useScrollDetection } from '@/hooks/useScrollDetection';
import { AuthService } from '@/services/authService';
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
  const [selectingProvider, setSelectingProvider] = useState<
    (typeof providerCatalog.availableProviders)[number] | null
  >(null);
  const [isCompleting, setIsCompleting] = useState(false);

  const handleSelectProvider = useCallback(
    async (provider: (typeof providerCatalog.availableProviders)[number]) => {
      setSelectingProvider(provider);

      try {
        await providerCatalog.chooseProvider(provider);
      } finally {
        setSelectingProvider(null);
      }
    },
    [providerCatalog]
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

  const canContinue = Boolean(providerCatalog.userProvider);

  return (
    <GradientShell>
      <div className={cn('flex', 'min-h-screen', 'flex-col')}>
        <AppTitleBar
          state="onboarding"
          scrolled={scrolled}
          isOnline={isOnline}
          onLogout={onLogout}
        />

        <main className={cn('flex-1', 'px-4', 'py-8')}>
          <div className={cn('mx-auto', 'flex', 'w-full', 'max-w-7xl', 'flex-col', 'gap-6')}>
            <ProviderSelectionPanel
              loading={providerCatalog.loading}
              error={providerCatalog.error}
              availableProviders={providerCatalog.availableProviders}
              tellerApplicationId={providerCatalog.tellerApplicationId}
              selectingProvider={selectingProvider}
              onSelectProvider={handleSelectProvider}
            />

            <div
              className={cn(
                'flex',
                'w-full',
                'flex-col',
                'items-start',
                'justify-end',
                'gap-3',
                'sm:flex-row',
                'sm:items-center',
                'sm:justify-start'
              )}
            >
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => void completeAndExit()}
                disabled={isCompleting}
              >
                Skip for now
              </Button>

              <Button
                type="button"
                variant="connect"
                size="md"
                onClick={() => void completeAndExit()}
                disabled={!canContinue || isCompleting}
              >
                Continue
              </Button>
            </div>
          </div>
        </main>
      </div>
    </GradientShell>
  );
}

export default OnboardingProviderPicker;
