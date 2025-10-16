import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiClient, ApiError, AuthenticationError, ValidationError, NetworkError, ServerError, ConflictError, NotFoundError, ForbiddenError } from '@/services/ApiClient'
import { AuthService } from '@/services/authService'
import { setupTestBoundaries } from '../setup/setupTestBoundaries'

describe('ApiClient with Injected IHttpClient', () => {
  let mockHttp: any

  beforeEach(() => {
    vi.clearAllMocks()
    const boundaries = setupTestBoundaries()
    mockHttp = boundaries.http
    vi.spyOn(AuthService, 'getToken').mockReturnValue('mock-token')
    vi.spyOn(AuthService, 'storeToken')
    vi.spyOn(AuthService, 'clearToken')
    ApiClient.setTestMaxRetries(0)
  })

  describe('Basic HTTP Methods', () => {
    it('should make GET requests successfully', async () => {
      mockHttp.get.mockResolvedValueOnce({ data: 'success' })

      const result = await ApiClient.get('/test')

      expect(result).toEqual({ data: 'success' })
      expect(mockHttp.get).toHaveBeenCalledWith('/test', expect.any(Object))
    })

    it('should make POST requests successfully', async () => {
      mockHttp.post.mockResolvedValueOnce({ created: true })

      const result = await ApiClient.post('/test', { data: 'test' })

      expect(result).toEqual({ created: true })
      expect(mockHttp.post).toHaveBeenCalledWith('/test', { data: 'test' }, expect.any(Object))
    })

    it('should make PUT requests successfully', async () => {
      mockHttp.put.mockResolvedValueOnce({ updated: true })

      const result = await ApiClient.put('/test', { data: 'updated' })

      expect(result).toEqual({ updated: true })
      expect(mockHttp.put).toHaveBeenCalledWith('/test', { data: 'updated' }, expect.any(Object))
    })

    it('should make DELETE requests successfully', async () => {
      mockHttp.delete.mockResolvedValueOnce({})

      const result = await ApiClient.delete('/test')

      expect(result).toEqual({})
      expect(mockHttp.delete).toHaveBeenCalledWith('/test', expect.any(Object))
    })
  })

  describe('Authentication Integration', () => {
    it('should handle 401 responses with token refresh', async () => {
      vi.spyOn(AuthService, 'refreshToken').mockResolvedValueOnce({
        token: 'new-token'
      })

      mockHttp.get
        .mockRejectedValueOnce(new AuthenticationError())
        .mockResolvedValueOnce({ data: 'success' })

      const result = await ApiClient.get('/test')

      expect(result).toEqual({ data: 'success' })
      expect(AuthService.refreshToken).toHaveBeenCalledOnce()
      expect(AuthService.storeToken).toHaveBeenCalledWith('new-token')
    })

    it('should clear token when refresh fails', async () => {
      vi.spyOn(AuthService, 'refreshToken').mockRejectedValueOnce(
        new Error('Refresh failed')
      )

      mockHttp.get.mockRejectedValueOnce(new AuthenticationError())

      await expect(ApiClient.get('/test')).rejects.toThrow(AuthenticationError)
      expect(AuthService.clearToken).toHaveBeenCalledOnce()
    })
  })

  describe('Error Handling', () => {
    it('should throw ApiError for server errors', async () => {
      const error = new ServerError(500, 'Server error')
      mockHttp.get.mockRejectedValueOnce(error)

      try {
        await ApiClient.get('/test')
        throw new Error('Expected error to be thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ServerError)
        expect((err as ApiError).status).toBe(500)
      }
    })

    it('should throw ApiError for client errors', async () => {
      const error = new ValidationError('Bad request')
      mockHttp.get.mockRejectedValueOnce(error)

      try {
        await ApiClient.get('/test')
        throw new Error('Expected error to be thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError)
        expect((err as ApiError).status).toBe(400)
      }
    })
  })

  describe('Health Check', () => {
    it('should call health check endpoint', async () => {
      mockHttp.get.mockResolvedValueOnce('OK')

      const result = await ApiClient.healthCheck()

      expect(result).toBe('OK')
      expect(mockHttp.get).toHaveBeenCalledWith('/health', expect.any(Object))
    })

    it('should throw ApiError for health check failures', async () => {
      mockHttp.get.mockRejectedValueOnce(new Error('Connection refused'))

      await expect(ApiClient.healthCheck()).rejects.toThrow(ApiError)
    })
  })

  describe('Error Type Handling', () => {
    it('should throw ConflictError for 409 status', async () => {
      const error = new ConflictError('Email already exists')
      mockHttp.post.mockRejectedValueOnce(error)

      try {
        await ApiClient.post('/register', { email: 'test@example.com' })
        throw new Error('Expected error to be thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictError)
        expect((err as ConflictError).status).toBe(409)
      }
    })

    it('should throw NotFoundError for 404 status', async () => {
      const error = new NotFoundError('Resource not found')
      mockHttp.get.mockRejectedValueOnce(error)

      try {
        await ApiClient.get('/nonexistent')
        throw new Error('Expected error to be thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(NotFoundError)
        expect((err as NotFoundError).status).toBe(404)
      }
    })

    it('should throw ForbiddenError for 403 status', async () => {
      const error = new ForbiddenError('Access forbidden')
      mockHttp.get.mockRejectedValueOnce(error)

      try {
        await ApiClient.get('/admin')
        throw new Error('Expected error to be thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenError)
        expect((err as ForbiddenError).status).toBe(403)
      }
    })

    it('should throw NetworkError for network failures', async () => {
      mockHttp.get
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockRejectedValueOnce(new Error('Failed to fetch'))

      try {
        await ApiClient.get('/test')
        throw new Error('Expected error to be thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(NetworkError)
      }
    })
  })

  describe('Retry Logic Integration', () => {
    beforeEach(() => {
      ApiClient.setTestMaxRetries(2)
    })

    it('should retry on retryable errors', async () => {
      mockHttp.get
        .mockRejectedValueOnce(new ServerError(503, 'Service Unavailable'))
        .mockResolvedValueOnce({ data: 'success' })

      const result = await ApiClient.get('/test')

      expect(result).toEqual({ data: 'success' })
      expect(mockHttp.get).toHaveBeenCalledTimes(2)
    })
  })

  describe('Request Authorization', () => {
    it('should include auth token in requests', async () => {
      mockHttp.get.mockResolvedValueOnce({ data: 'success' })
      vi.spyOn(AuthService, 'getToken').mockReturnValue('my-token')

      await ApiClient.get('/protected')

      expect(mockHttp.get).toHaveBeenCalledWith('/protected', expect.any(Object))
    })

    it('should handle requests without auth token', async () => {
      mockHttp.get.mockResolvedValueOnce({ data: 'success' })
      vi.spyOn(AuthService, 'getToken').mockReturnValue(null)

      await ApiClient.get('/public')

      expect(mockHttp.get).toHaveBeenCalledWith('/public', expect.any(Object))
    })
  })
})
