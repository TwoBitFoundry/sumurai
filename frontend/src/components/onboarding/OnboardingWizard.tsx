import React, { useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { useOnboardingWizard } from '@/hooks/useOnboardingWizard'
import { useOnboardingPreferences } from '@/hooks/useOnboardingPreferences'
import { useOnboardingPlaidFlow } from '@/hooks/useOnboardingPlaidFlow'
import { WelcomeStep } from './WelcomeStep'
import { MockDataStep } from './MockDataStep'
import { ConnectAccountStep } from './ConnectAccountStep'

interface OnboardingWizardProps {
  onComplete: () => void
  dark?: boolean
}

export function OnboardingWizard({ onComplete, dark = false }: OnboardingWizardProps) {
  const wizard = useOnboardingWizard()
  const preferences = useOnboardingPreferences()
  const plaidFlow = useOnboardingPlaidFlow({
    onConnectionSuccess: (institutionName) => {
      console.log(`Connected to ${institutionName}`)
    },
    onError: (error) => {
      console.error('Plaid connection error:', error)
    },
  })

  useEffect(() => {
    if (wizard.isComplete) {
      onComplete()
    }
  }, [wizard.isComplete, onComplete])

  const handleNext = () => {
    if (wizard.currentStep === 'mockData' && preferences.hasSetPreferences) {
      preferences.savePreferences()
      preferences.applyPreferences()
    }
    wizard.goToNext()
  }

  const handleComplete = () => {
    if (preferences.hasSetPreferences) {
      preferences.savePreferences()
      preferences.applyPreferences()
    }
    wizard.completeWizard()
    onComplete()
  }

  const renderCurrentStep = () => {
    switch (wizard.currentStep) {
      case 'welcome':
        return <WelcomeStep />

      case 'mockData':
        return (
          <MockDataStep
            selectedOption={
              preferences.hasSetPreferences ? preferences.preferences.enableMockData : null
            }
            onOptionSelect={preferences.setMockDataEnabled}
          />
        )

      case 'connectAccount':
        return (
          <ConnectAccountStep
            isConnected={plaidFlow.isConnected}
            connectionInProgress={plaidFlow.connectionInProgress}
            institutionName={plaidFlow.institutionName}
            error={plaidFlow.error}
            onConnect={plaidFlow.initiateConnection}
            onRetry={plaidFlow.retryConnection}
            selectedMockData={preferences.preferences.enableMockData}
          />
        )

      default:
        return <WelcomeStep />
    }
  }

  const canProceed = () => {
    if (wizard.currentStep === 'welcome') {
      return true
    }
    if (wizard.currentStep === 'mockData') {
      return preferences.hasSetPreferences
    }
    if (wizard.currentStep === 'connectAccount') {
      return preferences.preferences.enableMockData || plaidFlow.isConnected
    }
    return wizard.canGoNext
  }

  return (
    <div className={dark ? 'dark' : ''}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-4xl">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Step {wizard.stepIndex + 1} of 3
              </span>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {wizard.progress}%
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${wizard.progress}%` }}
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
              {wizard.canGoBack && (
                <button
                  onClick={wizard.goToPrevious}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  Back
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={wizard.skipWizard}
                className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                Skip for now
              </button>

              {wizard.isLastStep ? (
                <button
                  onClick={handleComplete}
                  disabled={!canProceed()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-6 rounded-lg transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed"
                >
                  Complete
                </button>
              ) : (
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