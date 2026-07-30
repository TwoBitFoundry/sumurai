import { useQueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode, useEffect } from 'react';
import { App, AppProviders } from '@/App';
import { useBillingStatus } from '@/features/billing/useBillingStatus';
import { AuthenticationError } from '@/services/ApiClient';
import { AuthService } from '@/services/authService';
import type { BillingStatusResponse } from '@/types/api';
import {
  FINANCIAL_STATE_CHANGED_EVENT,
  NAVIGATE_TO_SETTINGS_EVENT,
  OPEN_PRICING_EVENT,
  PAID_ACCESS_REQUIRED_EVENT,
} from '@/utils/events';
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
    const billingCacheState = queryClient.getQueryData(['billing', 'status']) ? 'hit' : 'miss';

    return (
      <>
        <output data-testid="logout-cache-state">{cacheState}</output>
        <output data-testid="billing-cache-state">{billingCacheState}</output>
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
    const cachedBillingStatus = queryClient.getQueryData<BillingStatusResponse>([
      'billing',
      'status',
    ]);

    useEffect(() => {
      queryClient.setQueryData(['logout-cache'], { value: true });
    }, [queryClient]);

    return (
      <>
        <output data-testid="demo-mode-active">{demoModeActive ? 'true' : 'false'}</output>
        <output data-testid="billing-demo-mode-active">
          {cachedBillingStatus?.is_demo_mode_active ? 'true' : 'false'}
        </output>
        <button
          type="button"
          onClick={() =>
            queryClient.setQueryData(['billing', 'status'], {
              billing_enabled: true,
              can_use_own_data: true,
              is_demo_mode_active: false,
            })
          }
        >
          Seed billing cache
        </button>
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

jest.mock('@/features/billing/PricingScreen', () => ({
  PricingScreen: ({
    billingStatus,
    onDemoActivated,
    onContinueToProviders,
  }: {
    billingStatus: BillingStatusResponse;
    onDemoActivated: () => void;
    onContinueToProviders: () => void;
  }) => {
    const queryClient = useQueryClient();

    useEffect(() => {
      queryClient.setQueryData(['billing', 'status'], billingStatus);
    }, [billingStatus, queryClient]);

    return (
      <div
        data-testid="pricing-screen"
        data-billing-enabled={billingStatus.billing_enabled ? 'true' : 'false'}
      >
        <button type="button" onClick={onDemoActivated}>
          Activate demo
        </button>
        {!billingStatus.billing_enabled ? (
          <button type="button" onClick={onContinueToProviders}>
            Continue
          </button>
        ) : (
          <>
            <button type="button" onClick={onContinueToProviders}>
              Complete Premium
            </button>
            {billingStatus.trials_enabled ? (
              <button type="button" onClick={onContinueToProviders}>
                Complete trial
              </button>
            ) : null}
          </>
        )}
      </div>
    );
  },
}));

jest.mock('@/features/billing/UpgradeRequiredModal', () => ({
  UpgradeRequiredModal: ({
    isOpen,
    onClose,
    onViewPlans,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onViewPlans: () => void;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label="Upgrade required">
        <button type="button" onClick={onClose}>
          Dismiss upgrade
        </button>
        <button type="button" onClick={onViewPlans}>
          View plans in Settings
        </button>
      </div>
    ) : null,
}));

jest.mock('@/features/billing/useBillingStatus', () => ({
  useBillingStatus: jest.fn(),
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

const disabledBillingStatus: BillingStatusResponse = {
  billing_enabled: false,
  trials_enabled: false,
  paddle_client_token: null,
  paddle_environment: null,
  access_status: 'unrestricted',
  can_use_own_data: true,
  is_demo_mode_active: false,
  trial_ends_at: null,
  current_period_ends_at: null,
  scheduled_cancel_at: null,
  payment_method_required: false,
  billing_portal_available: false,
  enabled_financial_providers: ['diy', 'plaid'],
};

const enabledBillingStatus: BillingStatusResponse = {
  ...disabledBillingStatus,
  billing_enabled: true,
  trials_enabled: true,
  paddle_client_token: 'test_client_token',
  paddle_environment: 'sandbox',
  access_status: 'demo',
  can_use_own_data: false,
};

const setBillingQuery = (
  result: { data?: BillingStatusResponse; isPending: boolean; isError: boolean } = {
    data: disabledBillingStatus,
    isPending: false,
    isError: false,
  }
) => {
  jest.mocked(useBillingStatus).mockReturnValue(result as ReturnType<typeof useBillingStatus>);
};

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
  beforeEach(() => {
    setBillingQuery();
  });

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
    setBillingQuery();
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

  it('removes billing status when an authenticated refresh loses the session', async () => {
    const user = userEvent.setup();
    const refreshTokenMock = jest.mocked(AuthService.refreshToken);
    const resetFinancialQueriesForAppRefresh = jest
      .spyOn(queryInvalidation, 'resetFinancialQueriesForAppRefresh')
      .mockResolvedValue(undefined);
    refreshTokenMock
      .mockResolvedValueOnce({
        user_id: 'user-1',
        expires_at: '2099-01-01T00:00:00.000Z',
        onboarding_completed: true,
        demo_mode_active: false,
      })
      .mockRejectedValueOnce(new AuthenticationError());

    render(<App />);

    await user.click(await screen.findByRole('button', { name: /seed billing cache/i }));
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(FINANCIAL_STATE_CHANGED_EVENT, {
          detail: { mode: 'app', refreshSession: true },
        })
      );
    });

    await waitFor(() => {
      expect(refreshTokenMock).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('billing-cache-state')).toHaveTextContent('miss');
    });

    resetFinancialQueriesForAppRefresh.mockRestore();
  });
});

