import React, { useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { useOnboardingWizard } from '@/hooks/useOnboardingWizard'
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-4xl">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Step {stepIndex + 1} of 2
              </span>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {progress}%
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Step Content */}
          <div className="mb-8">
            {renderCurrentStep()}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-200 dark:border-slate-700">
            <div className="flex gap-3">
              {canGoBack && (
                <button
                  onClick={goToPrevious}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  Back
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {currentStep === 'connectAccount' && (
                <button
                  onClick={handleSkip}
                  className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  Skip for now
                </button>
              )}

              {!isLastStep && (
                <button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-6 rounded-lg transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
