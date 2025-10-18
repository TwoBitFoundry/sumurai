import React, { useState, useEffect, useCallback } from "react";
import { LoginScreen, RegisterScreen } from "./Auth";
import { SessionManager } from "./SessionManager";
import { AuthenticatedApp } from "./components/AuthenticatedApp";
import { AccountFilterProvider } from "./hooks/useAccountFilter";
import { OnboardingWizard } from "./components/onboarding/OnboardingWizard";
import { AuthService } from "./services/authService";
import { BrowserStorageAdapter } from "./services/boundaries";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { ProviderMismatchCheck } from "./components/ProviderMismatchCheck";
import { GlassCard, GradientShell, AppTitleBar, AppFooter } from './ui/primitives';
import { cn } from '@/ui/primitives'

AuthService.configure({
  storage: new BrowserStorageAdapter()
});

const parseJWT = (token: string) => {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = atob(base64)
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

const isTokenExpired = (token: string): boolean => {
  const payload = parseJWT(token)
  if (!payload?.exp) return true
  return Math.floor(Date.now() / 1000) >= payload.exp
}

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login')
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [mainAppKey, setMainAppKey] = useState(0)
  const [showProviderMismatch, setShowProviderMismatch] = useState(false)

  const { mode, toggle } = useTheme()

  useEffect(() => {
    const checkAuth = async () => {
      const token = sessionStorage.getItem('auth_token')

      if (!token || isTokenExpired(token)) {
        setIsAuthenticated(false)
        sessionStorage.removeItem('auth_token')
        setIsLoading(false)
        return
      }

      const isValid = await AuthService.validateSession()
      if (!isValid) {
        setIsAuthenticated(false)
        setIsLoading(false)
        return
      }

      try {
        const refreshResponse = await AuthService.refreshToken()
        AuthService.storeToken(refreshResponse.token)
        setIsAuthenticated(true)
        setShowOnboarding(!refreshResponse.onboarding_completed)
      } catch (error) {
        console.warn('Auth validation error:', error)
        setIsAuthenticated(false)
        AuthService.clearToken()
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const handleAuthSuccess = useCallback((authResponse: { token: string; onboarding_completed: boolean }) => {
    sessionStorage.setItem('auth_token', authResponse.token)
    setIsAuthenticated(true)
    setShowOnboarding(!authResponse.onboarding_completed)
  }, [])

  const handleLogout = useCallback(async () => {
    try {
      await AuthService.logout()
    } catch (error) {
      console.error('Logout error:', error)
    }

    setIsAuthenticated(false)
    setShowOnboarding(false)
    setAuthScreen('login')
  }, [])

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false)
    setMainAppKey(prev => prev + 1)
  }, [])


  const handleProviderMismatchConfirm = useCallback(async () => {
    setShowProviderMismatch(false)
    await handleLogout()
  }, [handleLogout])

  if (isLoading) {
    return (
      <GradientShell variant="app">
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
    )
  }

  if (!isAuthenticated) {
    return (
      <div className={cn('min-h-screen', 'flex', 'flex-col', 'bg-white', 'dark:bg-slate-900', 'text-slate-900', 'dark:text-slate-100')}>
        <AppTitleBar
          state="unauthenticated"
          scrolled={false}
          themeMode={mode}
          onThemeToggle={toggle}
        />
        <main className={cn('flex-1')}>
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
    )
  }

  if (showOnboarding) {
    return (
      <OnboardingWizard
        onComplete={handleOnboardingComplete}
        onLogout={handleLogout}
      />
    )
  }

  return (
    <SessionManager onLogout={handleLogout}>
      <AccountFilterProvider key={`filter-${mainAppKey}`}>
        <AuthenticatedApp
          key={`app-${mainAppKey}`}
          onLogout={handleLogout}
        />
      </AccountFilterProvider>

      <ProviderMismatchCheck
        showMismatch={showProviderMismatch}
        onShowMismatch={setShowProviderMismatch}
        onConfirm={handleProviderMismatchConfirm}
      />
    </SessionManager>
  )
}

export function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}

export default App;