import { useQueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode, useEffect } from 'react';
import { App, AppProviders } from '@/App';
import { AuthenticationError } from '@/services/ApiClient';
import { AuthService } from '@/services/authService';
import { FINANCIAL_STATE_CHANGED_EVENT, OPEN_ONBOARDING_PATH_EVENT } from '@/utils/events';
import * as queryInvalidation from '@/utils/queryInvalidation';

jest.mock('@/Auth', () => ({
  LoginScreen: ({
    onLoginSuccess,
  }: {
    onLoginSuccess: (response: {
      user_id: string;
      expires_at: string;
      onboarding_completed: boolean;
      demo_mode_active: boolean;
    }) => void;
  }) => {
    const queryClient = useQueryClient();
    const cacheState = queryClient.getQueryData(['logout-cache']) ? 'hit' : 'miss';

    return (
      <>
        <output data-testid="logout-cache-state">{cacheState}</output>
        <button
          type="button"
          onClick={() =>
            onLoginSuccess({
              user_id: 'user-2',
              expires_at: '2099-03-01T00:00:00.000Z',
              onboarding_completed: false,
              demo_mode_active: false,
            })
          }
        >
          Login next user
        </button>
      </>
    );
  },
  RegisterScreen: () => null,
}));

jest.mock('@/components/AuthenticatedApp', () => ({
  AuthenticatedApp: ({
    onLogout,
    demoModeActive,
  }: {
    onLogout: () => void;
    demoModeActive: boolean;
  }) => {
    const queryClient = useQueryClient();
    useEffect(() => {
      queryClient.setQueryData(['logout-cache'], { value: true });
    }, [queryClient]);

    return (
      <>
        <output data-testid="demo-mode-active">{demoModeActive ? 'true' : 'false'}</output>
        <button type="button" onClick={onLogout}>
          Logout
        </button>
      </>
    );
  },
}));

jest.mock('@/components/onboarding/OnboardingProviderPicker', () => ({
  OnboardingProviderPicker: ({ onLogout }: { onLogout: () => void }) => (
    <div data-testid="onboarding-provider-picker">
      <button type="button" onClick={onLogout}>
        Provider logout
      </button>
    </div>
  ),
}));

jest.mock('@/components/onboarding/OnboardingPathScreen', () => ({
  OnboardingPathScreen: ({
    isDemoModeActive,
    onDemoActivated,
    onContinueToProviders,
  }: {
    isDemoModeActive: boolean;
    onDemoActivated: () => void;
    onContinueToProviders: () => void;
  }) => (
    <div
      data-testid="onboarding-path-screen"
      data-demo-mode-active={isDemoModeActive ? 'true' : 'false'}
    >
      <button type="button" onClick={onDemoActivated}>
        Activate demo
      </button>
      <button type="button" onClick={onContinueToProviders}>
        Continue
      </button>
    </div>
  ),
}));

jest.mock('@/SessionManager', () => ({
  SessionManager: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock('@/hooks/useAccountFilter', () => ({
  AccountFilterProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}));

jest.mock('@/context/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useTheme: () => ({
    preference: 'dark',
    mode: 'dark',
    toggle: jest.fn(),
    setMode: jest.fn(),
    setPreference: jest.fn(),
    colors: {},
  }),
}));

jest.mock('@/observability', () => ({
  TelemetryProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  TelemetryService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    shutdown: jest.fn(),
    getTracer: jest.fn().mockReturnValue(null),
  })),
}));

jest.mock('@/services/authService', () => ({
  AuthService: {
    configure: jest.fn(),
    refreshToken: jest.fn().mockResolvedValue({
      user_id: 'user-1',
      expires_at: '2099-01-01T00:00:00.000Z',
      onboarding_completed: true,
      demo_mode_active: false,
    }),
    logout: jest.fn().mockResolvedValue({
      message: 'logged out',
      cleared_session: 'ok',
    }),
    clearToken: jest.fn(),
    activateDemoModeOnboarding: jest.fn().mockResolvedValue({
      message: 'ok',
      onboarding_completed: true,
      demo_mode_active: true,
    }),
  },
}));

