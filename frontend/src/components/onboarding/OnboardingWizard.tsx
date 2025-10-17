import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import { cva } from 'class-variance-authority'
import { Check } from 'lucide-react'
import { AppHeader } from '@/components/ui/AppHeader'
import { useOnboardingWizard, type OnboardingStep } from '@/hooks/useOnboardingWizard'
import { useOnboardingPlaidFlow } from '@/hooks/useOnboardingPlaidFlow'
import { WelcomeStep } from './WelcomeStep'
import { ConnectAccountStep } from './ConnectAccountStep'
import { useTellerProviderInfo } from '@/hooks/useTellerProviderInfo'
import type { FinancialProvider } from '@/types/api'
import { useOnboardingTellerFlow } from '@/hooks/useOnboardingTellerFlow'
import { CONNECT_ACCOUNT_PROVIDER_CONTENT } from '@/utils/providerCards'
import { Button, GlassCard, GradientShell } from '@/ui/primitives'
import { cn } from '@/ui/primitives/utils'

const stepIndicatorVariants = cva(
  [
    'inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold',
    'transition-colors duration-300 ease-out',
    'backdrop-blur-[2px] backdrop-saturate-[140%]'
  ],
  {
    variants: {
      state: {
        active: [
          'border-sky-400/70 bg-sky-100/65 text-sky-600',
          'shadow-[0_12px_32px_-20px_rgba(14,165,233,0.45)]',
          'dark:border-sky-500/60 dark:bg-sky-500/15 dark:text-sky-200'
        ],
        complete: [
          'border-emerald-400/80 bg-emerald-500 text-white',
          'shadow-[0_18px_46px_-24px_rgba(16,185,129,0.65)]',
          'animate-[successFlash_400ms_ease-out]',
          'dark:border-emerald-400/70 dark:bg-emerald-500'
        ],
        idle: [
          'border-slate-200/80 bg-white text-slate-500',
          'dark:border-slate-700/70 dark:bg-slate-900 dark:text-slate-300'
        ],
      },
    },
    defaultVariants: {
      state: 'idle',
    },
  }
)

interface OnboardingWizardProps {
  onComplete: () => void
  onLogout?: () => void
}

