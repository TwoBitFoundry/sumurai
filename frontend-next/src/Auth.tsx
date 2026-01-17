import React, { useState } from 'react'
import { AuthService } from './services/authService'
import { useRegistrationValidation } from './hooks/useRegistrationValidation'
import {
  GlassCard,
  Button,
  Input,
  Badge,
  Alert,
  FormLabel,
  RequirementPill,
  cn,
} from './ui/primitives'

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
    <div className={cn('flex', 'min-h-screen', 'items-center', 'justify-center', 'px-4', 'py-12', 'sm:px-6')}>
      <GlassCard variant="auth" padding="lg" className={cn('w-full', 'max-w-md')}>
        <div className="space-y-5">
          <div className={cn('space-y-3', 'text-center')}>
            <Badge size="md">Welcome Back</Badge>
            <h2 className={cn('text-3xl', 'font-semibold', 'text-slate-900', 'dark:text-white')}>Sign in to your account</h2>
            <p className={cn('text-[0.85rem]', 'text-slate-600', 'dark:text-slate-400')}>
              Access your latest financial dashboards and insights.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <Alert variant="error" title="Authentication error">
                {error}
              </Alert>
            )}

            <div className="space-y-1.5">
              <FormLabel htmlFor="email">Email</FormLabel>
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
              <FormLabel htmlFor="password">Password</FormLabel>
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

          <div className={cn('text-center', 'text-sm', 'text-slate-600', 'dark:text-slate-300')}>
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
    </div>
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
    <div className={cn('flex', 'min-h-screen', 'items-center', 'justify-center', 'px-4', 'py-12', 'sm:px-6')}>
      <GlassCard variant="auth" padding="lg" className={cn('w-full', 'max-w-md')}>
        <div className="space-y-5">
          <div className={cn('space-y-3', 'text-center')}>
            <Badge size="md">JOIN TODAY</Badge>
            <h2 className={cn('text-3xl', 'font-semibold', 'text-slate-900', 'dark:text-white')}>Sign Up for Sumurai</h2>
            <p className={cn('text-[0.85rem]', 'text-slate-600', 'dark:text-slate-400')}>
              Finish sign up to unlock onboarding and Plaid sync.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <Alert variant="error" title="Registration error">
                {error}
              </Alert>
            )}

            <div className="space-y-1.5">
              <FormLabel htmlFor="email">Email</FormLabel>
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
                <p className={cn('text-xs', 'text-red-600', 'dark:text-red-300')}>Please enter a valid email address.</p>
              )}
            </div>

            <div className={cn('grid', 'gap-4', 'md:grid-cols-2')}>
              <div className="space-y-1.5">
                <FormLabel htmlFor="password">Password</FormLabel>
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
                <FormLabel htmlFor="confirm-password">Confirm password</FormLabel>
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
                  <p className={cn('text-xs', 'text-red-600', 'dark:text-red-300')}>Passwords do not match.</p>
                )}
              </div>
            </div>

            <GlassCard
              variant="accent"
              rounded="lg"
              padding="sm"
              withInnerEffects={false}
              className={cn('space-y-1.5', 'text-[0.7rem]', 'text-slate-600', 'dark:text-slate-300')}
            >
              <h3 className={cn('text-[0.65rem]', 'font-semibold', 'uppercase', 'text-slate-700', 'dark:text-slate-200')}>
                Password checklist
              </h3>
              <div className={cn('flex', 'flex-wrap', 'gap-1.5')}>
                <RequirementPill status={passwordValidation.minLength ? 'met' : 'pending'}>
                  8+ characters
                </RequirementPill>
                <RequirementPill status={passwordValidation.hasCapital ? 'met' : 'pending'}>
                  1 capital letter
                </RequirementPill>
                <RequirementPill status={passwordValidation.hasNumber ? 'met' : 'pending'}>
                  1 number
                </RequirementPill>
                <RequirementPill status={passwordValidation.hasSpecial ? 'met' : 'pending'}>
                  1 special character
                </RequirementPill>
              </div>
            </GlassCard>

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

          <div className={cn('text-center', 'text-sm', 'text-slate-600', 'dark:text-slate-300')}>
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
    </div>
  )
}