describe('App paid-access recovery', () => {
  beforeEach(() => {
    setBillingQuery();
    const refreshTokenMock = jest.mocked(AuthService.refreshToken);
    refreshTokenMock.mockReset();
    refreshTokenMock.mockResolvedValue({
      user_id: 'user-1',
      expires_at: '2099-01-01T00:00:00.000Z',
      onboarding_completed: true,
      demo_mode_active: false,
    });
  });

  it('opens one upgrade dialog for repeated paid-access events and can reopen after dismissal', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('button', { name: /logout/i });
    act(() => {
      window.dispatchEvent(new CustomEvent(PAID_ACCESS_REQUIRED_EVENT));
      window.dispatchEvent(new CustomEvent(PAID_ACCESS_REQUIRED_EVENT));
    });

    expect(screen.getAllByRole('dialog', { name: /upgrade required/i })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /dismiss upgrade/i }));
    expect(screen.queryByRole('dialog', { name: /upgrade required/i })).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent(PAID_ACCESS_REQUIRED_EVENT));
    });
    expect(screen.getByRole('dialog', { name: /upgrade required/i })).toBeInTheDocument();
  });

  it('closes the upgrade dialog and requests Settings navigation from its primary action', async () => {
    const user = userEvent.setup();
    const navigationHandler = jest.fn();
    window.addEventListener(NAVIGATE_TO_SETTINGS_EVENT, navigationHandler);
    render(<App />);

    await screen.findByRole('button', { name: /logout/i });
    act(() => {
      window.dispatchEvent(new CustomEvent(PAID_ACCESS_REQUIRED_EVENT));
    });
    await user.click(screen.getByRole('button', { name: /view plans in settings/i }));

    expect(screen.queryByRole('dialog', { name: /upgrade required/i })).not.toBeInTheDocument();
    expect(navigationHandler).toHaveBeenCalledTimes(1);
    window.removeEventListener(NAVIGATE_TO_SETTINGS_EVENT, navigationHandler);
  });

  it('ignores paid-access events outside an authenticated session', async () => {
    jest.mocked(AuthService.refreshToken).mockRejectedValueOnce(new AuthenticationError());
    render(<App />);

    await screen.findByTestId('logout-cache-state');
    act(() => {
      window.dispatchEvent(new CustomEvent(PAID_ACCESS_REQUIRED_EVENT));
    });

    expect(screen.queryByRole('dialog', { name: /upgrade required/i })).not.toBeInTheDocument();
  });

  it('ignores background paid-access events in demo mode and opens pricing explicitly', async () => {
    jest.mocked(AuthService.refreshToken).mockResolvedValueOnce({
      user_id: 'user-1',
      expires_at: '2099-01-01T00:00:00.000Z',
      onboarding_completed: true,
      demo_mode_active: true,
    });
    render(<App />);

    await screen.findByRole('button', { name: /logout/i });
    act(() => {
      window.dispatchEvent(new CustomEvent(PAID_ACCESS_REQUIRED_EVENT));
    });

    expect(screen.queryByRole('dialog', { name: /upgrade required/i })).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_PRICING_EVENT));
    });

    expect(screen.getByTestId('pricing-screen')).toBeInTheDocument();
  });
});

