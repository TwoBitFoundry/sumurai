import React, { useEffect, useCallback, useMemo } from 'react'
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
import { Badge, Button, GlassCard, GradientShell, cn } from '@/ui/primitives'

const stepIndicatorVariants = cva(
  ['flex', 'h-8', 'w-8', 'items-center', 'justify-center', 'rounded-full', 'border', 'text-xs', 'font-semibold', 'transition-colors'],
  {
    variants: {
      state: {
        active: ['border-sky-400', 'bg-sky-50', 'text-sky-600', 'dark:border-sky-500', 'dark:text-sky-200'],
        complete: ['border-emerald-400', 'bg-emerald-500', 'text-white', 'dark:border-emerald-500', 'dark:bg-emerald-500'],
        idle: ['border-slate-200', 'bg-white', 'text-slate-500', 'dark:border-slate-600', 'dark:bg-slate-900'],
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

  useEffect(() => {
    if (isComplete) {
      onComplete()
    }
  }, [isComplete, onComplete])

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
            provider={activeProvider}
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
    return steps.map((_, index) => {
      const isActive = stepIndex === index
      const isCompleteStep = index < stepIndex
      const state = isCompleteStep ? 'complete' : isActive ? 'active' : 'idle'
      return (
        <li key={index} className={cn('flex', 'items-center', 'gap-2')}>
          <span className={stepIndicatorVariants({ state })}>
            {isCompleteStep ? <Check className={cn('h-3.5', 'w-3.5')} /> : index + 1}
          </span>
          {index < steps.length - 1 && <span className={cn('h-px', 'w-6', 'bg-slate-200', 'dark:bg-slate-700')} aria-hidden="true" />}
        </li>
      )
    })
  }, [stepIndex, steps])

  return (
    <GradientShell variant="auth">
      <div className={cn('flex', 'w-full', 'max-w-6xl', 'flex-col', 'gap-6')}>
        {onLogout && <AppHeader onLogout={onLogout} variant="onboarding" />}
        <GlassCard
          containerClassName="w-full animate-[fadeSlideUp_400ms_ease-out]"
          rounded="xl"
          padding="lg"
          className={cn('flex', 'flex-col', 'gap-6')}
        >
          <div className={cn('flex', 'flex-wrap', 'items-start', 'justify-between', 'gap-4')}>
            <div className={cn('flex', 'flex-col', 'gap-2')}>
              <Badge variant="primary" size="sm">
                {steps[stepIndex]?.label}
              </Badge>
              <div className={cn('flex', 'flex-col', 'gap-1')}>
                <h1 className={cn('text-2xl', 'font-semibold', 'text-slate-900', 'dark:text-white')}>
                  {steps[stepIndex]?.description}
                </h1>
                <p className={cn('text-sm', 'text-slate-500', 'dark:text-slate-300')}>
                  Step {stepIndex + 1} of {steps.length}
                </p>
              </div>
            </div>
            <ol className={cn('flex', 'flex-wrap', 'items-center', 'gap-2')} aria-label="Onboarding steps">
              {stepIndicator}
            </ol>
          </div>

          <div className="flex-1">
            {renderCurrentStep()}
          </div>

          <div
            className={cn(
              'flex flex-col items-start gap-3',
              'sm:flex-row sm:items-center sm:justify-between'
            )}
          >
            <p className={cn('text-xs', 'text-slate-500', 'dark:text-slate-300')}>
              {providerContent.securityNote}
            </p>

            <div className={cn('flex', 'flex-wrap', 'gap-2')}>
              {canGoBack && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToPrevious}
                  className="px-5"
                >
                  Back
                </Button>
              )}

              {currentStep === 'connectAccount' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSkip}
                  className="px-5"
                >
                  Skip for now
                </Button>
              )}

              <Button
                variant="connect"
                size="lg"
                onClick={handleNext}
                disabled={!canProceed()}
                className={cn('px-6')}
              >
                {isLastStep && connectionFlow.isConnected ? 'Get started' : 'Continue'}
              </Button>
            </div>
          </div>
        </GlassCard>
      </div>
    </GradientShell>
  )
}
