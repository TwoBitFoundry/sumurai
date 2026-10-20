'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { cn } from '@/ui/primitives';
import { LoginScreen, RegisterScreen } from './Auth';
import { AuthenticatedApp, type TabKey } from './components/AuthenticatedApp';
import { OnboardingPathScreen } from './components/onboarding/OnboardingPathScreen';
import { OnboardingProviderPicker } from './components/onboarding/OnboardingProviderPicker';
import { ThemeProvider } from './context/ThemeContext';
import {
  EnrollPasskeyScreen,
  type PendingPasskeyRecoveryEnrollment,
} from './features/auth/EnrollPasskeyScreen';
import { TransactionListLauncherProvider } from './features/transactions/components/TransactionListLauncherProvider';
import { AccountFilterProvider } from './hooks/useAccountFilter';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { TelemetryProvider, TelemetryService } from './observability';
import { SessionManager } from './SessionManager';
import { AuthenticationError } from './services/ApiClient';
import { AuthService } from './services/authService';
import { BrowserStorageAdapter } from './services/boundaries';
import { AppFooter, AppTitleBar, GlassCard, GradientShell } from './ui/primitives';
import { ControlTooltipProvider } from './ui/primitives/ControlHoverLabel';
import { authLayout, text as uiTextRecipes, font as uiTypographyRecipes } from './ui/recipes';
import {
  FINANCIAL_STATE_CHANGED_EVENT,
  type FinancialStateChangedDetail,
  OPEN_ONBOARDING_PATH_EVENT,
} from './utils/events';
import { resetFinancialQueriesForAppRefresh } from './utils/queryInvalidation';

AuthService.configure({
  storage: new BrowserStorageAdapter(),
});

const telemetryService = new TelemetryService();
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

interface AppContentProps {
  initialTab?: TabKey;
  initialAuthScreen?: 'login' | 'register';
}

function AppLoadingShell() {
  return (
    <GradientShell>
      <div className={cn('flex', 'min-h-dvh', 'items-center', 'justify-center', 'px-4')}>
        <GlassCard
          variant="accent"
          rounded="lg"
          padding="md"
          withInnerEffects={false}
          className={cn('text-center', uiTypographyRecipes.body, uiTextRecipes.body)}
        >
          Loading...
        </GlassCard>
      </div>
    </GradientShell>
  );
}

