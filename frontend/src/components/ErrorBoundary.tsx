import React, { Component, ErrorInfo, ReactNode } from 'react'
import { trace, SpanStatusCode } from '@opentelemetry/api'
import { Lock, WifiOff, Wrench, AlertCircle } from 'lucide-react'
import { ApiError, AuthenticationError } from '../services/ApiClient'
import { Button, GlassCard } from '@/ui/primitives'
import { cn } from '@/ui/primitives/utils'

interface Props {
  children: ReactNode
  onRetry?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

type ErrorTone = 'auth' | 'network' | 'server' | 'generic'

const hasStatusCode = (value: unknown): value is { status: number } => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  return 'status' in value && typeof (value as { status?: unknown }).status === 'number'
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
      errorInfo,
    })

    const span = trace.getActiveSpan()
    if (span) {
      span.recordException(error)
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: this.sanitizeErrorMessage(error.message),
      })
    }

    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  private getErrorType(error: Error): ErrorTone {
    if (error instanceof AuthenticationError || error.message.includes('Authentication required')) {
      return 'auth'
    }

    if (
      error.message.includes('Failed to fetch') ||
      error.message.includes('Network error') ||
      error.message.includes('DNS resolution')
    ) {
      return 'network'
    }

    if (error instanceof ApiError && error.status >= 500) {
      return 'server'
    }

    if (hasStatusCode(error) && error.status >= 500) {
      return 'server'
    }

    return 'generic'
  }

  private sanitizeErrorMessage(message: string): string {
    const sensitivePatterns = [
      /password=\w+/gi,
      /token=[\w-]+/gi,
      /key=[\w-]+/gi,
      /secret=\w+/gi,
      /api_key=[\w-]+/gi,
    ]

    let sanitized = message
    sensitivePatterns.forEach((pattern) => {
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

    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  private handleLogin = () => {
    window.location.href = '/login'
  }

  private renderCard({
    icon: Icon,
    title,
    message,
    actions,
  }: {
    icon: React.ComponentType<{ className?: string }>
    title: string
    message: string
    actions?: React.ReactNode
  }) {
    return (
      <GlassCard
        variant="accent"
        rounded="xl"
        padding="lg"
        withInnerEffects={false}
        className={cn('space-y-5', 'text-center')}
      >
        <div className={cn('flex', 'justify-center')}>
          <Icon className={cn('h-10', 'w-10', 'text-slate-600', 'dark:text-slate-400')} />
        </div>
        <div className="space-y-2">
          <h2 className={cn('text-xl', 'font-semibold', 'text-slate-900', 'dark:text-white')}>{title}</h2>
          <p className={cn('text-sm', 'text-slate-600', 'dark:text-slate-300')}>{message}</p>
        </div>
        {actions && <div className={cn('flex', 'flex-wrap', 'justify-center', 'gap-3')}>{actions}</div>}
      </GlassCard>
    )
  }

  private renderErrorContent() {
    const { error } = this.state
    if (!error) return null

    const errorType = this.getErrorType(error)
    const sanitizedMessage = this.sanitizeErrorMessage(error.message)

    switch (errorType) {
      case 'auth':
        return this.renderCard({
          icon: Lock,
          title: 'Authentication Required',
          message: 'Please log in to continue using the application.',
          actions: (
            <Button variant="primary" onClick={this.handleLogin}>
              Go to Login
            </Button>
          ),
        })
      case 'network':
        return this.renderCard({
          icon: WifiOff,
          title: 'Connection Problem',
          message: 'Please check your internet connection and try again.',
          actions: (
            <>
              <Button variant="secondary" onClick={this.handleRetry}>
                Try Again
              </Button>
              <Button variant="secondary" onClick={this.handleRefresh}>
                Refresh Page
              </Button>
            </>
          ),
        })
      case 'server':
        return this.renderCard({
          icon: Wrench,
          title: 'Server Temporarily Unavailable',
          message: 'Our server is temporarily unavailable. Please try again in a few minutes.',
          actions: (
            <Button variant="secondary" onClick={this.handleRetry}>
              Try Again
            </Button>
          ),
        })
      default:
        return this.renderCard({
          icon: AlertCircle,
          title: 'Something Went Wrong',
          message: sanitizedMessage || 'An unexpected error occurred. Please try refreshing the page.',
          actions: (
            <>
              {this.props.onRetry && (
                <Button variant="secondary" onClick={this.handleRetry}>
                  Try Again
                </Button>
              )}
              <Button variant="secondary" onClick={this.handleRefresh}>
                Refresh Page
              </Button>
            </>
          ),
        })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={cn('min-h-screen p-4', 'bg-slate-100 dark:bg-slate-900')}>
          <div className={cn('flex', 'h-full', 'items-center', 'justify-center')}>
            {this.renderErrorContent()}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary