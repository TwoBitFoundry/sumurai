'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/ui/primitives';
import { LoginScreen, RegisterScreen } from './Auth';
import { AuthenticatedApp, type TabKey } from './components/AuthenticatedApp';
import { OnboardingWizard } from './components/onboarding/OnboardingWizard';
import { ProviderMismatchCheck } from './components/ProviderMismatchCheck';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AccountFilterProvider } from './hooks/useAccountFilter';
import { TelemetryProvider, TelemetryService } from './observability';
import { SessionManager } from './SessionManager';
import { AuthService } from './services/authService';
import { BrowserStorageAdapter } from './services/boundaries';
import { AppFooter, AppTitleBar, GlassCard, GradientShell } from './ui/primitives';

AuthService.configure({
  storage: new BrowserStorageAdapter(),
});

const telemetryService = new TelemetryService();

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

  const { mode, toggle } = useTheme();

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
        console.warn('Auth validation error:', error);
        if (active) {
          setIsAuthenticated(false);
          setShowOnboarding(false);
          setSessionExpiresAt(null);
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
            className={cn('text-center', 'text-sm', 'text-slate-600', 'dark:text-slate-300')}
          >
            Loading...
          </GlassCard>
        </div>
      </GradientShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <GradientShell className={cn('text-slate-900', 'dark:text-slate-100')}>
        <div className={cn('flex', 'flex-col', 'min-h-screen')}>
          <AppTitleBar
            state="unauthenticated"
            scrolled={false}
            themeMode={mode}
            onThemeToggle={toggle}
          />
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
    return <OnboardingWizard onComplete={handleOnboardingComplete} onLogout={handleLogout} />;
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

export function App({ initialTab, initialAuthScreen }: AppProps) {
  return (
    <ThemeProvider>
      <TelemetryProvider service={telemetryService}>
        <AppContent initialTab={initialTab} initialAuthScreen={initialAuthScreen} />
      </TelemetryProvider>
    </ThemeProvider>
  );
}

export default App;
