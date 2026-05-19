import { cva } from 'class-variance-authority';
import { Check } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOnboardingPlaidFlow } from '@/hooks/useOnboardingPlaidFlow';
import { useOnboardingTellerFlow } from '@/hooks/useOnboardingTellerFlow';
import { type OnboardingStep, useOnboardingWizard } from '@/hooks/useOnboardingWizard';
import { useScrollDetection } from '@/hooks/useScrollDetection';
import { useTellerProviderInfo } from '@/hooks/useTellerProviderInfo';
import type { FinancialProvider } from '@/types/api';
import { AppTitleBar, Button, GlassCard, GradientShell } from '@/ui/primitives';
import { cn } from '@/ui/primitives/utils';
import {
  border as uiBorderRecipes,
  status as uiStatusRecipes,
  surface as uiSurfaceRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { CONNECT_ACCOUNT_PROVIDER_CONTENT } from '@/utils/providerCards';

import { ConnectAccountStep } from './ConnectAccountStep';
import { WelcomeStep } from './WelcomeStep';

const stepIndicatorVariants = cva(
  [
    'inline-flex h-8 w-8 items-center justify-center rounded-full border',
    uiTypographyRecipes.label,
    'transition-colors duration-300 ease-out',
    'backdrop-blur-[2px] backdrop-saturate-[140%]',
  ],
  {
    variants: {
      state: {
        active: [
          ...uiStatusRecipes.info.border,
          ...uiStatusRecipes.info.surface,
          uiStatusRecipes.info.text,
          'shadow-[0_12px_32px_-20px_rgba(14,165,233,0.45)]',
        ],
        complete: [
          ...uiStatusRecipes.success.border,
          ...uiStatusRecipes.success.strongSurface,
          uiTextRecipes.inverse,
          'shadow-[0_18px_46px_-24px_rgba(16,185,129,0.65)]',
          'animate-[successFlash_400ms_ease-out]',
          'dark:border-[var(--color-status-success-border)]',
        ],
        idle: [...uiBorderRecipes.default, ...uiSurfaceRecipes.card, uiTextRecipes.subtle],
      },
    },
    defaultVariants: {
      state: 'idle',
    },
  }
);

interface OnboardingWizardProps {
  onComplete: () => void;
  onLogout?: () => void;
  isOnline: boolean;
}

export function OnboardingWizard({ onComplete, onLogout, isOnline }: OnboardingWizardProps) {
  const scrolled = useScrollDetection();
  const {
    currentStep,
    stepIndex,
    isComplete,
    canGoBack,
    canGoNext,
    isLastStep,
    goToNext,
    goToPrevious,
    skipWizard,
    completeWizard,
  } = useOnboardingWizard();

  const providerInfo = useTellerProviderInfo();
  const resolvedDefaultProvider = (providerInfo.defaultProvider ?? 'plaid') as FinancialProvider;
  const activeProvider = (providerInfo.userProvider ??
    resolvedDefaultProvider) as FinancialProvider;
  const providerContent = CONNECT_ACCOUNT_PROVIDER_CONTENT[activeProvider];
  const providerDisplayName = providerContent.displayName;
  const providerLoading =
    providerInfo.loading && !providerInfo.userProvider && !providerInfo.defaultProvider;

  const steps = useMemo(() => {
    const details: Record<OnboardingStep, { label: string; description: string }> = {
      welcome: {
        label: 'Welcome',
        description: 'Get oriented with Sumurai',
      },
      connectAccount: {
        label: 'Connect account',
        description: `Securely link via ${providerDisplayName}`,
      },
    };

    const order: OnboardingStep[] = ['welcome', 'connectAccount'];
    return order.map((step) => ({
      id: step,
      ...details[step],
    }));
  }, [providerDisplayName]);

  const handleConnectionSuccess = useCallback(async (_institutionName?: string) => {
    // Don't complete wizard here - wait for user to click Continue after sync
  }, []);

  const plaidFlow = useOnboardingPlaidFlow({
    isOnline,
    onConnectionSuccess: handleConnectionSuccess,
    onError: (error) => {
      console.error('Plaid connection error:', error);
    },
  });

  const tellerFlow = useOnboardingTellerFlow({
    applicationId: providerInfo.tellerApplicationId ?? null,
    environment: providerInfo.tellerEnvironment,
    enabled: activeProvider === 'teller',
    isOnline,
    onConnectionSuccess: handleConnectionSuccess,
    onError: (error) => {
      console.error('Teller connection error:', error);
    },
  });

  const connectionFlow = activeProvider === 'teller' ? tellerFlow : plaidFlow;

  const stepContainerRef = useRef<HTMLDivElement>(null);
  const stepHeightsRef = useRef<Partial<Record<OnboardingStep, number>>>({});
  const [baselineHeight, setBaselineHeight] = useState<number | null>(null);

  const measureStepBaseline = useCallback(() => {
    const element = stepContainerRef.current;
    if (!element) return;

    const currentMinHeight = element.style.minHeight;
    element.style.minHeight = '';
    const naturalHeight = element.getBoundingClientRect().height;
    element.style.minHeight = currentMinHeight;

    if (naturalHeight <= 0) return;

    const nextHeight = Math.ceil(naturalHeight);
    stepHeightsRef.current[currentStep] = nextHeight;
    const heights = Object.values(stepHeightsRef.current);
    setBaselineHeight(heights.length > 0 ? Math.max(...heights) : nextHeight);
  }, [currentStep]);

  useEffect(() => {
    if (isComplete) {
      onComplete();
    }
  }, [isComplete, onComplete]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const frame = requestAnimationFrame(() => {
      measureStepBaseline();
    });

    const element = stepContainerRef.current;
    if (!element) {
      return () => cancelAnimationFrame(frame);
    }

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            measureStepBaseline();
          })
        : null;

    resizeObserver?.observe(element);

    const handleViewportChange = () => {
      stepHeightsRef.current = {};
      setBaselineHeight(null);
      requestAnimationFrame(() => {
        measureStepBaseline();
      });
    };

    window.addEventListener('resize', handleViewportChange);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [measureStepBaseline]);

  const handleNext = async () => {
    if (isLastStep && currentStep === 'connectAccount' && connectionFlow.isConnected) {
      await completeWizard();
    } else {
      goToNext();
    }
  };

  const handleSkip = async () => {
    await skipWizard();
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'welcome':
        return <WelcomeStep />;

      case 'connectAccount':
        return (
          <ConnectAccountStep
            content={providerContent}
            providerLoading={providerLoading}
            providerError={providerInfo.error}
            onRetryProvider={providerInfo.refresh}
            tellerApplicationId={providerInfo.tellerApplicationId ?? null}
            isOnline={isOnline}
            isConnected={connectionFlow.isConnected}
            connectionInProgress={connectionFlow.connectionInProgress}
            institutionName={connectionFlow.institutionName}
            error={connectionFlow.error}
            onConnect={connectionFlow.initiateConnection}
            onRetry={connectionFlow.retryConnection}
          />
        );

      default:
        return <WelcomeStep />;
    }
  };

  const canProceed = () => {
    if (currentStep === 'welcome') {
      return true;
    }
    if (currentStep === 'connectAccount') {
      return connectionFlow.isConnected;
    }
    return canGoNext;
  };

  const stepIndicator = useMemo(() => {
    return steps.map((step, index) => {
      const isActive = stepIndex === index;
      const isCompleteStep = index < stepIndex;
      const state = isCompleteStep ? 'complete' : isActive ? 'active' : 'idle';

      return (
        <li key={step.id} className={cn('flex', 'items-center', 'gap-3')}>
          <span className={stepIndicatorVariants({ state })}>
            {isCompleteStep ? <Check className={cn('h-3.5', 'w-3.5')} /> : index + 1}
          </span>
          {index < steps.length - 1 && (
            <span
              className={cn(
                'block h-px w-10 shrink-0',
                'bg-[var(--color-border-divider)]',
                index < stepIndex && 'bg-[var(--color-status-success-border)]',
                'transition-colors duration-300 ease-out'
              )}
              aria-hidden="true"
            />
          )}
        </li>
      );
    });
  }, [stepIndex, steps]);

  return (
    <GradientShell>
      {activeProvider === 'plaid' ? plaidFlow.plaidLinkMount : null}
      {activeProvider === 'teller' ? tellerFlow.tellerConnectMount : null}
      <div className={cn('flex', 'flex-col', 'min-h-screen')}>
        <AppTitleBar
          state="onboarding"
          scrolled={scrolled}
          isOnline={isOnline}
          onLogout={onLogout}
        />

        <div className={cn('flex-1', 'flex', 'items-center', 'justify-center', 'px-4', 'py-8')}>
          <GlassCard
            variant="default"
            rounded="default"
            padding="lg"
            withInnerEffects={false}
            containerClassName={cn(
              'relative w-full max-w-6xl overflow-hidden',
              'animate-[fadeSlideUp_400ms_ease-out]'
            )}
            className={cn('flex flex-col gap-8 lg:gap-10')}
          >
            <div className={cn('relative z-10 flex flex-col gap-8 lg:gap-10')}>
              <ol className={cn('flex items-center gap-3')} aria-label="Onboarding steps">
                {stepIndicator}
              </ol>

              <div
                ref={stepContainerRef}
                style={baselineHeight ? { minHeight: baselineHeight } : undefined}
                className={cn('transition-[min-height] duration-500 ease-out')}
              >
                {renderCurrentStep()}
              </div>

              <div
                className={cn(
                  'flex flex-col items-start justify-between gap-3',
                  'md:flex-row md:items-center',
                  'animate-[fadeSlideUp_400ms_ease-out_200ms_backwards]'
                )}
              >
                <p
                  className={cn(
                    uiTypographyRecipes.caption,
                    uiTextRecipes.subtle,
                    'transition-colors',
                    'duration-300',
                    'ease-out'
                  )}
                >
                  {providerContent.securityNote}
                </p>

                <div
                  className={cn(
                    'flex w-full flex-wrap items-center justify-end gap-3',
                    'md:ml-auto md:w-auto'
                  )}
                >
                  {canGoBack && (
                    <Button variant="ghost" size="md" onClick={goToPrevious} className={cn('px-5')}>
                      Back
                    </Button>
                  )}

                  {currentStep === 'connectAccount' && (
                    <Button variant="ghost" size="md" onClick={handleSkip} className={cn('px-5')}>
                      Skip for now
                    </Button>
                  )}

                  <Button
                    variant="connect"
                    size="md"
                    onClick={handleNext}
                    disabled={!canProceed()}
                    className={cn('px-5')}
                  >
                    {isLastStep && connectionFlow.isConnected ? 'Get started' : 'Continue'}
                  </Button>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </GradientShell>
  );
}
