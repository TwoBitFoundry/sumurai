import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { useOnboardingWizard, type OnboardingStep } from '@/hooks/useOnboardingWizard'
import { useOnboardingPlaidFlow } from '@/hooks/useOnboardingPlaidFlow'
import { WelcomeStep } from './WelcomeStep'
import { ConnectAccountStep } from './ConnectAccountStep'

interface OnboardingWizardProps {
  onComplete: () => void
  dark?: boolean
}

export function OnboardingWizard({ onComplete, dark = false }: OnboardingWizardProps) {
  const {
    currentStep,
    stepIndex,
    isComplete,
    canGoBack,
    canGoNext,
    isLastStep,
    progress,
    goToNext,
    goToPrevious,
    skipWizard,
    completeWizard,
  } = useOnboardingWizard()

  const stepContainerRef = useRef<HTMLDivElement>(null)
  const [baselineHeight, setBaselineHeight] = useState<number | null>(null)

  const steps = useMemo(() => {
    const details: Record<OnboardingStep, { label: string; description: string }> = {
      welcome: {
        label: 'Welcome',
        description: 'Get oriented with Sumaura',
      },
      connectAccount: {
        label: 'Connect account',
        description: 'Securely link via Plaid',
      },
    }

    const order: OnboardingStep[] = ['welcome', 'connectAccount']
    return order.map(step => ({
      id: step,
      ...details[step],
    }))
  }, [])

  const handleConnectionSuccess = useCallback(async (_institutionName?: string) => {
    try {
      await completeWizard()
    } catch (error) {
      console.error('Failed to complete onboarding after Plaid connection:', error)
    }
  }, [completeWizard])

  const plaidFlow = useOnboardingPlaidFlow({
    onConnectionSuccess: handleConnectionSuccess,
    onError: (error) => {
      console.error('Plaid connection error:', error)
    },
  })

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
      const h = Math.ceil(height) + 2 // small buffer to avoid sub‑pixel scroll
      setBaselineHeight(prev => (prev === null ? h : Math.max(prev, h)))
    }

    updateHeight(element.getBoundingClientRect().height)

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(entries => {
        for (const entry of entries) updateHeight(entry.contentRect.height)
      })
      observer.observe(element)
      return () => observer.disconnect()
    }
  }, [currentStep])

  const handleNext = () => {
    goToNext()
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
            isConnected={plaidFlow.isConnected}
            connectionInProgress={plaidFlow.connectionInProgress}
            institutionName={plaidFlow.institutionName}
            error={plaidFlow.error}
            onConnect={plaidFlow.initiateConnection}
            onRetry={plaidFlow.retryConnection}
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
      return plaidFlow.isConnected
    }
    return canGoNext
  }

  return (
    <div className={dark ? 'dark' : ''}>
      <div className="h-dvh bg-gradient-to-br from-slate-100/80 via-slate-50 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center p-4 md:p-8">
        <Card className="relative w-full max-w-6xl overflow-hidden rounded-3xl border border-white/40 bg-white/70 p-6 shadow-2xl backdrop-blur-xl dark:border-slate-800/40 dark:bg-slate-900/70 md:p-8 lg:p-10">
          <div className="pointer-events-none absolute inset-0 opacity-60">
            <div className="absolute -left-32 top-16 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="absolute -right-24 bottom-12 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl" />
          </div>

          <div className="relative z-10 flex h-full flex-col gap-6">
            {/* Step content with simple inline stepper */}
            <div
              ref={stepContainerRef}
              className="flex-1 overflow-x-hidden overflow-y-auto md:overflow-y-hidden rounded-2xl bg-white/80 p-5 shadow-sm ring-1 ring-white/70 backdrop-blur dark:bg-slate-900/70 dark:ring-slate-800 lg:p-6"
              style={baselineHeight !== null ? { minHeight: baselineHeight } : undefined}
            >
              <div className="mb-4 flex items-center justify-between">
                <ol className="flex items-center gap-2" aria-label="Onboarding steps">
                  {steps.map((_, index) => {
                    const isActive = stepIndex === index
                    const isCompleteStep = index < stepIndex
                    return (
                      <li key={index} className="flex items-center gap-2">
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${
                            isCompleteStep
                              ? 'border-blue-500 bg-blue-500 text-white'
                              : isActive
                                ? 'border-blue-500/70 bg-blue-500/10 text-blue-600 dark:text-blue-300'
                                : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                          }`}
                        >
                          {isCompleteStep ? (
                            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                              <path d="M3.5 8.5L6.5 11.5L12.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            index + 1
                          )}
                        </span>
                        {index < steps.length - 1 && (
                          <span className="h-px w-6 bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
                        )}
                      </li>
                    )
                  })}
                </ol>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Step {stepIndex + 1} of {steps.length}
                </span>
              </div>
              {renderCurrentStep()}
            </div>

            {/* Footer actions */}
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                🔒 Bank-level encryption keeps every credential private. Plaid only shares read-only data, so funds stay untouchable.
              </div>

              <div className="flex gap-3">
                {canGoBack && (
                  <button
                    onClick={goToPrevious}
                    className="inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    Back
                  </button>
                )}

                {currentStep === 'connectAccount' && (
                  <button
                    onClick={handleSkip}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white/70 px-5 py-2 text-sm font-medium text-slate-500 transition-all hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200"
                  >
                    Skip for now
                  </button>
                )}

                {!isLastStep && (
                  <button
                    onClick={handleNext}
                    disabled={!canProceed()}
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-6 py-2 text-sm font-semibold text-white shadow-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-slate-900"
                  >
                    Continue
                  </button>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
