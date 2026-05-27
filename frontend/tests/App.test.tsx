import { useQueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { type ReactNode, useEffect } from 'react';
import { App, AppProviders } from '@/App';
import { AuthenticationError } from '@/services/ApiClient';
import { AuthService } from '@/services/authService';

jest.mock('@/Auth', () => ({
  LoginScreen: () => {
    const queryClient = useQueryClient();
    const cacheState = queryClient.getQueryData(['logout-cache']) ? 'hit' : 'miss';

    return <output data-testid="logout-cache-state">{cacheState}</output>;
  },
  RegisterScreen: () => null,
}));

jest.mock('@/components/AuthenticatedApp', () => ({
  AuthenticatedApp: ({ onLogout }: { onLogout: () => void }) => {
    const queryClient = useQueryClient();

    useEffect(() => {
      queryClient.setQueryData(['logout-cache'], { value: true });
    }, [queryClient]);

    return (
      <button type="button" onClick={onLogout}>
        Logout
      </button>
    );
  },
}));

jest.mock('@/components/onboarding/OnboardingProviderPicker', () => ({
  OnboardingProviderPicker: () => <div data-testid="onboarding-provider-picker" />,
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
    }),
    logout: jest.fn().mockResolvedValue({
      message: 'logged out',
      cleared_session: 'ok',
    }),
    clearToken: jest.fn(),
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
    jest.mocked(AuthService.refreshToken).mockResolvedValue({
      user_id: 'user-1',
      expires_at: '2099-01-01T00:00:00.000Z',
      onboarding_completed: true,
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
  it('renders the onboarding provider picker until onboarding is complete', async () => {
    jest.mocked(AuthService.refreshToken).mockResolvedValue({
      user_id: 'user-1',
      expires_at: '2099-01-01T00:00:00.000Z',
      onboarding_completed: false,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-provider-picker')).toBeInTheDocument();
    });
  });
});

describe('App auth bootstrap', () => {
  it('treats refresh 401 as unauthenticated without logging a validation warning', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.mocked(AuthService.refreshToken).mockRejectedValueOnce(new AuthenticationError());

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('logout-cache-state')).toHaveTextContent('miss');
    });

    expect(warnSpy).not.toHaveBeenCalledWith('Auth validation error:', expect.anything());

    warnSpy.mockRestore();
  });
});