function AppContent({ initialTab, initialAuthScreen }: AppContentProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [needsPasskeyEnrollment, setNeedsPasskeyEnrollment] = useState(false);
  const [pendingRecoveryEnrollment, setPendingRecoveryEnrollment] =
    useState<PendingPasskeyRecoveryEnrollment | null>(null);
  const [enrollmentLockedEmail, setEnrollmentLockedEmail] = useState<string | null>(null);
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [pendingOnboarding, setPendingOnboarding] = useState(false);
  const [pendingExpiresAt, setPendingExpiresAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>(initialAuthScreen ?? 'login');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [mainAppKey, setMainAppKey] = useState(0);
  const [remountTab, setRemountTab] = useState<TabKey>(initialTab ?? 'dashboard');
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null);
  const [demoModeActive, setDemoModeActive] = useState(false);
  const [pendingDemoModeActive, setPendingDemoModeActive] = useState(false);
  const [pathComplete, setPathComplete] = useState(false);
  const [pathRequested, setPathRequested] = useState(false);

  const isOnline = useOnlineStatus();

  const applyAuthenticatedSession = useCallback(
    (authResponse: {
      user_id: string;
      email?: string;
      expires_at: string;
      onboarding_completed: boolean;
      demo_mode_active: boolean;
    }) => {
      setIsAuthenticated(true);
      setShowOnboarding(!authResponse.onboarding_completed);
      setSessionExpiresAt(authResponse.expires_at);
      setDemoModeActive(authResponse.demo_mode_active);
      setPathComplete(false);
      setPathRequested(false);
      if (authResponse.email) {
        queryClient.setQueryData(['user', 'email'], authResponse.email);
      }
    },
    []
  );

  const resetUnauthenticatedSession = useCallback((screen: 'login' | 'register' = 'login') => {
    setIsAuthenticated(false);
    setNeedsPasskeyEnrollment(false);
    setPendingRecoveryEnrollment(null);
    setEnrollmentLockedEmail(null);
    setShowEnrollmentModal(false);
    setShowOnboarding(false);
    setSessionExpiresAt(null);
    setDemoModeActive(false);
    setPendingOnboarding(false);
    setPendingExpiresAt(null);
    setPendingDemoModeActive(false);
    setPathComplete(false);
    setPathRequested(false);
    setAuthScreen(screen);
    AuthService.clearToken();
  }, []);

  const refreshAuthenticatedSession = useCallback(
    async (options?: { onAuthenticationError?: () => void }) => {
      try {
        const refreshResponse = await AuthService.refreshToken();
        applyAuthenticatedSession(refreshResponse);
        return refreshResponse;
      } catch (error) {
        if (error instanceof AuthenticationError) {
          options?.onAuthenticationError?.();
          resetUnauthenticatedSession();
        } else {
          console.warn('Auth validation error:', error);
        }
        throw error;
      }
    },
    [applyAuthenticatedSession, resetUnauthenticatedSession]
  );

  useEffect(() => {
    const handler = () => setShowEnrollmentModal(true);
    window.addEventListener('sumurai:enrollment-required', handler);
    return () => window.removeEventListener('sumurai:enrollment-required', handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      if (!isAuthenticated) {
        return;
      }
      setPathComplete(false);
      setPathRequested(true);
      setShowOnboarding(true);
    };
    window.addEventListener(OPEN_ONBOARDING_PATH_EVENT, handler);
    return () => window.removeEventListener(OPEN_ONBOARDING_PATH_EVENT, handler);
  }, [isAuthenticated]);

  useEffect(() => {
    let active = true;
    const establishSession = async () => {
      try {
        await refreshAuthenticatedSession();
        if (!active) {
          return;
        }
      } catch {
        if (!active) {
          return;
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    establishSession();

    return () => {
      active = false;
    };
  }, [refreshAuthenticatedSession]);

  const handleAuthSuccess = useCallback(
    (authResponse: {
      user_id: string;
      email?: string;
      expires_at: string;
      onboarding_completed: boolean;
      demo_mode_active: boolean;
    }) => {
      applyAuthenticatedSession(authResponse);
    },
    [applyAuthenticatedSession]
  );

  const handleEnrollmentRequired = useCallback(
    (
      authResponse: {
        user_id: string;
        expires_at: string;
        onboarding_completed: boolean;
        demo_mode_active: boolean;
      },
      email: string
    ) => {
      setEnrollmentLockedEmail(email);
      setPendingOnboarding(!authResponse.onboarding_completed);
      setPendingExpiresAt(authResponse.expires_at);
      setPendingDemoModeActive(authResponse.demo_mode_active);
      setNeedsPasskeyEnrollment(true);
    },
    []
  );

  const handleEnrollmentComplete = useCallback(
    (authResponse?: {
      user_id: string;
      expires_at: string;
      onboarding_completed: boolean;
      demo_mode_active: boolean;
    }) => {
      setNeedsPasskeyEnrollment(false);
      setShowEnrollmentModal(false);
      setPendingRecoveryEnrollment(null);
      setEnrollmentLockedEmail(null);
      setIsAuthenticated(true);
      setPathComplete(false);
      if (authResponse) {
        setShowOnboarding(!authResponse.onboarding_completed);
        setSessionExpiresAt(authResponse.expires_at);
        setDemoModeActive(authResponse.demo_mode_active);
        setPendingOnboarding(false);
        setPendingExpiresAt(null);
        setPendingDemoModeActive(false);
      } else {
        setShowOnboarding(pendingOnboarding);
        setSessionExpiresAt(pendingExpiresAt);
        setDemoModeActive(pendingDemoModeActive);
        setPendingOnboarding(false);
        setPendingExpiresAt(null);
        setPendingDemoModeActive(false);
      }
    },
    [pendingDemoModeActive, pendingOnboarding, pendingExpiresAt]
  );

  const handleRecoveryEnrollmentStarted = useCallback(
    (pending: PendingPasskeyRecoveryEnrollment) => {
      setEnrollmentLockedEmail(pending.email);
      setPendingRecoveryEnrollment(pending);
      setNeedsPasskeyEnrollment(true);
    },
    []
  );

  const handleLogout = useCallback(async () => {
    try {
      await AuthService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      queryClient.clear();
    }

    resetUnauthenticatedSession('login');
  }, [resetUnauthenticatedSession]);

  const handleOnboardingBack = useCallback(async () => {
    try {
      await AuthService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      queryClient.clear();
    }

    resetUnauthenticatedSession(authScreen);
  }, [authScreen, resetUnauthenticatedSession]);

  const handleProviderPickerBack = useCallback(() => {
    if (pathComplete) {
      setPathComplete(false);
      return;
    }

    void handleOnboardingBack();
  }, [handleOnboardingBack, pathComplete]);

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
    setPathRequested(false);
    setRemountTab('dashboard');
    setMainAppKey((prev) => prev + 1);
  }, []);

  const handleDemoActivated = useCallback(() => {
    setDemoModeActive(true);
    handleOnboardingComplete();
  }, [handleOnboardingComplete]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<FinancialStateChangedDetail>).detail;
      if (detail?.mode !== 'app') {
        return;
      }

      void (async () => {
        try {
          await resetFinancialQueriesForAppRefresh(queryClient);
          if (detail.refreshSession) {
            await refreshAuthenticatedSession({
              onAuthenticationError: () => {
                setAuthScreen('login');
              },
            });
          }
          if (detail.tab) {
            setRemountTab(detail.tab);
          }
          setMainAppKey((prev) => prev + 1);
        } catch {}
      })();
    };
    window.addEventListener(FINANCIAL_STATE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(FINANCIAL_STATE_CHANGED_EVENT, handler);
  }, [refreshAuthenticatedSession]);

  if (isLoading) {
    return <AppLoadingShell />;
  }

  if (!isAuthenticated) {
    return (
      <>
        <GradientShell className={uiTextRecipes.primary}>
          <div className={cn('flex', 'flex-col', 'min-h-dvh')}>
            <AppTitleBar state="unauthenticated" scrolled={false} isOnline={isOnline} />
            <main className={cn(...authLayout.main)}>
              {authScreen === 'login' ? (
                <LoginScreen
                  onNavigateToRegister={() => setAuthScreen('register')}
                  onLoginSuccess={handleAuthSuccess}
                  onEnrollmentRequired={handleEnrollmentRequired}
                  onRecoveryEnrollmentStarted={handleRecoveryEnrollmentStarted}
                  lockedEmail={needsPasskeyEnrollment ? enrollmentLockedEmail : null}
                />
              ) : (
                <RegisterScreen
                  onNavigateToLogin={() => setAuthScreen('login')}
                  onRegisterSuccess={handleAuthSuccess}
                />
              )}
            </main>
            <AppFooter />
          </div>
        </GradientShell>
        <EnrollPasskeyScreen
          isOpen={needsPasskeyEnrollment}
          pendingRecovery={pendingRecoveryEnrollment}
          onEnrollmentComplete={handleEnrollmentComplete}
          onLogout={handleLogout}
        />
      </>
    );
  }

  if (showOnboarding) {
    if (pathRequested || !pathComplete) {
      return (
        <OnboardingPathScreen
          isDemoModeActive={demoModeActive}
          onDemoActivated={handleDemoActivated}
          onContinueToProviders={() => {
            setPathRequested(false);
            setPathComplete(true);
          }}
          onLogout={handleLogout}
        />
      );
    }

    return (
      <OnboardingProviderPicker
        onComplete={handleOnboardingComplete}
        onBack={handleProviderPickerBack}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <SessionManager
      expiresAt={sessionExpiresAt}
      onSessionRefreshed={setSessionExpiresAt}
      onLogout={handleLogout}
    >
      <AccountFilterProvider key={`filter-${mainAppKey}`}>
        <TransactionListLauncherProvider>
          <AuthenticatedApp
            key={`app-${mainAppKey}`}
            onLogout={handleLogout}
            initialTab={remountTab}
            isOnline={isOnline}
            demoModeActive={demoModeActive}
          />
        </TransactionListLauncherProvider>
      </AccountFilterProvider>
      <EnrollPasskeyScreen
        isOpen={showEnrollmentModal}
        onEnrollmentComplete={handleEnrollmentComplete}
        onLogout={handleLogout}
      />
    </SessionManager>
  );
}

export interface AppProps {
  initialTab?: TabKey;
  initialAuthScreen?: 'login' | 'register';
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ControlTooltipProvider>
          <TelemetryProvider service={telemetryService}>{children}</TelemetryProvider>
        </ControlTooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export function App({ initialTab, initialAuthScreen }: AppProps) {
  return (
    <AppProviders>
      <AppContent initialTab={initialTab} initialAuthScreen={initialAuthScreen} />
    </AppProviders>
  );
}

export default App;