describe('App onboarding gate', () => {
  beforeEach(() => {
    setBillingQuery();
    const refreshTokenMock = jest.mocked(AuthService.refreshToken);
    refreshTokenMock.mockReset();
    refreshTokenMock.mockResolvedValue({
      user_id: 'user-1',
      expires_at: '2099-01-01T00:00:00.000Z',
      onboarding_completed: false,
      demo_mode_active: false,
    });
  });

  it('keeps the existing loading shell ahead of pricing while billing is pending', async () => {
    setBillingQuery({ data: undefined, isPending: true, isError: false });

    render(<App />);

    await waitFor(() => {
      expect(AuthService.refreshToken).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('pricing-screen')).not.toBeInTheDocument();
    expect(screen.queryByTestId('onboarding-provider-picker')).not.toBeInTheDocument();
  });

  it('renders only self-hosted pricing when billing is disabled', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('pricing-screen')).toHaveAttribute('data-billing-enabled', 'false');
    });
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /complete premium/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('onboarding-provider-picker')).not.toBeInTheDocument();
  });

  it('renders paid pricing when billing is enabled without own-data access', async () => {
    setBillingQuery({ data: enabledBillingStatus, isPending: false, isError: false });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('pricing-screen')).toHaveAttribute('data-billing-enabled', 'true');
    });
    expect(screen.getByRole('button', { name: /complete premium/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /complete trial/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue/i })).not.toBeInTheDocument();
  });

  it('uses disabled pricing after a billing query error', async () => {
    setBillingQuery({ data: disabledBillingStatus, isPending: false, isError: true });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /complete premium/i })).not.toBeInTheDocument();
  });

  it('resumes at providers when an enabled status already grants own-data access', async () => {
    setBillingQuery({
      data: { ...enabledBillingStatus, access_status: 'active', can_use_own_data: true },
      isPending: false,
      isError: false,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-provider-picker')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('pricing-screen')).not.toBeInTheDocument();
  });

  it.each([
    ['Self Hosted', disabledBillingStatus, /continue/i],
    ['Premium', enabledBillingStatus, /complete premium/i],
    ['trial', enabledBillingStatus, /complete trial/i],
  ])('continues from %s pricing to providers without a reload', async (_name, status, action) => {
    setBillingQuery({ data: status, isPending: false, isError: false });
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole('button', { name: action }));

    expect(screen.getByTestId('onboarding-provider-picker')).toBeInTheDocument();
    expect(screen.queryByTestId('pricing-screen')).not.toBeInTheDocument();
  });

  it('completes demo onboarding locally without rendering providers', async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole('button', { name: /activate demo/i }));

    await waitFor(() => {
      expect(screen.getByTestId('demo-mode-active')).toHaveTextContent('true');
      expect(screen.getByTestId('billing-demo-mode-active')).toHaveTextContent('true');
    });
    expect(screen.queryByTestId('pricing-screen')).not.toBeInTheDocument();
    expect(screen.queryByTestId('onboarding-provider-picker')).not.toBeInTheDocument();
  });

  it('resets pricing progress on logout and a new authenticated session', async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole('button', { name: /continue/i }));
    await user.click(screen.getByRole('button', { name: /provider logout/i }));
    await user.click(await screen.findByRole('button', { name: /login next user/i }));

    await waitFor(() => {
      expect(screen.getByTestId('pricing-screen')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('onboarding-provider-picker')).not.toBeInTheDocument();
  });

  it('resets pricing progress when a new authenticated session is applied', async () => {
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
      expect(screen.getByTestId('pricing-screen')).toBeInTheDocument();
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

  it('reopens pricing for a demo user and continues to the provider picker', async () => {
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
      window.dispatchEvent(new CustomEvent(OPEN_PRICING_EVENT));
    });

    expect(screen.getByTestId('pricing-screen')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByTestId('onboarding-provider-picker')).toBeInTheDocument();
    expect(screen.queryByTestId('pricing-screen')).not.toBeInTheDocument();
  });

  it('ignores pricing entry events for a non-demo user', async () => {
    jest.mocked(AuthService.refreshToken).mockResolvedValue({
      user_id: 'user-1',
      expires_at: '2099-01-01T00:00:00.000Z',
      onboarding_completed: true,
      demo_mode_active: false,
    });

    render(<App />);

    await screen.findByTestId('demo-mode-active');
    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_PRICING_EVENT));
    });

    expect(screen.queryByTestId('pricing-screen')).not.toBeInTheDocument();
    expect(screen.queryByTestId('onboarding-provider-picker')).not.toBeInTheDocument();
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
  beforeEach(() => {
    setBillingQuery();
  });

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
