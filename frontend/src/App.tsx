'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { cn } from '@/ui/primitives';
import { LoginScreen, RegisterScreen } from './Auth';
import { AuthenticatedApp, type TabKey } from './components/AuthenticatedApp';
import { OnboardingProviderPicker } from './components/onboarding/OnboardingProviderPicker';
import { ProviderMismatchCheck } from './components/ProviderMismatchCheck';
import { ThemeProvider } from './context/ThemeContext';
import { AccountFilterProvider } from './hooks/useAccountFilter';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { TelemetryProvider, TelemetryService } from './observability';
import { SessionManager } from './SessionManager';
import { AuthenticationError } from './services/ApiClient';
import { AuthService } from './services/authService';
import { BrowserStorageAdapter } from './services/boundaries';
import { AppFooter, AppTitleBar, GlassCard, GradientShell } from './ui/primitives';
import { text as uiTextRecipes, font as uiTypographyRecipes } from './ui/recipes';

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
  const [isLoading, setIsLoading] = useState(true);
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>(initialAuthScreen ?? 'login');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [mainAppKey, setMainAppKey] = useState(0);
  const [showProviderMismatch, setShowProviderMismatch] = useState(false);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null);

  const isOnline = useOnlineStatus();

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
      } catch (error) {
        if (active) {
          setIsAuthenticated(false);
          setShowOnboarding(false);
          setSessionExpiresAt(null);
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
    (authResponse: { user_id: string; expires_at: string; onboarding_completed: boolean }) => {
      setIsAuthenticated(true);
      setShowOnboarding(!authResponse.onboarding_completed);
      setSessionExpiresAt(authResponse.expires_at);
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
    setShowOnboarding(false);
    setSessionExpiresAt(null);
    setAuthScreen('login');
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
    setMainAppKey((prev) => prev + 1);
  }, []);

  const handleProviderMismatchConfirm = useCallback(async () => {
    setShowProviderMismatch(false);
    await handleLogout();
  }, [handleLogout]);

  if (isLoading) {
    return (
      <GradientShell>
        <div className={cn('flex', 'min-h-screen', 'items-center', 'justify-center', 'px-4')}>
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
      <GradientShell className={uiTextRecipes.primary}>
        <div className={cn('flex', 'flex-col', 'min-h-screen')}>
          <AppTitleBar state="unauthenticated" scrolled={false} isOnline={isOnline} />
          <main className={cn('flex-1', 'flex', 'items-center', 'justify-center')}>
            {authScreen === 'login' ? (
              <LoginScreen
                onNavigateToRegister={() => setAuthScreen('register')}
                onLoginSuccess={handleAuthSuccess}
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
        <AuthenticatedApp
          key={`app-${mainAppKey}`}
          onLogout={handleLogout}
          initialTab={initialTab}
          isOnline={isOnline}
        />
      </AccountFilterProvider>

      <ProviderMismatchCheck
        showMismatch={showProviderMismatch}
        onShowMismatch={setShowProviderMismatch}
        onConfirm={handleProviderMismatchConfirm}
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
        <TelemetryProvider service={telemetryService}>{children}</TelemetryProvider>
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
