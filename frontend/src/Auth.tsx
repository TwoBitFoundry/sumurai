import React, { useState } from 'react'
import { AuthService } from './services/authService'
import { useRegistrationValidation } from './hooks/useRegistrationValidation'

interface LoginScreenProps {
  onNavigateToRegister: () => void
  onLoginSuccess?: (authResponse: { token: string; onboarding_completed: boolean }) => void
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-[2.25rem] border border-white/35 bg-white/20 p-8 shadow-[0_38px_120px_-60px_rgba(15,23,42,0.78)] backdrop-blur-[26px] backdrop-saturate-[140%] transition-all duration-300 ease-out dark:border-white/12 dark:bg-[#0f172a]/55 dark:shadow-[0_40px_120px_-58px_rgba(2,6,23,0.85)] ${className}`}>
      <div className="pointer-events-none absolute inset-0 rounded-[2.2rem] ring-1 ring-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(15,23,42,0.25)] dark:ring-white/10 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(2,6,23,0.55)]" />
      <div className="pointer-events-none absolute inset-0 rounded-[2.2rem] bg-[radial-gradient(120%_150%_at_85%_0%,rgba(14,165,233,0.18)_0%,rgba(167,139,250,0.18)_42%,transparent_72%)] opacity-70 dark:bg-[radial-gradient(120%_150%_at_90%_6%,rgba(38,198,218,0.28)_0%,rgba(167,139,250,0.24)_45%,transparent_75%)]" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(110%_90%_at_15%_-10%,#f8fafc_0%,#f1f5f9_45%,#ffffff_100%)] transition-colors duration-500 ease-out dark:bg-[radial-gradient(90%_70%_at_20%_0%,#0f172a_0%,#0a0f1b_50%,#05070d_100%)]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="absolute left-1/2 top-1/2 h-[60rem] w-[60rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.22] blur-3xl animate-[rotateAura_100s_linear_infinite] bg-[conic-gradient(from_0deg,#93c5fd_0deg,#34d399_150deg,#fbbf24_260deg,#a78bfa_340deg,#93c5fd_360deg)] transition-opacity duration-500 dark:opacity-[0.34] dark:bg-[conic-gradient(from_0deg,#38bdf8_0deg,#34d399_140deg,#a78bfa_250deg,#fbbf24_310deg,#f87171_350deg,#38bdf8_360deg)]" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-white/45 to-transparent transition-colors duration-500 ease-out dark:from-slate-900/70 dark:via-slate-900/40 dark:to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_50%,transparent_58%,rgba(15,23,42,0.1)_100%)] transition-opacity duration-500 ease-out dark:bg-[radial-gradient(120%_120%_at_50%_50%,transparent_56%,rgba(2,6,23,0.32)_100%)]" />
      </div>

      <div className="relative z-10 flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12 sm:px-6">
        {children}
      </div>
    </div>
  )
}

export function LoginScreen({ onNavigateToRegister, onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const inputBaseClasses =
    'w-full rounded-xl border bg-white px-4 text-sm font-medium text-slate-900 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)] transition-all duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#111a2f] dark:text-white'
  const inputFocusClasses =
    'border-black/10 focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-white dark:border-white/12 dark:focus:ring-sky-400/80 dark:focus:ring-offset-[#0f172a]'

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
    <AuthShell>
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="space-y-5">
          <div className="space-y-3 text-center">
            <span className="inline-flex items-center justify-center rounded-full bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600 shadow-[0_12px_32px_-22px_rgba(15,23,42,0.45)] dark:bg-[#1e293b]/70 dark:text-slate-200">
              Welcome Back
            </span>
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
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className={`${inputBaseClasses} py-2.5 ${inputFocusClasses}`}
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
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className={`${inputBaseClasses} py-2.5 ${inputFocusClasses}`}
                placeholder="••••••••"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-sky-500 via-sky-400 to-violet-500 px-5 py-2.5 text-[0.95rem] font-semibold text-white shadow-[0_22px_60px_-32px_rgba(14,165,233,0.85)] transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-[#0f172a]"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="text-center text-sm text-slate-600 dark:text-slate-300">
            <p className="mb-3">Don't have an account?</p>
            <button
              type="button"
              onClick={onNavigateToRegister}
              className="inline-flex items-center justify-center rounded-full border border-white/50 bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-slate-800 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.45)] transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white/15 dark:bg-[#1e293b]/70 dark:text-slate-200 dark:focus-visible:ring-offset-[#0f172a]"
            >
              Create account
            </button>
          </div>
        </div>
      </Card>
    </AuthShell>
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

  const inputBaseClasses =
    'w-full rounded-xl border bg-white px-4 text-sm font-medium text-slate-900 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)] transition-all duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#111a2f] dark:text-white'
  const inputValidClasses =
    'border-black/10 focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-white dark:border-white/12 dark:focus:ring-sky-400/80 dark:focus:ring-offset-[#0f172a]'
  const inputInvalidClasses =
    'border-red-300 focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-white dark:border-red-600/80 dark:focus:ring-red-400/75 dark:focus:ring-offset-[#0f172a]'

  return (
    <AuthShell>
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="space-y-5">
          <div className="space-y-3 text-center">
            <span className="inline-flex items-center justify-center rounded-full bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600 shadow-[0_12px_32px_-22px_rgba(15,23,42,0.45)] dark:bg-[#1e293b]/70 dark:text-slate-200">
              JOIN TODAY
            </span>
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
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className={`${inputBaseClasses} py-2.5 ${email && !isEmailValid ? inputInvalidClasses : inputValidClasses}`}
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
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className={`${inputBaseClasses} py-2.5 ${
                    password && !passwordValidation.isValid ? inputInvalidClasses : inputValidClasses
                  }`}
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
                <input
                  type="password"
                  id="confirm-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className={`${inputBaseClasses} py-2.5 ${
                    confirmPassword && !isPasswordMatch ? inputInvalidClasses : inputValidClasses
                  }`}
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

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-sky-500 via-sky-400 to-violet-500 px-5 py-2.5 text-[0.95rem] font-semibold text-white shadow-[0_22px_60px_-32px_rgba(14,165,233,0.85)] transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-[#0f172a]"
            >
              {isLoading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <div className="text-center text-sm text-slate-600 dark:text-slate-300">
            <p className="mb-3">Already have an account?</p>
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="inline-flex items-center justify-center rounded-full border border-white/50 bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-slate-800 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.45)] transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white/15 dark:bg-[#1e293b]/70 dark:text-slate-200 dark:focus-visible:ring-offset-[#0f172a]"
            >
              Sign in
            </button>
          </div>
        </div>
      </Card>
    </AuthShell>
  )
}
