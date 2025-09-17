import { renderHook, act } from '@testing-library/react'
import { useOnboardingWizard } from '@/hooks/useOnboardingWizard'

describe('useOnboardingWizard', () => {
  let localStorageData: Record<string, string> = {}
  let originalLocalStorage: Storage

  beforeEach(() => {
    originalLocalStorage = window.localStorage
    localStorageData = {}

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => localStorageData[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          localStorageData[key] = value
        }),
        removeItem: vi.fn((key: string) => {
          delete localStorageData[key]
        }),
        clear: vi.fn(() => {
          localStorageData = {}
        }),
      },
      writable: true
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true
    })
  })

  it('given new wizard when initialized then starts at welcome step', () => {
    const { result } = renderHook(() => useOnboardingWizard())

    expect(result.current.currentStep).toBe('welcome')
    expect(result.current.stepIndex).toBe(0)
    expect(result.current.isComplete).toBe(false)
  })

  it('given wizard at welcome when next clicked then navigates to mock data step', () => {
    const { result } = renderHook(() => useOnboardingWizard())

    act(() => {
      result.current.goToNext()
    })

    expect(result.current.currentStep).toBe('mockData')
    expect(result.current.stepIndex).toBe(1)
  })

  it('given wizard at mock data when back clicked then returns to welcome', () => {
    const { result } = renderHook(() => useOnboardingWizard())

    act(() => {
      result.current.goToNext()
    })

    act(() => {
      result.current.goToPrevious()
    })

    expect(result.current.currentStep).toBe('welcome')
    expect(result.current.stepIndex).toBe(0)
  })

  it('given wizard at any step when skip clicked then marks wizard complete', () => {
    const { result } = renderHook(() => useOnboardingWizard())

    act(() => {
      result.current.skipWizard()
    })

    expect(result.current.isComplete).toBe(true)
    expect(localStorage.getItem('onboarding_completed')).toBe('true')
  })

  it('given wizard at final step when completed then persists completion state', () => {
    const { result } = renderHook(() => useOnboardingWizard())

    act(() => {
      result.current.goToNext()
    })
    act(() => {
      result.current.goToNext()
    })

    act(() => {
      result.current.completeWizard()
    })

    expect(result.current.isComplete).toBe(true)
    expect(localStorage.getItem('onboarding_completed')).toBe('true')
  })

  it('given completed wizard when reinitialized then remains complete', () => {
    localStorageData['onboarding_completed'] = 'true'

    const { result } = renderHook(() => useOnboardingWizard())

    expect(result.current.isComplete).toBe(true)
  })

  it('given wizard when checking navigation then provides correct availability', () => {
    const { result } = renderHook(() => useOnboardingWizard())

    expect(result.current.canGoBack).toBe(false)
    expect(result.current.canGoNext).toBe(true)
    expect(result.current.isLastStep).toBe(false)

    act(() => {
      result.current.goToNext()
    })

    expect(result.current.canGoBack).toBe(true)
    expect(result.current.canGoNext).toBe(true)
    expect(result.current.isLastStep).toBe(false)

    act(() => {
      result.current.goToNext()
    })

    expect(result.current.canGoBack).toBe(true)
    expect(result.current.canGoNext).toBe(false)
    expect(result.current.isLastStep).toBe(true)
  })

  it('given wizard when checking progress then calculates correctly', () => {
    const { result } = renderHook(() => useOnboardingWizard())

    expect(result.current.progress).toBe(33)

    act(() => {
      result.current.goToNext()
    })

    expect(result.current.progress).toBe(67)

    act(() => {
      result.current.goToNext()
    })

    expect(result.current.progress).toBe(100)
  })
})