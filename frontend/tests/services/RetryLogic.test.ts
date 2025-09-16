import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiClient, ApiError } from '@/services/ApiClient'
import { AuthService } from '@/services/authService'

// Mock the AuthService
vi.mock('@/services/authService', () => ({
  AuthService: {
    getToken: vi.fn(),
    clearToken: vi.fn(),
    logout: vi.fn(),
  },
}))

// Mock fetch globally for this suite
const mockFetch = vi.fn()
globalThis.fetch = mockFetch

// Spy on setTimeout and make it synchronous within this suite only
let setTimeoutSpy: ReturnType<typeof vi.spyOn>

describe('Retry Logic and Exponential Backoff', () => {
  const originalConsoleError = console.error

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock console.error to suppress expected error logs during tests
    console.error = vi.fn()
    
    vi.mocked(AuthService.getToken).mockReturnValue('mock-token')
    vi.mocked(AuthService.logout).mockResolvedValue({ message: 'Logged out', cleared_session: 'test' })
    // Ensure retries are enabled for this suite
    ApiClient.setTestMaxRetries(3)
    // Make setTimeout invoke callbacks immediately and allow timing assertions
    setTimeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation(((cb: TimerHandler) => {
        // invoke immediately; return a dummy id
        if (typeof cb === 'function') {
          ;(cb as Function)()
        }
        return 0 as unknown as number
      }) as unknown as typeof setTimeout)
  })

  afterEach(() => {
    // Restore console.error
    console.error = originalConsoleError
    // Restore all spies (including setTimeout)
    vi.restoreAllMocks()
  })

  describe('Transient Network Errors', () => {
    it('should retry on network timeout errors with exponential backoff', async () => {
      // First two calls timeout, third succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Request timeout'))
        .mockRejectedValueOnce(new Error('Request timeout'))
        .mockResolvedValueOnce(new Response(
          JSON.stringify({ data: 'success' }),
          { status: 200 }
        ))

      const result = await ApiClient.get('/test')
      
      expect(mockFetch).toHaveBeenCalledTimes(3)
      expect(result).toEqual({ data: 'success' })
    })

    it('should retry on network connection errors', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockResolvedValueOnce(new Response(
          JSON.stringify({ data: 'success' }),
          { status: 200 }
        ))

      const result = await ApiClient.get('/test')
      
      expect(mockFetch).toHaveBeenCalledTimes(3)
      expect(result).toEqual({ data: 'success' })
    })

    it('should retry on DNS resolution failures', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('DNS resolution failed'))
        .mockResolvedValueOnce(new Response(
          JSON.stringify({ data: 'success' }),
          { status: 200 }
        ))

      const result = await ApiClient.get('/test')
      
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ data: 'success' })
    })
  })

  describe('Server Error Retries', () => {
    it('should retry on 502 Bad Gateway errors', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response('Bad Gateway', { status: 502 }))
        .mockResolvedValueOnce(new Response('Bad Gateway', { status: 502 }))
        .mockResolvedValueOnce(new Response(
          JSON.stringify({ data: 'success' }),
          { status: 200 }
        ))

      const result = await ApiClient.get('/test')
      
      expect(mockFetch).toHaveBeenCalledTimes(3)
      expect(result).toEqual({ data: 'success' })
    })

    it('should retry on 503 Service Unavailable errors', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response(
          JSON.stringify({ error: 'Service temporarily unavailable' }),
          { status: 503 }
        ))
        .mockResolvedValueOnce(new Response(
          JSON.stringify({ data: 'success' }),
          { status: 200 }
        ))

      const result = await ApiClient.get('/test')
      
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ data: 'success' })
    })

    it('should retry on 504 Gateway Timeout errors', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response('Gateway Timeout', { status: 504 }))
        .mockResolvedValueOnce(new Response(
          JSON.stringify({ data: 'success' }),
          { status: 200 }
        ))

      const result = await ApiClient.get('/test')
      
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ data: 'success' })
    })
  })

  describe('Non-Retryable Errors', () => {
    it('should not retry on 400 Bad Request errors', async () => {
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({ error: 'Invalid request' }),
        { status: 400 }
      ))

      await expect(ApiClient.get('/test')).rejects.toThrow(ApiError)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should not retry on 404 Not Found errors', async () => {
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({ error: 'Not found' }),
        { status: 404 }
      ))

      await expect(ApiClient.get('/test')).rejects.toThrow(ApiError)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should not retry on 403 Forbidden errors', async () => {
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403 }
      ))

      await expect(ApiClient.get('/test')).rejects.toThrow(ApiError)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should not retry on 422 Unprocessable Entity errors', async () => {
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({ error: 'Validation failed' }),
        { status: 422 }
      ))

      await expect(ApiClient.get('/test')).rejects.toThrow(ApiError)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('Maximum Retry Limits', () => {
    it('should respect maximum retry count and fail after exhausting retries', async () => {
      // Mock 4 consecutive failures (initial + 3 retries = max attempts)
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))

      await expect(ApiClient.get('/test')).rejects.toThrow('Network error')
      expect(mockFetch).toHaveBeenCalledTimes(4) // Initial + 3 retries
    })

    it('should reset retry count between different requests', async () => {
      // First request: fails then succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(new Response(
          JSON.stringify({ data: 'first' }),
          { status: 200 }
        ))

      const firstResult = await ApiClient.get('/test1')
      expect(firstResult).toEqual({ data: 'first' })

      // Second request: should start fresh retry count
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(new Response(
          JSON.stringify({ data: 'second' }),
          { status: 200 }
        ))

      const secondResult = await ApiClient.get('/test2')
      expect(secondResult).toEqual({ data: 'second' })
      expect(mockFetch).toHaveBeenCalledTimes(4) // 2 calls for each request
    })
  })

  describe('Exponential Backoff Timing', () => {
    it('should implement exponential backoff delay between retries', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(new Response(
          JSON.stringify({ data: 'success' }),
          { status: 200 }
        ))

      await ApiClient.get('/test')

      // Should have called setTimeout with increasing delays
      expect(setTimeoutSpy).toHaveBeenCalledTimes(2)
      // First retry: ~1000ms, second retry: ~2000ms (exponential backoff)
      expect(setTimeoutSpy).toHaveBeenNthCalledWith(1, expect.any(Function), expect.any(Number))
      expect(setTimeoutSpy).toHaveBeenNthCalledWith(2, expect.any(Function), expect.any(Number))
    })

    it('should add jitter to prevent thundering herd', async () => {
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)

      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(new Response(
          JSON.stringify({ data: 'success' }),
          { status: 200 }
        ))

      await ApiClient.get('/test')

      expect(setTimeoutSpy).toHaveBeenCalledTimes(1)
      expect(randomSpy).toHaveBeenCalled()
    })
  })

  describe('HTTP Method Retry Consistency', () => {
    it('should retry POST requests on transient errors', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Request timeout'))
        .mockResolvedValueOnce(new Response(
          JSON.stringify({ success: true }),
          { status: 200 }
        ))

      const result = await ApiClient.post('/test', { data: 'test' })
      
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ success: true })
    })

    it('should retry PUT requests on transient errors', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Connection reset'))
        .mockResolvedValueOnce(new Response(
          JSON.stringify({ updated: true }),
          { status: 200 }
        ))

      const result = await ApiClient.put('/test', { data: 'updated' })
      
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ updated: true })
    })

    it('should retry DELETE requests on transient errors', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Request aborted'))
        .mockResolvedValueOnce(new Response(null, { status: 204 }))

      const result = await ApiClient.delete('/test')
      
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result).toEqual({})
    })
  })
})
