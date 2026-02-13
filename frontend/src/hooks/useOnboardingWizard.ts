import { useCallback, useState } from 'react';
import { AuthService } from '../services/authService';

export type OnboardingStep = 'welcome' | 'connectAccount';

const ONBOARDING_STEPS: OnboardingStep[] = ['welcome', 'connectAccount'];

export interface UseOnboardingWizardReturn {
  currentStep: OnboardingStep;
  stepIndex: number;
  isComplete: boolean;
  canGoBack: boolean;
  canGoNext: boolean;
  isLastStep: boolean;
  progress: number;
  goToNext: () => void;
  goToPrevious: () => void;
  skipWizard: () => Promise<void>;
  completeWizard: () => Promise<void>;
}

export function useOnboardingWizard(): UseOnboardingWizardReturn {
  const [stepIndex, setStepIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const currentStep = ONBOARDING_STEPS[stepIndex];
  const canGoBack = stepIndex > 0;
  const canGoNext = stepIndex < ONBOARDING_STEPS.length - 1;
  const isLastStep = stepIndex === ONBOARDING_STEPS.length - 1;
  const progress = Math.round(((stepIndex + 1) / ONBOARDING_STEPS.length) * 100);

  const goToNext = useCallback(() => {
    if (canGoNext) {
      setStepIndex((prev) => prev + 1);
    }
  }, [canGoNext]);

  const goToPrevious = useCallback(() => {
    if (canGoBack) {
      setStepIndex((prev) => prev - 1);
    }
  }, [canGoBack]);

  const markComplete = useCallback(async () => {
    try {
      await AuthService.completeOnboarding();
    } catch (error) {
      console.error('Failed to mark onboarding as complete:', error);
    } finally {
      setIsComplete(true);
    }
  }, []);

  const skipWizard = useCallback(async () => {
    await markComplete();
  }, [markComplete]);

  const completeWizard = useCallback(async () => {
    await markComplete();
  }, [markComplete]);

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
  };
}