export function OnboardingWizard({ onComplete, onLogout }: OnboardingWizardProps) {
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
  } = useOnboardingWizard()

  const providerInfo = useTellerProviderInfo()
  const resolvedDefaultProvider = (providerInfo.defaultProvider ?? 'plaid') as FinancialProvider
  const activeProvider = (providerInfo.userProvider ?? resolvedDefaultProvider) as FinancialProvider
  const providerContent = CONNECT_ACCOUNT_PROVIDER_CONTENT[activeProvider]
  const providerDisplayName = providerContent.displayName
  const providerLoading = providerInfo.loading && !providerInfo.userProvider && !providerInfo.defaultProvider

  const steps = useMemo(() => {
    const details: Record<OnboardingStep, { label: string; description: string }> = {
      welcome: {
        label: 'Welcome',
        description: 'Get oriented with Sumaura',
      },
      connectAccount: {
        label: 'Connect account',
        description: `Securely link via ${providerDisplayName}`,
      },
    }

    const order: OnboardingStep[] = ['welcome', 'connectAccount']
    return order.map(step => ({
      id: step,
      ...details[step],
    }))
  }, [providerDisplayName])

  const handleConnectionSuccess = useCallback(async (_institutionName?: string) => {
    // Don't complete wizard here - wait for user to click Continue after sync
  }, [])

  const plaidFlow = useOnboardingPlaidFlow({
    onConnectionSuccess: handleConnectionSuccess,
    onError: (error) => {
      console.error('Plaid connection error:', error)
    },
  })

  const tellerFlow = useOnboardingTellerFlow({
    applicationId: providerInfo.tellerApplicationId ?? null,
    environment: providerInfo.tellerEnvironment,
    enabled: activeProvider === 'teller',
    onConnectionSuccess: handleConnectionSuccess,
    onError: (error) => {
      console.error('Teller connection error:', error)
    },
  })

  const connectionFlow = activeProvider === 'teller' ? tellerFlow : plaidFlow

  const stepContainerRef = useRef<HTMLDivElement>(null)
  const [baselineHeight, setBaselineHeight] = useState<number | null>(null)

  useEffect(() => {
    if (isComplete) {
      onComplete()
    }
  }, [isComplete, onComplete])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const element = stepContainerRef.current
    if (!element) return

    const updateHeight = (height: number) => {
      if (height <= 0) return
      const nextHeight = Math.ceil(height) + 2
      setBaselineHeight(prev => (prev === null ? nextHeight : Math.max(prev, nextHeight)))
    }

    updateHeight(element.getBoundingClientRect().height)

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(entries => {
        for (const entry of entries) {
          updateHeight(entry.contentRect.height)
        }
      })

      observer.observe(element)
      return () => observer.disconnect()
    }
  }, [currentStep])

  const handleNext = async () => {
    if (isLastStep && currentStep === 'connectAccount' && connectionFlow.isConnected) {
      await completeWizard()
    } else {
      goToNext()
    }
  }

  const handleSkip = async () => {
    await skipWizard()
  }

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'welcome':
        return <WelcomeStep />

      case 'connectAccount':
        return (
          <ConnectAccountStep
            content={providerContent}
            providerLoading={providerLoading}
            providerError={providerInfo.error}
            onRetryProvider={providerInfo.refresh}
            tellerApplicationId={providerInfo.tellerApplicationId ?? null}
            isConnected={connectionFlow.isConnected}
            connectionInProgress={connectionFlow.connectionInProgress}
            institutionName={connectionFlow.institutionName}
            error={connectionFlow.error}
            onConnect={connectionFlow.initiateConnection}
            onRetry={connectionFlow.retryConnection}
          />
        )

      default:
        return <WelcomeStep />
    }
  }

  const canProceed = () => {
    if (currentStep === 'welcome') {
      return true
    }
    if (currentStep === 'connectAccount') {
      return connectionFlow.isConnected
    }
    return canGoNext
  }

  const stepIndicator = useMemo(() => {
    return steps.map((step, index) => {
      const isActive = stepIndex === index
      const isCompleteStep = index < stepIndex
      const state = isCompleteStep ? 'complete' : isActive ? 'active' : 'idle'

      return (
        <li key={step.id} className={cn('flex', 'items-center', 'gap-3')}>
          <span className={stepIndicatorVariants({ state })}>
            {isCompleteStep ? <Check className={cn('h-3.5', 'w-3.5')} /> : index + 1}
          </span>
          {index < steps.length - 1 && (
            <span
              className={cn(
                'h-px w-8',
                'bg-slate-200/70',
                'transition-colors duration-300 ease-out',
                'dark:bg-slate-700/70'
              )}
              aria-hidden="true"
            />
          )}
        </li>
      )
    })
  }, [stepIndex, steps])

  return (
    <GradientShell variant="auth">
      <div className={cn('flex w-full max-w-6xl flex-col gap-8')}>
        {onLogout && <AppHeader onLogout={onLogout} variant="onboarding" />}
        <GlassCard
          variant="auth"
          rounded="default"
          padding="lg"
          withInnerEffects={false}
          containerClassName={cn(
            'relative w-full overflow-hidden',
            'animate-[fadeSlideUp_400ms_ease-out]'
          )}
          className={cn('flex flex-col gap-8 lg:gap-10')}
          beforeContent={(
            <div
              className={cn(
                'pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] z-0'
              )}
            >
              <div
                className={cn(
                  'absolute inset-0 rounded-[inherit]',
                  'ring-1 ring-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-1px_0_rgba(15,23,42,0.12)]',
                  'transition-colors duration-500 ease-out',
                  'dark:ring-white/10',
                  'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(2,6,23,0.45)]'
                )}
              />
              <div
                className={cn(
                  'absolute inset-0 rounded-[inherit]',
                  'bg-[radial-gradient(120%_120%_at_14%_-8%,rgba(255,255,255,0.38)_0%,rgba(255,255,255,0.12)_42%,transparent_68%)]',
                  'opacity-80',
                  'transition-opacity duration-500 ease-out',
                  'dark:bg-[radial-gradient(120%_120%_at_16%_-10%,rgba(148,163,184,0.16)_0%,rgba(15,23,42,0.2)_38%,transparent_66%)]'
                )}
              />
              <div
                className={cn(
                  'absolute inset-0 rounded-[inherit]',
                  'bg-[radial-gradient(132%_160%_at_82%_118%,rgba(14,165,233,0.22)_0%,rgba(56,189,248,0.18)_28%,rgba(167,139,250,0.22)_56%,rgba(251,191,36,0.2)_76%,transparent_88%)]',
                  'opacity-75',
                  'transition-opacity duration-500 ease-out',
                  'dark:bg-[radial-gradient(136%_160%_at_86%_122%,rgba(56,189,248,0.35)_0%,rgba(167,139,250,0.32)_48%,rgba(248,113,113,0.28)_68%,transparent_88%)]'
                )}
              />
              <div className={cn('absolute -left-24 top-16 h-60 w-60 rounded-full bg-sky-200/25 blur-3xl', 'dark:bg-sky-500/25')} />
              <div className={cn('absolute -right-28 bottom-12 h-56 w-56 rounded-full bg-violet-200/25 blur-3xl', 'dark:bg-violet-500/30')} />
            </div>
          )}
        >
          <div className={cn('relative z-10 flex flex-col gap-8 lg:gap-10')}>
            <ol
              className={cn('absolute right-8 top-6', 'flex items-center gap-3')}
              aria-label="Onboarding steps"
            >
              {stepIndicator}
            </ol>

            <div
              ref={stepContainerRef}
              style={baselineHeight ? { minHeight: baselineHeight } : undefined}
              className={cn(
                'flex-1',
                'pt-4',
                'transition-[min-height] duration-500 ease-out'
              )}
            >
              {renderCurrentStep()}
            </div>

            <div
              className={cn(
                'flex flex-col items-start justify-between gap-3',
                'sm:flex-row sm:items-center',
                'animate-[fadeSlideUp_400ms_ease-out_200ms_backwards]'
              )}
            >
              <p className={cn('text-xs text-slate-500 transition-colors duration-300 ease-out', 'dark:text-slate-300')}>
                {providerContent.securityNote}
              </p>

              <div className={cn('flex flex-wrap items-center gap-3')}>
                {canGoBack && (
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={goToPrevious}
                    className={cn('px-5')}
                  >
                    Back
                  </Button>
                )}

                {currentStep === 'connectAccount' && (
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={handleSkip}
                    className={cn('px-5')}
                  >
                    Skip for now
                  </Button>
                )}

                <Button
                  variant={connectionFlow.isConnected && isLastStep ? 'success' : 'connect'}
                  size="lg"
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className={cn('px-6')}
                >
                  {isLastStep && connectionFlow.isConnected ? 'Get started' : 'Continue'}
                </Button>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </GradientShell>
  )
}
