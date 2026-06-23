'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { cn } from '@/ui/primitives';
import { LoginScreen, RegisterScreen } from './Auth';
import { AuthenticatedApp, type TabKey } from './components/AuthenticatedApp';
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
import { text as uiTextRecipes, font as uiTypographyRecipes } from './ui/recipes';
import { PROVIDER_CONNECTED_EVENT } from './utils/events';

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

  const isOnline = useOnlineStatus();

  useEffect(() => {
    const handler = () => setShowEnrollmentModal(true);
    window.addEventListener('sumurai:enrollment-required', handler);
    return () => window.removeEventListener('sumurai:enrollment-required', handler);
  }, []);

  useEffect(() => {
    let active = true;
    const establishSession = async () => {
      try {
        const refreshResponse = await AuthService.refreshToken();
        if (!active) {
          return;
        }
        setIsAuthenticated(true);
        setShowOnboarding(!refreshResponse.onboarding_completed);
        setSessionExpiresAt(refreshResponse.expires_at);
        setDemoModeActive(refreshResponse.demo_mode_active);
        if (refreshResponse.email) {
          queryClient.setQueryData(['user', 'email'], refreshResponse.email);
        }
      } catch (error) {
        if (active) {
          setIsAuthenticated(false);
          setShowOnboarding(false);
          setSessionExpiresAt(null);
          setDemoModeActive(false);
        }
        if (!(error instanceof AuthenticationError)) {
          console.warn('Auth validation error:', error);
        }
        AuthService.clearToken();
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
  }, []);

  const handleAuthSuccess = useCallback(
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
      if (authResponse.email) {
        queryClient.setQueryData(['user', 'email'], authResponse.email);
      }
    },
    []
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
    setAuthScreen('login');
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
    setRemountTab('dashboard');
    setMainAppKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const handler = () => {
      setRemountTab('accounts');
      setMainAppKey((prev) => prev + 1);
    };
    window.addEventListener(PROVIDER_CONNECTED_EVENT, handler);
    return () => window.removeEventListener(PROVIDER_CONNECTED_EVENT, handler);
  }, []);

  if (isLoading) {
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

  if (!isAuthenticated) {
    return (
      <>
        <GradientShell className={uiTextRecipes.primary}>
          <div className={cn('flex', 'flex-col', 'min-h-dvh')}>
            <AppTitleBar state="unauthenticated" scrolled={false} isOnline={isOnline} />
            <main className={cn('flex-1', 'flex', 'items-center', 'justify-center')}>
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
    return (
      <OnboardingProviderPicker onComplete={handleOnboardingComplete} onLogout={handleLogout} />
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
