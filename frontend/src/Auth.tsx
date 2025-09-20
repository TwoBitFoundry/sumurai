import React, { useState } from 'react'
import { AuthService } from './services/authService'
import { useRegistrationValidation } from './hooks/useRegistrationValidation'

interface LoginScreenProps {
  onNavigateToRegister: () => void
  onLoginSuccess?: (authResponse: { token: string; onboarding_completed: boolean }) => void
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-lg dark:shadow-2xl ${className}`}>
      {children}
    </div>
  )
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
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Welcome Back
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Sign in to your account
          </p>
        </div>
        
        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
              <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}
          
          <div>
            <label 
              htmlFor="email" 
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Email
            </label>
            <input 
              type="email" 
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="Enter your email"
              disabled={isLoading}
            />
          </div>
          
          <div>
            <label 
              htmlFor="password" 
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Password
            </label>
            <input 
              type="password" 
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="Enter your password"
              disabled={isLoading}
            />
          </div>
          
          <button 
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Don't have an account?
          </p>
          <button 
            type="button" 
            onClick={onNavigateToRegister}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
          >
            Create Account
          </button>
        </div>
      </Card>
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
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Create Account
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Join us today
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
              <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full px-4 py-3 rounded-lg border bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 transition-colors ${
                email && !isEmailValid
                  ? 'border-red-300 dark:border-red-600 focus:ring-red-500 focus:border-red-500'
                  : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500 focus:border-blue-500'
              }`}
              placeholder="Enter your email"
              disabled={isLoading}
            />
            {email && !isEmailValid && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                Please enter a valid email address
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-4 py-3 rounded-lg border bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 transition-colors ${
                password && !passwordValidation.isValid
                  ? 'border-red-300 dark:border-red-600 focus:ring-red-500 focus:border-red-500'
                  : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500 focus:border-blue-500'
              }`}
              placeholder="Enter your password"
              disabled={isLoading}
            />
          </div>

          <div>
            <label 
              htmlFor="confirm-password" 
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Confirm Password
            </label>
            <input
              type="password"
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`w-full px-4 py-3 rounded-lg border bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 transition-colors ${
                confirmPassword && !isPasswordMatch
                  ? 'border-red-300 dark:border-red-600 focus:ring-red-500 focus:border-red-500'
                  : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500 focus:border-blue-500'
              }`}
              placeholder="Confirm your password"
              disabled={isLoading}
            />
            {confirmPassword && !isPasswordMatch && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                Passwords do not match
              </p>
            )}
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Password Requirements:
            </h3>
            <ul className="text-xs space-y-1">
              <li className={passwordValidation.minLength ? 'text-green-600 dark:text-green-400' : 'text-slate-600 dark:text-slate-400'}>
                {passwordValidation.minLength ? '✓' : '•'} 8+ characters
              </li>
              <li className={passwordValidation.hasCapital ? 'text-green-600 dark:text-green-400' : 'text-slate-600 dark:text-slate-400'}>
                {passwordValidation.hasCapital ? '✓' : '•'} 1 capital letter
              </li>
              <li className={passwordValidation.hasNumber ? 'text-green-600 dark:text-green-400' : 'text-slate-600 dark:text-slate-400'}>
                {passwordValidation.hasNumber ? '✓' : '•'} 1 number
              </li>
              <li className={passwordValidation.hasSpecial ? 'text-green-600 dark:text-green-400' : 'text-slate-600 dark:text-slate-400'}>
                {passwordValidation.hasSpecial ? '✓' : '•'} 1 special character
              </li>
            </ul>
          </div>
          
          <button 
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Already have an account?
          </p>
          <button 
            type="button" 
            onClick={onNavigateToLogin}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
          >
            Sign In
          </button>
        </div>
      </Card>
    </div>
  )
}
