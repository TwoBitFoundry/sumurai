import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiClient, ApiError, ServerError, NetworkError } from '@/services/ApiClient'
import { AuthService } from '@/services/authService'
import { setupTestBoundaries } from '../setup/setupTestBoundaries'

vi.spyOn(AuthService, 'getToken')
vi.spyOn(AuthService, 'clearToken')
vi.spyOn(AuthService, 'logout')

let setTimeoutSpy: ReturnType<typeof vi.spyOn>

describe('Retry Logic and Exponential Backoff', () => {
  const originalConsoleError = console.error
  let mockHttp: any

  beforeEach(() => {
    vi.clearAllMocks()
    const boundaries = setupTestBoundaries()
    mockHttp = boundaries.http
    console.error = vi.fn()

    vi.spyOn(AuthService, 'getToken').mockReturnValue('mock-token')
    vi.spyOn(AuthService, 'logout').mockResolvedValue({ message: 'Logged out', cleared_session: 'test' })
    ApiClient.setTestMaxRetries(3)
    setTimeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation(((cb: TimerHandler) => {
        if (typeof cb === 'function') {
          ;(cb as Function)()
        }
        return 0 as unknown as number
      }) as unknown as typeof setTimeout)
  })

  afterEach(() => {
    console.error = originalConsoleError
    vi.restoreAllMocks()
  })

  describe('Transient Network Errors', () => {
    it('should retry on network timeout errors with exponential backoff', async () => {
      mockHttp.get
        .mockRejectedValueOnce(new Error('Request timeout'))
        .mockRejectedValueOnce(new Error('Request timeout'))
        .mockResolvedValueOnce({ data: 'success' })

      const result = await ApiClient.get('/test')

      expect(mockHttp.get).toHaveBeenCalledTimes(3)
      expect(result).toEqual({ data: 'success' })
    })

    it('should retry on network connection errors', async () => {
      mockHttp.get
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockResolvedValueOnce({ data: 'success' })

      const result = await ApiClient.get('/test')

      expect(mockHttp.get).toHaveBeenCalledTimes(3)
      expect(result).toEqual({ data: 'success' })
    })

    it('should retry on DNS resolution failures', async () => {
      mockHttp.get
        .mockRejectedValueOnce(new Error('DNS resolution failed'))
        .mockResolvedValueOnce({ data: 'success' })

      const result = await ApiClient.get('/test')

      expect(mockHttp.get).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ data: 'success' })
    })
  })

  describe('Server Error Retries', () => {
    it('should retry on 502 Bad Gateway errors', async () => {
      mockHttp.get
        .mockRejectedValueOnce(new ServerError(502, 'Bad Gateway'))
        .mockRejectedValueOnce(new ServerError(502, 'Bad Gateway'))
        .mockResolvedValueOnce({ data: 'success' })

      const result = await ApiClient.get('/test')

      expect(mockHttp.get).toHaveBeenCalledTimes(3)
      expect(result).toEqual({ data: 'success' })
    })

    it('should retry on 503 Service Unavailable errors', async () => {
      mockHttp.get
        .mockRejectedValueOnce(new ServerError(503, 'Service temporarily unavailable'))
        .mockResolvedValueOnce({ data: 'success' })

      const result = await ApiClient.get('/test')

      expect(mockHttp.get).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ data: 'success' })
    })

    it('should retry on 504 Gateway Timeout errors', async () => {
      mockHttp.get
        .mockRejectedValueOnce(new ServerError(504, 'Gateway Timeout'))
        .mockResolvedValueOnce({ data: 'success' })

      const result = await ApiClient.get('/test')

      expect(mockHttp.get).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ data: 'success' })
    })
  })

  describe('Non-Retryable Errors', () => {
    it('should not retry on 400 Bad Request errors', async () => {
      mockHttp.get.mockRejectedValueOnce(new ApiError(400, 'Invalid request'))

      await expect(ApiClient.get('/test')).rejects.toThrow(ApiError)
      expect(mockHttp.get).toHaveBeenCalledTimes(1)
    })

    it('should not retry on 404 Not Found errors', async () => {
      mockHttp.get.mockRejectedValueOnce(new ApiError(404, 'Not found'))

      await expect(ApiClient.get('/test')).rejects.toThrow(ApiError)
      expect(mockHttp.get).toHaveBeenCalledTimes(1)
    })

    it('should not retry on 403 Forbidden errors', async () => {
      mockHttp.get.mockRejectedValueOnce(new ApiError(403, 'Forbidden'))

      await expect(ApiClient.get('/test')).rejects.toThrow(ApiError)
      expect(mockHttp.get).toHaveBeenCalledTimes(1)
    })

    it('should not retry on 422 Unprocessable Entity errors', async () => {
      mockHttp.get.mockRejectedValueOnce(new ApiError(422, 'Validation failed'))

      await expect(ApiClient.get('/test')).rejects.toThrow(ApiError)
      expect(mockHttp.get).toHaveBeenCalledTimes(1)
    })
  })

  describe('Maximum Retry Limits', () => {
    it('should respect maximum retry count and fail after exhausting retries', async () => {
      mockHttp.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))

      await expect(ApiClient.get('/test')).rejects.toThrow(NetworkError)
      expect(mockHttp.get).toHaveBeenCalledTimes(4)
    })

    it('should reset retry count between different requests', async () => {
      mockHttp.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: 'first' })

      const firstResult = await ApiClient.get('/test1')
      expect(firstResult).toEqual({ data: 'first' })

      mockHttp.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: 'second' })

      const secondResult = await ApiClient.get('/test2')
      expect(secondResult).toEqual({ data: 'second' })
      expect(mockHttp.get).toHaveBeenCalledTimes(4)
    })
  })

  describe('Exponential Backoff Timing', () => {
    it('should implement exponential backoff delay between retries', async () => {
      mockHttp.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: 'success' })

      await ApiClient.get('/test')

      expect(setTimeoutSpy).toHaveBeenCalledTimes(2)
      expect(setTimeoutSpy).toHaveBeenNthCalledWith(1, expect.any(Function), expect.any(Number))
      expect(setTimeoutSpy).toHaveBeenNthCalledWith(2, expect.any(Function), expect.any(Number))
    })

    it('should add jitter to prevent thundering herd', async () => {
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)

      mockHttp.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: 'success' })

      await ApiClient.get('/test')

      expect(setTimeoutSpy).toHaveBeenCalledTimes(1)
      expect(randomSpy).toHaveBeenCalled()
    })
  })

  describe('HTTP Method Retry Consistency', () => {
    it('should retry POST requests on transient errors', async () => {
      mockHttp.post
        .mockRejectedValueOnce(new Error('Request timeout'))
        .mockResolvedValueOnce({ success: true })

      const result = await ApiClient.post('/test', { data: 'test' })

      expect(mockHttp.post).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ success: true })
    })

    it('should retry PUT requests on transient errors', async () => {
      mockHttp.put
        .mockRejectedValueOnce(new Error('Connection reset'))
        .mockResolvedValueOnce({ updated: true })

      const result = await ApiClient.put('/test', { data: 'updated' })

      expect(mockHttp.put).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ updated: true })
    })

    it('should retry DELETE requests on transient errors', async () => {
      mockHttp.delete
        .mockRejectedValueOnce(new Error('Request aborted'))
        .mockResolvedValueOnce({})

      const result = await ApiClient.delete('/test')

      expect(mockHttp.delete).toHaveBeenCalledTimes(2)
      expect(result).toEqual({})
    })
  })
})