function QueryClientProbe() {
  const queryClient = useQueryClient();
  const queryDefaults = queryClient.getDefaultOptions().queries ?? {};

  return (
    <output data-testid="query-client-config">
      {JSON.stringify({
        staleTime: queryDefaults.staleTime,
        gcTime: queryDefaults.gcTime,
        retry: queryDefaults.retry,
        refetchOnWindowFocus: queryDefaults.refetchOnWindowFocus,
      })}
    </output>
  );
}

describe('AppProviders', () => {
  it('provides a configured query client to descendants', () => {
    render(
      <AppProviders>
        <QueryClientProbe />
      </AppProviders>
    );

    expect(screen.getByTestId('query-client-config')).toHaveTextContent(
      JSON.stringify({
        staleTime: 300000,
        gcTime: 600000,
        retry: 1,
        refetchOnWindowFocus: true,
      })
    );
  });
});

describe('App logout cache handling', () => {
  beforeEach(() => {
    const refreshTokenMock = jest.mocked(AuthService.refreshToken);
    refreshTokenMock.mockReset();
    refreshTokenMock.mockResolvedValue({
      user_id: 'user-1',
      expires_at: '2099-01-01T00:00:00.000Z',
      onboarding_completed: true,
      demo_mode_active: false,
    });
  });

  it('clears the query cache when logging out', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByRole('button', { name: /logout/i }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('logout-cache-state')).toHaveTextContent('miss');
    });
  });
});

