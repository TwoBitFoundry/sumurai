import { useState, useEffect, useCallback } from 'react'

export type OnboardingStep = 'welcome' | 'mockData' | 'connectAccount'

const ONBOARDING_STEPS: OnboardingStep[] = ['welcome', 'mockData', 'connectAccount']
const STORAGE_KEY = 'onboarding_completed'

export interface UseOnboardingWizardReturn {
  currentStep: OnboardingStep
  stepIndex: number
  isComplete: boolean
  canGoBack: boolean
  canGoNext: boolean
  isLastStep: boolean
  progress: number
  goToNext: () => void
  goToPrevious: () => void
  skipWizard: () => void
  completeWizard: () => void
}

export function useOnboardingWizard(): UseOnboardingWizardReturn {
  const [stepIndex, setStepIndex] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY) === 'true'
    setIsComplete(completed)
  }, [])

  const currentStep = ONBOARDING_STEPS[stepIndex]
  const canGoBack = stepIndex > 0
  const canGoNext = stepIndex < ONBOARDING_STEPS.length - 1
  const isLastStep = stepIndex === ONBOARDING_STEPS.length - 1
  const progress = Math.round(((stepIndex + 1) / ONBOARDING_STEPS.length) * 100)

  const goToNext = useCallback(() => {
    if (canGoNext) {
      setStepIndex(prev => prev + 1)
    }
  }, [canGoNext])

  const goToPrevious = useCallback(() => {
    if (canGoBack) {
      setStepIndex(prev => prev - 1)
    }
  }, [canGoBack])

  const markComplete = useCallback(() => {
    setIsComplete(true)
    localStorage.setItem(STORAGE_KEY, 'true')
  }, [])

  const skipWizard = useCallback(() => {
    markComplete()
  }, [markComplete])

  const completeWizard = useCallback(() => {
    markComplete()
  }, [markComplete])

  return {
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
  }
}