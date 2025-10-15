import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { AppHeader } from '@/components/ui/AppHeader'
import { useOnboardingWizard, type OnboardingStep } from '@/hooks/useOnboardingWizard'
import { useOnboardingPlaidFlow } from '@/hooks/useOnboardingPlaidFlow'
import { WelcomeStep } from './WelcomeStep'
import { ConnectAccountStep } from './ConnectAccountStep'
import { useTellerProviderInfo } from '@/hooks/useTellerProviderInfo'
import type { FinancialProvider } from '@/types/api'
import { useOnboardingTellerFlow } from '@/hooks/useOnboardingTellerFlow'
import { CONNECT_ACCOUNT_PROVIDER_CONTENT } from '@/utils/providerCards'

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
    progress,
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

  return (
    <div className="min-h-screen w-full flex flex-col relative overflow-hidden transition-colors duration-500 ease-out">
        <div className="pointer-events-none absolute inset-0 transition-colors duration-500 ease-out">
          <div className="absolute inset-0 transition-all duration-500 bg-[radial-gradient(120%_90%_at_20%_-10%,#f8fafc_0%,#f1f5f9_45%,#ffffff_100%)] dark:bg-[radial-gradient(90%_70%_at_20%_0%,#0f172a_0%,#0a0f1b_50%,#05070d_100%)]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute left-1/2 top-1/2 h-[70rem] w-[70rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.22] blur-3xl animate-[rotateAura_90s_linear_infinite] bg-[conic-gradient(from_0deg,#93c5fd_0deg,#34d399_140deg,#fbbf24_240deg,#a78bfa_320deg,#93c5fd_360deg)] transition-all duration-700 ease-out dark:opacity-[0.32] dark:bg-[conic-gradient(from_0deg,#38bdf8_0deg,#34d399_120deg,#a78bfa_210deg,#fbbf24_285deg,#f87171_330deg,#38bdf8_360deg)]" />
          </div>
          <div className="absolute inset-0 transition-colors duration-500 bg-gradient-to-b from-white/65 via-white/40 to-transparent dark:from-slate-900/70 dark:via-slate-900/40 dark:to-transparent" />
          <div className="absolute inset-0 transition-colors duration-500 bg-[radial-gradient(120%_120%_at_50%_50%,transparent_62%,rgba(15,23,42,0.08)_100%)] dark:bg-[radial-gradient(120%_120%_at_50%_50%,transparent_60%,rgba(2,6,23,0.35)_100%)]" />
        </div>
        {onLogout && (
          <AppHeader
            onLogout={onLogout}
            variant="onboarding"
          />
        )}
        <div className="flex-1 flex items-center justify-center p-4 md:p-6 relative z-10">
          <Card
            containerClassName="relative w-full max-w-6xl overflow-hidden rounded-[2.25rem] border border-[#0000001a] bg-white/25 shadow-[0_18px_55px_-30px_rgba(15,23,42,0.6)] backdrop-blur-[28px] backdrop-saturate-[140%] transition-all duration-500 ease-out animate-[fadeSlideUp_400ms_ease-out] dark:border-[#ffffff26] dark:bg-[#0f172a]/36 dark:shadow-[0_22px_60px_-28px_rgba(2,6,23,0.75)]"
            className="p-5 md:p-6 lg:p-8"
          >
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-[1px] rounded-[2.2rem] ring-1 ring-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(15,23,42,0.08)] dark:ring-white/8 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(2,6,23,0.4)]" />
              <div className="absolute inset-0 rounded-[2.2rem] bg-[radial-gradient(120%_120%_at_12%_-4%,rgba(255,255,255,0.32)_0%,rgba(255,255,255,0.1)_40%,transparent_66%)] opacity-70 dark:bg-[radial-gradient(120%_120%_at_14%_-6%,rgba(248,250,252,0.18)_0%,rgba(148,163,184,0.14)_32%,transparent_62%)]" />
              <div className="absolute inset-0 rounded-[2.2rem] bg-[radial-gradient(130%_160%_at_82%_110%,rgba(14,165,233,0.22)_0%,rgba(56,189,248,0.16)_28%,rgba(167,139,250,0.2)_52%,rgba(251,191,36,0.18)_68%,transparent_82%)] opacity-70 dark:bg-[radial-gradient(130%_160%_at_86%_116%,rgba(38,198,218,0.35)_0%,rgba(167,139,250,0.3)_44%,rgba(248,113,113,0.28)_62%,transparent_82%)]" />
              <div className="absolute -left-32 top-16 h-64 w-64 rounded-full bg-[#0ea5e9]/18 blur-3xl dark:bg-[#38bdf8]/18" />
              <div className="absolute -right-24 bottom-12 h-56 w-56 rounded-full bg-[#a78bfa]/18 blur-3xl dark:bg-[#a78bfa]/22" />
            </div>

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
              <div className="flex items-center gap-2 text-xs text-[#475569] transition-colors duration-300 ease-out dark:text-[#cbd5e1]">
                {providerContent.securityNote}
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
                  {isLastStep && connectionFlow.isConnected ? 'Get started' : 'Continue'}
                </button>
              </div>
            </div>
          </div>
          </Card>
        </div>
    </div>
  )
}
