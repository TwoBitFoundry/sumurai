import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiClient, ApiError, AuthenticationError, ValidationError, NetworkError, ServerError, ConflictError, NotFoundError, ForbiddenError } from './ApiClient'
import { AuthService } from './authService'

// Mock the AuthService
vi.mock('./authService', () => ({
  AuthService: {
    getToken: vi.fn(),
    clearToken: vi.fn(),
    refreshToken: vi.fn(),
    storeToken: vi.fn(),
  },
}))

// Mock fetch globally
const mockFetch = vi.fn()
globalThis.fetch = mockFetch

describe('ApiClient Legacy Compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(AuthService.getToken).mockReturnValue('mock-token')
    ApiClient.setTestMaxRetries(0) // Disable retries for faster tests
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Basic HTTP Methods', () => {
    it('should make GET requests successfully', async () => {
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({ data: 'success' }),
        { status: 200 }
      ))

      const result = await ApiClient.get('/test')
      expect(result).toEqual({ data: 'success' })
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token'
          })
        })
      )
    })

    it('should make POST requests successfully', async () => {
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({ created: true }),
        { status: 201 }
      ))

      const result = await ApiClient.post('/test', { data: 'test' })
      expect(result).toEqual({ created: true })
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ data: 'test' }),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token'
          })
        })
      )
    })

    it('should make PUT requests successfully', async () => {
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({ updated: true }),
        { status: 200 }
      ))

      const result = await ApiClient.put('/test', { data: 'updated' })
      expect(result).toEqual({ updated: true })
    })

    it('should make DELETE requests successfully', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }))

      const result = await ApiClient.delete('/test')
      expect(result).toEqual({})
    })
  })

  describe('Authentication Integration', () => {
    it('should handle 401 responses with token refresh', async () => {
      vi.mocked(AuthService.refreshToken).mockResolvedValueOnce({
        token: 'new-token'
      })

      mockFetch
        .mockResolvedValueOnce(new Response('', { status: 401 }))
        .mockResolvedValueOnce(new Response(
          JSON.stringify({ data: 'success' }),
          { status: 200 }
        ))

      const result = await ApiClient.get('/test')
      expect(result).toEqual({ data: 'success' })
      expect(AuthService.refreshToken).toHaveBeenCalledOnce()
      expect(AuthService.storeToken).toHaveBeenCalledWith('new-token')
    })

    it('should clear token when refresh fails', async () => {
      vi.mocked(AuthService.refreshToken).mockRejectedValueOnce(
        new Error('Refresh failed')
      )

      mockFetch.mockResolvedValueOnce(new Response('', { status: 401 }))

      await expect(ApiClient.get('/test')).rejects.toThrow(AuthenticationError)
      expect(AuthService.clearToken).toHaveBeenCalledOnce()
    })
  })

  describe('Error Handling', () => {
    it('should throw ApiError for server errors', async () => {
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({ error: 'Server error' }),
        { status: 500 }
      ))

      try {
        await ApiClient.get('/test')
        throw new Error('Expected error to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(500)
      }
    })

    it('should throw ApiError for client errors', async () => {
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({ error: 'Bad request' }),
        { status: 400 }
      ))

      try {
        await ApiClient.get('/test')
        throw new Error('Expected error to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(400)
      }
    })
  })

  describe('Health Check', () => {
    it('given healthy server when checking health then returns OK status', async () => {
      // Given
      mockFetch.mockResolvedValueOnce(new Response(
        'OK',
        { status: 200 }
      ))

      // When
      const result = await ApiClient.healthCheck()

      // Then
      expect(result).toBe('OK')
      expect(mockFetch).toHaveBeenCalledWith('/health', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      // Verify no Authorization header is sent (health check is public)
      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.anything()
          })
        })
      )
    })

    it('given unhealthy server when checking health then throws ApiError', async () => {
      // Given
      mockFetch.mockResolvedValue(new Response(
        'Service Unavailable',
        { status: 503 }
      ))

      // When & Then
      try {
        await ApiClient.healthCheck()
        throw new Error('Expected error to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).message).toBe('Health check failed')
      }
    })

    it('given server timeout when checking health then throws ApiError with 503 status', async () => {
      // Given
      mockFetch.mockResolvedValueOnce(new Response(
        '',
        { status: 503 }
      ))

      // When
      try {
        await ApiClient.healthCheck()
        throw new Error('Expected error to be thrown')
      } catch (error) {
        // Then
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(503)
        expect((error as ApiError).message).toBe('Health check failed')
      }
    })
  })

  describe('Comprehensive Error Response Handling', () => {
    it('should create ValidationError for 400 status with structured error response', async () => {
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({ 
          error: "VALIDATION_ERROR",
          message: "Invalid input data",
          code: "VALIDATION_FAILED",
          details: { email: "Invalid email format" }
        }),
        { status: 400 }
      ))

      try {
        await ApiClient.post('/test', { email: 'invalid' })
        throw new Error('Expected error to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect((error as ValidationError).status).toBe(400)
        expect((error as ValidationError).message).toBe('Invalid input data')
        expect((error as ValidationError).code).toBe('VALIDATION_FAILED')
      }
    })

    it('should create ConflictError for 409 status', async () => {
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({ 
          error: "CONFLICT",
          message: "Email address is already registered"
        }),
        { status: 409 }
      ))

      try {
        await ApiClient.post('/register', { email: 'test@example.com' })
        throw new Error('Expected error to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictError)
        expect((error as ConflictError).status).toBe(409)
        expect((error as ConflictError).message).toBe('Email address is already registered')
      }
    })

    it('should create NotFoundError for 404 status', async () => {
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({ 
          error: "NOT_FOUND",
          message: "Resource not found"
        }),
        { status: 404 }
      ))

      try {
        await ApiClient.get('/nonexistent')
        throw new Error('Expected error to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundError)
        expect((error as NotFoundError).status).toBe(404)
        expect((error as NotFoundError).message).toBe('Resource not found')
      }
    })

    it('should create ForbiddenError for 403 status', async () => {
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({ 
          error: "FORBIDDEN",
          message: "Access forbidden"
        }),
        { status: 403 }
      ))

      try {
        await ApiClient.get('/admin')
        throw new Error('Expected error to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenError)
        expect((error as ForbiddenError).status).toBe(403)
        expect((error as ForbiddenError).message).toBe('Access forbidden')
      }
    })

    it('should create ServerError for 500 status', async () => {
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({ 
          error: "INTERNAL_SERVER_ERROR",
          message: "Failed to process password"
        }),
        { status: 500 }
      ))

      try {
        await ApiClient.post('/register', { password: 'test' })
        throw new Error('Expected error to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ServerError)
        expect((error as ServerError).status).toBe(500)
        expect((error as ServerError).message).toBe('Failed to process password')
      }
    })

    it('should create NetworkError for network failures', async () => {
      // Mock multiple failures to exhaust retries (max 3 retries + initial = 4 calls)
      mockFetch
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockRejectedValueOnce(new Error('Failed to fetch'))

      // Exhaust all retries so we get the final NetworkError
      try {
        await ApiClient.get('/test')
        throw new Error('Expected error to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(NetworkError)
        expect((error as NetworkError).message).toBe('Failed to fetch')
        expect((error as NetworkError).code).toBe('NETWORK_ERROR')
      }
    })

    it('should extract error messages from various response formats', async () => {
      const testCases = [
        { response: { message: 'Test message' }, expected: 'Test message' },
        { response: { error: 'Test error' }, expected: 'Test error' },
        { response: { detail: 'Test detail' }, expected: 'Test detail' },
        { response: { msg: 'Test msg' }, expected: 'Test msg' },
        { response: 'Plain string error', expected: 'Plain string error' },
      ]

      for (const testCase of testCases) {
        mockFetch.mockResolvedValueOnce(new Response(
          JSON.stringify(testCase.response),
          { status: 400 }
        ))

        try {
          await ApiClient.get('/test')
          throw new Error('Expected error to be thrown')
        } catch (error) {
          expect((error as ApiError).message).toBe(testCase.expected)
        }
      }
    })

    it('should handle malformed JSON responses gracefully', async () => {
      mockFetch.mockResolvedValueOnce(new Response(
        'Server temporarily unavailable due to maintenance',
        { status: 500, statusText: 'Internal Server Error' }
      ))

      try {
        await ApiClient.get('/test')
        throw new Error('Expected error to be thrown')  
      } catch (error) {
        expect(error).toBeInstanceOf(ServerError)
        expect((error as ServerError).message).toBe('500 Internal Server Error')
      }
    })

    it('should fallback to status code and text when no parseable content', async () => {
      // Mock the same response that would be retried multiple times
      const emptyResponse = new Response(
        '',
        { status: 503, statusText: 'Service Unavailable' }
      )
      
      mockFetch
        .mockResolvedValueOnce(emptyResponse)
        .mockResolvedValueOnce(emptyResponse.clone())
        .mockResolvedValueOnce(emptyResponse.clone())
        .mockResolvedValueOnce(emptyResponse.clone())

      try {
        await ApiClient.get('/test')
        throw new Error('Expected error to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ServerError) 
        expect((error as ServerError).message).toBe('503 Service Unavailable')
      }
    })
  })

  describe('Error Propagation Through Service Layers', () => {
    it('should preserve error types when bubbling through service methods', async () => {
      // Mock refresh to fail immediately so we don't go through token refresh logic
      vi.mocked(AuthService.refreshToken).mockRejectedValueOnce(
        new Error('Token refresh failed')
      )
      
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({
          error: "UNAUTHORIZED",
          message: "Authentication token has expired",
          code: "EXPIRED_TOKEN"
        }),
        { status: 401 }
      ))

      try {
        await ApiClient.get('/protected-resource')
        throw new Error('Expected error to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError)
        // When token refresh fails, it should use the default message
        expect((error as AuthenticationError).message).toBe('Authentication required')
        expect(AuthService.clearToken).toHaveBeenCalledOnce()
      }
    })

    it('should handle authentication error with token refresh failure', async () => {
      vi.mocked(AuthService.refreshToken).mockRejectedValueOnce(
        new Error('Refresh token expired')
      )

      mockFetch.mockResolvedValueOnce(new Response('', { status: 401 }))

      try {
        await ApiClient.get('/protected-resource')
        throw new Error('Expected error to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError)
        expect(AuthService.clearToken).toHaveBeenCalledOnce()
      }
    })
  })
})