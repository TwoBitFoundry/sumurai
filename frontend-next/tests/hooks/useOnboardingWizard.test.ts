import { renderHook, act, waitFor } from '@testing-library/react';
import { useOnboardingWizard } from '@/hooks/useOnboardingWizard';

describe('useOnboardingWizard', () => {
  let sessionStorageData: Record<string, string> = {};
  let originalSessionStorage: Storage;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalSessionStorage = window.sessionStorage;
    sessionStorageData = {};

    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: jest.fn((key: string) => sessionStorageData[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          sessionStorageData[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete sessionStorageData[key];
        }),
        clear: jest.fn(() => {
          sessionStorageData = {};
        }),
      },
      writable: true,
    });

    sessionStorageData['auth_token'] = 'mock-token';

    originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        message: 'Onboarding completed',
        onboarding_completed: true,
      }),
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'sessionStorage', {
      value: originalSessionStorage,
      writable: true,
    });
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('given new wizard when initialized then starts at welcome step', () => {
    const { result } = renderHook(() => useOnboardingWizard());

    expect(result.current.currentStep).toBe('welcome');
    expect(result.current.stepIndex).toBe(0);
    expect(result.current.isComplete).toBe(false);
  });

  it('given wizard at welcome when next clicked then navigates to connect account step', () => {
    const { result } = renderHook(() => useOnboardingWizard());

    act(() => {
      result.current.goToNext();
    });

    expect(result.current.currentStep).toBe('connectAccount');
    expect(result.current.stepIndex).toBe(1);
  });

  it('given wizard at connect account when back clicked then returns to welcome', () => {
    const { result } = renderHook(() => useOnboardingWizard());

    act(() => {
      result.current.goToNext();
    });

    act(() => {
      result.current.goToPrevious();
    });

    expect(result.current.currentStep).toBe('welcome');
    expect(result.current.stepIndex).toBe(0);
  });

  it('given wizard at any step when skip clicked then marks wizard complete', async () => {
    const { result } = renderHook(() => useOnboardingWizard());

    await act(async () => {
      await result.current.skipWizard();
    });

    await waitFor(() => {
      expect(result.current.isComplete).toBe(true);
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/onboarding/complete',
      expect.objectContaining({
        method: 'PUT',
      })
    );
  });

  it('given wizard at final step when completed then persists completion state', async () => {
    const { result } = renderHook(() => useOnboardingWizard());

    act(() => {
      result.current.goToNext();
    });

    await act(async () => {
      await result.current.completeWizard();
    });

    await waitFor(() => {
      expect(result.current.isComplete).toBe(true);
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/onboarding/complete',
      expect.objectContaining({
        method: 'PUT',
      })
    );
  });

  it('given wizard when checking navigation then provides correct availability', () => {
    const { result } = renderHook(() => useOnboardingWizard());

    expect(result.current.canGoBack).toBe(false);
    expect(result.current.canGoNext).toBe(true);
    expect(result.current.isLastStep).toBe(false);

    act(() => {
      result.current.goToNext();
    });

    expect(result.current.canGoBack).toBe(true);
    expect(result.current.canGoNext).toBe(false);
    expect(result.current.isLastStep).toBe(true);
  });

  it('given wizard when checking progress then calculates correctly', () => {
    const { result } = renderHook(() => useOnboardingWizard());

    expect(result.current.progress).toBe(50);

    act(() => {
      result.current.goToNext();
    });

    expect(result.current.progress).toBe(100);
  });
});
