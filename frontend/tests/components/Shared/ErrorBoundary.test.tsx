import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { trace, SpanStatusCode } from '@opentelemetry/api'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Mock console.error to avoid noise in test output
const originalConsoleError = console.error
beforeEach(() => {
  console.error = vi.fn()
})

afterEach(() => {
  console.error = originalConsoleError
  // Clean up DOM to prevent element leakage across tests
  cleanup()
})

const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>Success</div>
}

describe('ErrorBoundary', () => {
  describe('Error Catching', () => {
    it('should catch and display React component errors', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
      expect(screen.getByText(/test error/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /refresh page/i })).toBeInTheDocument()
    })

    it('should not display error UI when no error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      )

      expect(screen.getByText('Success')).toBeInTheDocument()
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument()
    })
  })

  describe('Authentication-Aware Error Handling', () => {
    it('should show login prompt for authentication errors', () => {
      const AuthenticationErrorComponent = () => {
        throw new Error('Authentication required')
      }

      render(
        <ErrorBoundary>
          <AuthenticationErrorComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/please log in/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /go to login/i })).toBeInTheDocument()
    })

    it('should show network error message for connection issues', () => {
      const NetworkErrorComponent = () => {
        throw new Error('Failed to fetch')
      }

      render(
        <ErrorBoundary>
          <NetworkErrorComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/connection problem/i)).toBeInTheDocument()
      expect(screen.getByText(/check your internet connection/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    })

    it('should show server error message for 5xx errors', () => {
      const ServerErrorComponent = () => {
        const error = new Error('Internal server error')
        error.name = 'ApiError'
        ;(error as any).status = 500
        throw error
      }

      render(
        <ErrorBoundary>
          <ServerErrorComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/server is temporarily unavailable/i)).toBeInTheDocument()
      expect(screen.getByText(/please try again in a few minutes/i)).toBeInTheDocument()
    })
  })

  describe('Recovery Actions', () => {
    it('should provide refresh button that reloads the page', () => {
      // Mock window.location.reload
      const mockReload = vi.fn()
      Object.defineProperty(window, 'location', {
        value: { reload: mockReload },
        writable: true
      })

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      const refreshButton = screen.getByRole('button', { name: /refresh page/i })
      refreshButton.click()

      expect(mockReload).toHaveBeenCalledOnce()
    })

    it('should provide retry mechanism for recoverable errors', () => {
      const mockRetry = vi.fn()

      render(
        <ErrorBoundary onRetry={mockRetry}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      const retryButton = screen.getByRole('button', { name: /try again/i })
      retryButton.click()

      expect(mockRetry).toHaveBeenCalledOnce()
    })
  })

  describe('Error Reporting', () => {
    it('should log error details for debugging', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(consoleSpy).toHaveBeenCalledWith(
        'ErrorBoundary caught an error:',
        expect.any(Error),
        expect.any(Object)
      )

      consoleSpy.mockRestore()
    })

    it('should not expose sensitive information in error messages', () => {
      const SensitiveErrorComponent = () => {
        throw new Error('Database connection failed: password=secret123')
      }

      render(
        <ErrorBoundary>
          <SensitiveErrorComponent />
        </ErrorBoundary>
      )

      expect(screen.queryByText(/password=secret123/i)).not.toBeInTheDocument()
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    })
  })

  describe('OpenTelemetry Instrumentation', () => {
    const mockSpan = {
      recordException: vi.fn(),
      setStatus: vi.fn(),
      end: vi.fn(),
      setAttributes: vi.fn(),
      addEvent: vi.fn(),
    }

    beforeEach(() => {
       
      vi.spyOn(trace, 'getActiveSpan').mockReturnValue(mockSpan as any) // any needed for mock
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should record error exception to active span', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(mockSpan.recordException).toHaveBeenCalled()
      const error = (mockSpan.recordException as any).mock.calls[0][0]
      expect(error.message).toBe('Test error')
    })

    it('should set error status on span', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: expect.any(String),
      })
    })

    it('should sanitize error message before recording to span', () => {
      const SensitiveErrorComponent = () => {
        throw new Error('Invalid token=abc123&key=xyz789')
      }

      render(
        <ErrorBoundary>
          <SensitiveErrorComponent />
        </ErrorBoundary>
      )

      expect(mockSpan.setStatus).toHaveBeenCalled()
      const status = (mockSpan.setStatus as any).mock.calls[0][0]
      expect(status.message).not.toContain('token=abc123')
      expect(status.message).toContain('[REDACTED]')
    })

    it('should only record to span if span exists', () => {
       
      vi.spyOn(trace, 'getActiveSpan').mockReturnValueOnce(undefined as any) // any needed for mock

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
      // span methods should not have been called since no active span
      expect(mockSpan.recordException).not.toHaveBeenCalled()
    })
  })
})
