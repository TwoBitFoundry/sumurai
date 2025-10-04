import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { AppHeader } from '@/components/ui/AppHeader'
import { useOnboardingWizard, type OnboardingStep } from '@/hooks/useOnboardingWizard'
import { useOnboardingPlaidFlow } from '@/hooks/useOnboardingPlaidFlow'
import { WelcomeStep } from './WelcomeStep'
import { ConnectAccountStep } from './ConnectAccountStep'

interface OnboardingWizardProps {
  onComplete: () => void
  dark?: boolean
  setDark?: (dark: boolean) => void
  onLogout?: () => void
}

export function OnboardingWizard({ onComplete, dark = false, setDark, onLogout }: OnboardingWizardProps) {
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
    // Don't complete wizard here - wait for user to click Continue after sync
  }, [])

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

  const handleNext = async () => {
    if (isLastStep && currentStep === 'connectAccount' && plaidFlow.isConnected) {
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
      <div className="min-h-screen w-full flex flex-col relative overflow-hidden transition-colors duration-500 ease-out">
        <div className="absolute inset-0 transition-colors duration-500 ease-out">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,#f8fafc_0%,#f1f5f9_50%,#ffffff_100%)] dark:bg-[radial-gradient(ellipse_at_50%_50%,#0f172a_0%,#0a0f1b_50%,#05070d_100%)]" />
          <div className="absolute inset-0 opacity-[0.15] dark:opacity-[0.35] animate-[rotateAura_90s_linear_infinite]">
            <div className="absolute top-[10%] left-[15%] h-[500px] w-[500px] rounded-full bg-[#93c5fd] dark:bg-[#38bdf8] blur-[120px]" />
            <div className="absolute bottom-[15%] right-[10%] h-[600px] w-[600px] rounded-full bg-[#a78bfa] blur-[140px]" />
            <div className="absolute top-[40%] right-[25%] h-[400px] w-[400px] rounded-full bg-[#34d399] blur-[100px]" />
            <div className="absolute bottom-[30%] left-[20%] h-[450px] w-[450px] rounded-full bg-[#fbbf24] blur-[110px]" />
            <div className="absolute top-[60%] left-[40%] h-[350px] w-[350px] rounded-full bg-[#f87171] dark:bg-[#f87171] blur-[90px] opacity-0 dark:opacity-100" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-[#ffffff99] via-[#ffffff66] to-transparent dark:from-[#0f172ab3] dark:via-[#0f172a66] dark:to-transparent" />
        </div>
        {setDark && onLogout && (
          <AppHeader
            dark={dark}
            onToggleTheme={() => setDark(!dark)}
            onLogout={onLogout}
            variant="onboarding"
          />
        )}
        <div className="flex-1 flex items-center justify-center p-4 md:p-6 relative z-10">
          <Card className="relative w-full max-w-6xl overflow-hidden rounded-3xl border border-[#0000000d] dark:border-[#ffffff14] bg-white/70 p-5 shadow-2xl backdrop-blur-xl dark:bg-slate-900/70 md:p-6 lg:p-8 transition-all duration-500 ease-out animate-[fadeSlideUp_400ms_ease-out]">

          <div className="relative z-10 flex h-full flex-col">
            <div className="mb-6 flex items-center justify-between">
              <ol className="flex items-center gap-2" aria-label="Onboarding steps">
                {steps.map((_, index) => {
                  const isActive = stepIndex === index
                  const isCompleteStep = index < stepIndex
                  return (
                    <li key={index} className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-all duration-200 ease-out ${
                          isCompleteStep
                            ? 'border-[#10b981] bg-[#10b981] text-white animate-[successFlash_400ms_ease-out]'
                            : isActive
                              ? 'border-[#0ea5e9] bg-[#0ea5e9]/10 text-[#0ea5e9] dark:text-[#38bdf8]'
                              : 'border-[#e2e8f0] bg-white text-[#475569] dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#cbd5e1]'
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
                        <span className="h-px w-6 bg-[#e2e8f0] dark:bg-[#334155] transition-colors duration-300 ease-out" aria-hidden="true" />
                      )}
                    </li>
                  )
                })}
              </ol>
            </div>
            <div className="flex-1">
              {renderCurrentStep()}
            </div>

            <div className="mt-8 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center animate-[fadeSlideUp_400ms_ease-out_200ms_backwards]">
              <div className="flex items-center gap-2 text-xs text-[#475569] dark:text-[#cbd5e1] transition-colors duration-300 ease-out">
                🔒 Bank-level encryption keeps every credential private. Plaid only shares read-only data, so funds stay untouchable.
              </div>

              <div className="flex gap-3">
                {canGoBack && (
                  <button
                    onClick={goToPrevious}
                    className="inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-medium text-[#475569] dark:text-[#cbd5e1] transition-all duration-200 ease-out hover:bg-[#f8fafc] dark:hover:bg-[#1e293b] hover:text-[#0f172a] dark:hover:text-white"
                  >
                    Back
                  </button>
                )}

                {currentStep === 'connectAccount' && (
                  <button
                    onClick={handleSkip}
                    className="inline-flex items-center justify-center rounded-full border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] px-5 py-2 text-sm font-medium text-[#475569] dark:text-[#cbd5e1] transition-all duration-200 ease-out hover:scale-[1.03] hover:shadow-lg hover:border-[#93c5fd] dark:hover:border-[#38bdf8]"
                  >
                    Skip for now
                  </button>
                )}

                <button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#0ea5e9] to-[#a78bfa] px-6 py-2 text-sm font-semibold text-white shadow-lg transition-all duration-200 ease-out hover:scale-[1.03] hover:shadow-[0_0_24px_rgba(14,165,233,0.4)] active:scale-[0.98] active:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5e9] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 disabled:hover:shadow-lg dark:focus-visible:ring-offset-slate-900"
                >
                  {isLastStep && plaidFlow.isConnected ? 'Get started' : 'Continue'}
                </button>
              </div>
            </div>
          </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
