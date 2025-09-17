import { renderHook, act } from '@testing-library/react'
import { useOnboardingPreferences } from '@/hooks/useOnboardingPreferences'

describe('useOnboardingPreferences', () => {
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

  it('given fresh preferences when initialized then uses default values', () => {
    const { result } = renderHook(() => useOnboardingPreferences())

    expect(result.current.preferences.enableMockData).toBe(false)
    expect(result.current.hasSetPreferences).toBe(false)
  })

  it('given fresh preferences when mock data selected then updates state', () => {
    const { result } = renderHook(() => useOnboardingPreferences())

    act(() => {
      result.current.setMockDataEnabled(true)
    })

    expect(result.current.preferences.enableMockData).toBe(true)
    expect(result.current.hasSetPreferences).toBe(true)
  })

  it('given preferences set when component unmounts then persists to storage', () => {
    const { result, unmount } = renderHook(() => useOnboardingPreferences())

    act(() => {
      result.current.setMockDataEnabled(true)
    })

    act(() => {
      result.current.savePreferences()
    })

    expect(localStorage.getItem('onboarding_preferences')).toBe(
      JSON.stringify({ enableMockData: true })
    )

    unmount()

    const { result: newResult } = renderHook(() => useOnboardingPreferences())
    expect(newResult.current.preferences.enableMockData).toBe(true)
    expect(newResult.current.hasSetPreferences).toBe(true)
  })

  it('given existing preferences when initialized then loads from storage', () => {
    localStorageData['onboarding_preferences'] = JSON.stringify({ enableMockData: true })

    const { result } = renderHook(() => useOnboardingPreferences())

    expect(result.current.preferences.enableMockData).toBe(true)
    expect(result.current.hasSetPreferences).toBe(true)
  })

  it('given preferences when reset then returns to defaults', () => {
    const { result } = renderHook(() => useOnboardingPreferences())

    act(() => {
      result.current.setMockDataEnabled(true)
    })

    act(() => {
      result.current.resetPreferences()
    })

    expect(result.current.preferences.enableMockData).toBe(false)
    expect(result.current.hasSetPreferences).toBe(false)
    expect(localStorage.getItem('onboarding_preferences')).toBe(null)
  })

  it('given mock data enabled when preference applied then integrates with existing system', () => {
    const mockToggleMockData = vi.fn()

    const { result } = renderHook(() =>
      useOnboardingPreferences({ onMockDataToggle: mockToggleMockData })
    )

    act(() => {
      result.current.setMockDataEnabled(true)
    })

    act(() => {
      result.current.applyPreferences()
    })

    expect(mockToggleMockData).toHaveBeenCalledWith(true)
  })

  it('given invalid storage data when initialized then uses defaults', () => {
    localStorageData['onboarding_preferences'] = 'invalid-json'

    const { result } = renderHook(() => useOnboardingPreferences())

    expect(result.current.preferences.enableMockData).toBe(false)
    expect(result.current.hasSetPreferences).toBe(false)
  })
})