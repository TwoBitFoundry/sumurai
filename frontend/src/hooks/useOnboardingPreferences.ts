import { useState, useEffect, useCallback } from 'react'

export interface OnboardingPreferences {
  enableMockData: boolean
}

export interface UseOnboardingPreferencesOptions {
  onMockDataToggle?: (enabled: boolean) => void
}

export interface UseOnboardingPreferencesReturn {
  preferences: OnboardingPreferences
  hasSetPreferences: boolean
  setMockDataEnabled: (enabled: boolean) => void
  savePreferences: () => void
  applyPreferences: () => void
  resetPreferences: () => void
}

const STORAGE_KEY = 'onboarding_preferences'
const DEFAULT_PREFERENCES: OnboardingPreferences = {
  enableMockData: false,
}

export function useOnboardingPreferences(
  options: UseOnboardingPreferencesOptions = {}
): UseOnboardingPreferencesReturn {
  const { onMockDataToggle } = options

  const [preferences, setPreferences] = useState<OnboardingPreferences>(DEFAULT_PREFERENCES)
  const [hasSetPreferences, setHasSetPreferences] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setPreferences(parsed)
        setHasSetPreferences(true)
      }
    } catch (error) {
      console.warn('Failed to load onboarding preferences:', error)

      setPreferences(DEFAULT_PREFERENCES)
      setHasSetPreferences(false)
    }
  }, [])

  const setMockDataEnabled = useCallback((enabled: boolean) => {
    setPreferences(prev => ({
      ...prev,
      enableMockData: enabled,
    }))
    setHasSetPreferences(true)
  }, [])

  const savePreferences = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
    } catch (error) {
      console.error('Failed to save onboarding preferences:', error)
    }
  }, [preferences])

  const applyPreferences = useCallback(() => {
    if (onMockDataToggle) {
      onMockDataToggle(preferences.enableMockData)
    }
  }, [preferences.enableMockData, onMockDataToggle])

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES)
    setHasSetPreferences(false)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  return {
    preferences,
    hasSetPreferences,
    setMockDataEnabled,
    savePreferences,
    applyPreferences,
    resetPreferences,
  }
}