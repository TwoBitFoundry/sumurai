import React, { useState } from 'react'
import { AuthService } from './services/authService'
import { useRegistrationValidation } from './hooks/useRegistrationValidation'
import { GlassCard, GradientShell, Button, Input, Badge } from './ui/primitives'

interface LoginScreenProps {
  onNavigateToRegister: () => void
  onLoginSuccess?: (authResponse: { token: string; onboarding_completed: boolean }) => void
}

export function LoginScreen({ onNavigateToRegister, onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await AuthService.login({ email, password })
      AuthService.storeToken(response.token)
      onLoginSuccess?.(response)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed. Please check your credentials.'
      setError(errorMessage)
      console.error('Login failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <GradientShell variant="auth">
      <GlassCard variant="auth" padding="lg" className="w-full max-w-md">
        <div className="space-y-5">
          <div className="space-y-3 text-center">
            <Badge size="md">Welcome Back</Badge>
            <h2 className="text-3xl font-semibold text-slate-900 dark:text-white">Sign in to your account</h2>
            <p className="text-[0.85rem] text-slate-600 dark:text-slate-400">
              Access your latest financial dashboards and insights.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-2xl border border-red-200/70 bg-red-50/80 px-4 py-3 text-left shadow-sm dark:border-red-700/60 dark:bg-red-900/25">
                <p className="text-sm font-medium text-red-600 dark:text-red-300">{error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 dark:text-slate-200"
              >
                Email
              </label>
              <Input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 dark:text-slate-200"
              >
                Password
              </label>
              <Input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              variant="primary"
              size="lg"
              className="w-full"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="text-center text-sm text-slate-600 dark:text-slate-300">
            <p className="mb-3">Don't have an account?</p>
            <Button
              type="button"
              onClick={onNavigateToRegister}
              variant="ghost"
              size="sm"
            >
              Create account
            </Button>
          </div>
        </div>
      </GlassCard>
    </GradientShell>
  )
}

interface RegisterScreenProps {
  onNavigateToLogin: () => void
  onRegisterSuccess?: (authResponse: { token: string; onboarding_completed: boolean }) => void
}

export function RegisterScreen({ onNavigateToLogin, onRegisterSuccess }: RegisterScreenProps) {
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const {
    email,
    password,
    confirmPassword,
    isEmailValid,
    passwordValidation,
    isPasswordMatch,
    setEmail,
    setPassword,
    setConfirmPassword,
    validateForm
  } = useRegistrationValidation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsLoading(true)

    try {
      const response = await AuthService.register({ email, password })
      AuthService.storeToken(response.token)
      onRegisterSuccess?.(response)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed'
      setError(errorMessage)
      console.error('Registration failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <GradientShell variant="auth">
      <GlassCard variant="auth" padding="lg" className="w-full max-w-md">
        <div className="space-y-5">
          <div className="space-y-3 text-center">
            <Badge size="md">JOIN TODAY</Badge>
            <h2 className="text-3xl font-semibold text-slate-900 dark:text-white">Sign Up for Sumaura</h2>
            <p className="text-[0.85rem] text-slate-600 dark:text-slate-400">
              Finish sign up to unlock onboarding and Plaid sync.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-2xl border border-red-200/70 bg-red-50/80 px-4 py-3 text-left shadow-sm dark:border-red-700/60 dark:bg-red-900/25">
                <p className="text-sm font-medium text-red-600 dark:text-red-300">{error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-semibold tracking-[0.18em] text-slate-700 uppercase dark:text-slate-200"
              >
                Email
              </label>
              <Input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                variant={email && !isEmailValid ? 'invalid' : 'default'}
                placeholder="you@example.com"
                disabled={isLoading}
              />
              {email && !isEmailValid && (
                <p className="text-xs text-red-600 dark:text-red-300">Please enter a valid email address.</p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 dark:text-slate-200"
                >
                  Password
                </label>
                <Input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  variant={password && !passwordValidation.isValid ? 'invalid' : 'default'}
                  placeholder="Create a password"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="confirm-password"
                  className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 dark:text-slate-200"
                >
                  Confirm password
                </label>
                <Input
                  type="password"
                  id="confirm-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  variant={confirmPassword && !isPasswordMatch ? 'invalid' : 'default'}
                  placeholder="Re-enter password"
                  disabled={isLoading}
                />
                {confirmPassword && !isPasswordMatch && (
                  <p className="text-xs text-red-600 dark:text-red-300">Passwords do not match.</p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-white/55 bg-white/85 px-3.5 py-3 text-[0.7rem] shadow-[0_16px_42px_-38px_rgba(15,23,42,0.4)] dark:border-white/12 dark:bg-[#111a2f] dark:text-slate-300">
              <h3 className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.26em] text-slate-700 dark:text-slate-200">
                Password checklist
              </h3>
              <ul className="flex flex-wrap gap-1.5">
                <li className={`rounded-full px-2.5 py-1 font-medium ${
                  passwordValidation.minLength ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-white/60 text-slate-500 dark:bg-white/5 dark:text-slate-400'
                }`}>
                  8+ characters
                </li>
                <li className={`rounded-full px-2.5 py-1 font-medium ${
                  passwordValidation.hasCapital ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-white/60 text-slate-500 dark:bg-white/5 dark:text-slate-400'
                }`}>
                  1 capital letter
                </li>
                <li className={`rounded-full px-2.5 py-1 font-medium ${
                  passwordValidation.hasNumber ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-white/60 text-slate-500 dark:bg-white/5 dark:text-slate-400'
                }`}>
                  1 number
                </li>
                <li className={`rounded-full px-2.5 py-1 font-medium ${
                  passwordValidation.hasSpecial ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-white/60 text-slate-500 dark:bg-white/5 dark:text-slate-400'
                }`}>
                  1 special character
                </li>
              </ul>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              variant="primary"
              size="lg"
              className="w-full"
            >
              {isLoading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          <div className="text-center text-sm text-slate-600 dark:text-slate-300">
            <p className="mb-3">Already have an account?</p>
            <Button
              type="button"
              onClick={onNavigateToLogin}
              variant="ghost"
              size="sm"
            >
              Sign in
            </Button>
          </div>
        </div>
      </GlassCard>
    </GradientShell>
  )
}
