import React, { useState, useEffect, useCallback } from "react";
import { Sun, Moon } from 'lucide-react';
import { LoginScreen, RegisterScreen } from "./Auth";
import { SessionManager } from "./SessionManager";
import { AuthenticatedApp } from "./components/AuthenticatedApp";
import { AccountFilterProvider } from "./hooks/useAccountFilter";
import { OnboardingWizard } from "./components/onboarding/OnboardingWizard";
import { AuthService } from "./services/authService";
import { getInitialTheme, setTheme } from "./utils/theme";
import { ProviderMismatchCheck } from "./components/ProviderMismatchCheck";

const parseJWT = (token: string) => {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = atob(base64)
    return JSON.parse(jsonPayload)
  } catch (error) {
    return null
  }
}

const isTokenExpired = (token: string): boolean => {
  const payload = parseJWT(token)
  if (!payload?.exp) return true
  return Math.floor(Date.now() / 1000) >= payload.exp
}

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login')
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [mainAppKey, setMainAppKey] = useState(0)
  const [showProviderMismatch, setShowProviderMismatch] = useState(false)

  const [dark, setDark] = useState(() => getInitialTheme())

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
      <div className={dark ? 'dark' : ''}>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
          <div className="text-lg text-slate-600 dark:text-slate-400">Loading...</div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className={dark ? 'dark' : ''}>
        <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300">
          <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <div className="px-4 h-16 flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-lg">Sumaura</div>
              <div className="flex items-center">
                <button
                  onClick={() => {
                    const newTheme = !dark;
                    setDark(newTheme);
                    setTheme(newTheme);
                  }}
                  className="px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-200"
                  aria-label="Toggle theme"
                  title="Toggle theme"
                >
                  {dark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </header>
          <main>
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
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
            </div>
          </main>
        </div>
      </div>
    )
  }

  if (showOnboarding) {
    return (
      <OnboardingWizard
        onComplete={handleOnboardingComplete}
        dark={dark}
        setDark={(newTheme: boolean) => {
          setDark(newTheme);
          setTheme(newTheme);
        }}
        onLogout={handleLogout}
      />
    )
  }

  return (
    <div className={dark ? 'dark' : ''}>
      <SessionManager onLogout={handleLogout}>
        <AccountFilterProvider key={`filter-${mainAppKey}`}>
          <AuthenticatedApp
            key={`app-${mainAppKey}`}
            onLogout={handleLogout}
            dark={dark}
            setDark={(newTheme: boolean) => {
              setDark(newTheme);
              setTheme(newTheme);
            }}
          />
        </AccountFilterProvider>
      </SessionManager>

      <ProviderMismatchCheck
        showMismatch={showProviderMismatch}
        onShowMismatch={setShowProviderMismatch}
        onConfirm={handleProviderMismatchConfirm}
      />
    </div>
  )
}

export default App;