describe('App onboarding gate', () => {
  beforeEach(() => {
    const refreshTokenMock = jest.mocked(AuthService.refreshToken);
    refreshTokenMock.mockReset();
    refreshTokenMock.mockResolvedValue({
      user_id: 'user-1',
      expires_at: '2099-01-01T00:00:00.000Z',
      onboarding_completed: false,
      demo_mode_active: false,
    });
  });

  it('renders the onboarding path ahead of providers', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-path-screen')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
    expect(screen.queryByTestId('onboarding-provider-picker')).not.toBeInTheDocument();
  });

  it('continues from the onboarding path to providers without a reload', async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole('button', { name: /continue/i }));

    expect(screen.getByTestId('onboarding-provider-picker')).toBeInTheDocument();
    expect(screen.queryByTestId('onboarding-path-screen')).not.toBeInTheDocument();
  });

  it('completes demo onboarding locally without rendering providers', async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole('button', { name: /activate demo/i }));

    await waitFor(() => {
      expect(screen.getByTestId('demo-mode-active')).toHaveTextContent('true');
    });
    expect(screen.queryByTestId('onboarding-path-screen')).not.toBeInTheDocument();
    expect(screen.queryByTestId('onboarding-provider-picker')).not.toBeInTheDocument();
  });

  it('resets onboarding path progress on logout and a new authenticated session', async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole('button', { name: /continue/i }));
    await user.click(screen.getByRole('button', { name: /provider logout/i }));
    await user.click(await screen.findByRole('button', { name: /login next user/i }));

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-path-screen')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('onboarding-provider-picker')).not.toBeInTheDocument();
  });

  it('resets onboarding path progress when a new authenticated session is applied', async () => {
    const user = userEvent.setup();
    const refreshTokenMock = jest.mocked(AuthService.refreshToken);
    refreshTokenMock
      .mockResolvedValueOnce({
        user_id: 'user-1',
        expires_at: '2099-01-01T00:00:00.000Z',
        onboarding_completed: false,
        demo_mode_active: false,
      })
      .mockResolvedValueOnce({
        user_id: 'user-2',
        expires_at: '2099-02-01T00:00:00.000Z',
        onboarding_completed: false,
        demo_mode_active: false,
      });

    render(<App />);

    await user.click(await screen.findByRole('button', { name: /continue/i }));
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(FINANCIAL_STATE_CHANGED_EVENT, {
          detail: { mode: 'app', refreshSession: true },
        })
      );
    });

    await waitFor(() => {
      expect(refreshTokenMock).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('onboarding-path-screen')).toBeInTheDocument();
    });
  });

  it('preserves demo mode state from the refresh response', async () => {
    jest.mocked(AuthService.refreshToken).mockResolvedValue({
      user_id: 'user-1',
      expires_at: '2099-01-01T00:00:00.000Z',
      onboarding_completed: true,
      demo_mode_active: true,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('demo-mode-active')).toHaveTextContent('true');
    });
  });

  it('reopens the onboarding path for a demo user and continues to the provider picker', async () => {
    const user = userEvent.setup();
    jest.mocked(AuthService.refreshToken).mockResolvedValue({
      user_id: 'user-1',
      expires_at: '2099-01-01T00:00:00.000Z',
      onboarding_completed: true,
      demo_mode_active: true,
    });

    render(<App />);

    await screen.findByTestId('demo-mode-active');
    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_ONBOARDING_PATH_EVENT));
    });

    expect(screen.getByTestId('onboarding-path-screen')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByTestId('onboarding-provider-picker')).toBeInTheDocument();
    expect(screen.queryByTestId('onboarding-path-screen')).not.toBeInTheDocument();
  });

  it('refreshes app session state when a provider-connected event is dispatched', async () => {
    const refreshTokenMock = jest.mocked(AuthService.refreshToken);
    const resetFinancialQueriesForAppRefresh = jest
      .spyOn(queryInvalidation, 'resetFinancialQueriesForAppRefresh')
      .mockResolvedValue(undefined);
    refreshTokenMock.mockReset();
    refreshTokenMock
      .mockResolvedValueOnce({
        user_id: 'user-1',
        expires_at: '2099-01-01T00:00:00.000Z',
        onboarding_completed: true,
        demo_mode_active: true,
      })
      .mockResolvedValueOnce({
        user_id: 'user-1',
        expires_at: '2099-02-01T00:00:00.000Z',
        onboarding_completed: true,
        demo_mode_active: false,
      });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('demo-mode-active')).toHaveTextContent('true');
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(FINANCIAL_STATE_CHANGED_EVENT, {
          detail: { mode: 'app', tab: 'accounts', refreshSession: true },
        })
      );
    });

    await waitFor(() => {
      expect(refreshTokenMock).toHaveBeenCalledTimes(2);
      expect(resetFinancialQueriesForAppRefresh).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('demo-mode-active')).toHaveTextContent('false');
    });

    resetFinancialQueriesForAppRefresh.mockRestore();
  });

  it('keeps the last valid authenticated state when app refresh fails for a non-auth reason', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const refreshTokenMock = jest.mocked(AuthService.refreshToken);
    const resetFinancialQueriesForAppRefresh = jest
      .spyOn(queryInvalidation, 'resetFinancialQueriesForAppRefresh')
      .mockResolvedValue(undefined);
    refreshTokenMock.mockReset();
    refreshTokenMock
      .mockResolvedValueOnce({
        user_id: 'user-1',
        expires_at: '2099-01-01T00:00:00.000Z',
        onboarding_completed: true,
        demo_mode_active: true,
      })
      .mockRejectedValueOnce(new Error('network down'));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('demo-mode-active')).toHaveTextContent('true');
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(FINANCIAL_STATE_CHANGED_EVENT, {
          detail: { mode: 'app', tab: 'accounts', refreshSession: true },
        })
      );
    });

    await waitFor(() => {
      expect(refreshTokenMock).toHaveBeenCalledTimes(2);
      expect(resetFinancialQueriesForAppRefresh).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('demo-mode-active')).toHaveTextContent('true');
      expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
    });

    expect(warnSpy).toHaveBeenCalledWith('Auth validation error:', expect.any(Error));

    resetFinancialQueriesForAppRefresh.mockRestore();
    warnSpy.mockRestore();
  });
});

describe('App auth bootstrap', () => {
  it('treats refresh 401 as unauthenticated without logging a validation warning', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const refreshTokenMock = jest.mocked(AuthService.refreshToken);
    refreshTokenMock.mockReset();
    refreshTokenMock.mockRejectedValue(new AuthenticationError());

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('logout-cache-state')).toBeInTheDocument();
    });

    expect(warnSpy).not.toHaveBeenCalledWith('Auth validation error:', expect.anything());

    warnSpy.mockRestore();
  });
});
