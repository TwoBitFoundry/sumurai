import React, { Component, ErrorInfo, ReactNode } from 'react'
import { ApiError, AuthenticationError } from '../services/ApiClient'

interface Props {
  children: ReactNode
  onRetry?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })
    
    // Log error for debugging (in production, this could send to error reporting service)
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  private getErrorType(error: Error): 'auth' | 'network' | 'server' | 'generic' {
    if (error instanceof AuthenticationError || error.message.includes('Authentication required')) {
      return 'auth'
    }
    
    if (error.message.includes('Failed to fetch') || 
        error.message.includes('Network error') ||
        error.message.includes('DNS resolution')) {
      return 'network'
    }
    
    // Check if it's an ApiError or has status property
    if (error instanceof ApiError && error.status >= 500) {
      return 'server'
    }
    
    // Check for error objects that might have status but aren't instanceof ApiError
    if ((error as any).status >= 500 || error.name === 'ApiError') {
      return 'server'
    }
    
    return 'generic'
  }

  private sanitizeErrorMessage(message: string): string {
    // Remove potentially sensitive information from error messages
    const sensitivePatterns = [
      /password=\w+/gi,
      /token=[\w-]+/gi,
      /key=[\w-]+/gi,
      /secret=\w+/gi,
      /api_key=[\w-]+/gi
    ]
    
    let sanitized = message
    sensitivePatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]')
    })
    
    return sanitized
  }

  private handleRefresh = () => {
    window.location.reload()
  }

  private handleRetry = () => {
    if (this.props.onRetry) {
      this.props.onRetry()
    }
    
    // Reset error boundary state
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  private handleLogin = () => {
    // Navigate to login (in a real app, this would use React Router)
    window.location.href = '/login'
  }

  private renderErrorContent() {
    const { error } = this.state
    if (!error) return null

    const errorType = this.getErrorType(error)

    switch (errorType) {
      case 'auth':
        return (
          <div className="max-w-md mx-auto text-center p-8 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
            <div className="text-yellow-600 dark:text-yellow-400 text-4xl mb-4">🔐</div>
            <h2 className="text-xl font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
              Authentication Required
            </h2>
            <p className="text-yellow-700 dark:text-yellow-300 mb-4">
              Please log in to continue using the application.
            </p>
            <button
              onClick={this.handleLogin}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors"
            >
              Go to Login
            </button>
          </div>
        )

      case 'network':
        return (
          <div className="max-w-md mx-auto text-center p-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
            <div className="text-blue-600 dark:text-blue-400 text-4xl mb-4">📶</div>
            <h2 className="text-xl font-semibold text-blue-800 dark:text-blue-200 mb-2">
              Connection Problem
            </h2>
            <p className="text-blue-700 dark:text-blue-300 mb-4">
              Please check your internet connection and try again.
            </p>
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors mr-2"
            >
              Try Again
            </button>
            <button
              onClick={this.handleRefresh}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
            >
              Refresh Page
            </button>
          </div>
        )

      case 'server':
        return (
          <div className="max-w-md mx-auto text-center p-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <div className="text-red-600 dark:text-red-400 text-4xl mb-4">🔧</div>
            <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">
              Server Temporarily Unavailable
            </h2>
            <p className="text-red-700 dark:text-red-300 mb-4">
              Our server is temporarily unavailable. Please try again in a few minutes.
            </p>
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors mr-2"
            >
              Try Again
            </button>
          </div>
        )

      default:
        return (
          <div className="max-w-md mx-auto text-center p-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
            <div className="text-slate-600 dark:text-slate-400 text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">
              Something Went Wrong
            </h2>
            <p className="text-slate-700 dark:text-slate-300 mb-4">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            {this.props.onRetry && (
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors mr-2"
              >
                Try Again
              </button>
            )}
            <button
              onClick={this.handleRefresh}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
            >
              Refresh Page
            </button>
          </div>
        )
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-900">
          {this.renderErrorContent()}
        </div>
      )
    }

    return this.props.children
  }
}