import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiClient } from '@/services/ApiClient'
import { AuthService } from '@/services/authService'
import type { IHttpClient } from '@/services/boundaries/IHttpClient'
import type { IStorageAdapter } from '@/services/boundaries/IStorageAdapter'

class MockStorage implements IStorageAdapter {
  private store = new Map<string, string>()
  getItem(key: string) { return this.store.get(key) || null }
  setItem(key: string, value: string) { this.store.set(key, value) }
  removeItem(key: string) { this.store.delete(key) }
  clear() { this.store.clear() }
}

class MockHttpClient implements IHttpClient {
  get = vi.fn()
  post = vi.fn()
  put = vi.fn()
  delete = vi.fn()
  healthCheck = vi.fn()
}

describe('ApiClient with Direct Fetch', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch')
    AuthService.configure({
      http: new MockHttpClient(),
      storage: new MockStorage()
    })
    AuthService.clearToken()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('GET request', () => {
    it('should make GET request with fetch', async () => {
      const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
      fetchSpy.mockResolvedValueOnce(mockResponse)

      const result = await ApiClient.get<{ data: string }>('/test')

      expect(fetchSpy).toHaveBeenCalledWith('/api/test', expect.any(Object))
      expect(result).toEqual({ data: 'test' })
    })

    it('should build correct URL with base path', async () => {
      const mockResponse = new Response(JSON.stringify({}), { status: 200 })
      fetchSpy.mockResolvedValueOnce(mockResponse)

      await ApiClient.get('/transactions')

      expect(fetchSpy).toHaveBeenCalledWith('/api/transactions', expect.any(Object))
    })

    it('should include auth token in headers', async () => {
      const mockResponse = new Response(JSON.stringify({}), { status: 200 })
      fetchSpy.mockResolvedValueOnce(mockResponse)
      AuthService.storeToken('test-token')

      await ApiClient.get('/test')

      const callArgs = fetchSpy.mock.calls[0]
      const headers = callArgs[1].headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer test-token')
    })
  })

  describe('POST request', () => {
    it('should use injected fetcher for POST requests', async () => {
      const mockResponse = new Response(JSON.stringify({ success: true }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      })
      fetchSpy.mockResolvedValueOnce(mockResponse)

      const data = { name: 'test' }
      const result = await ApiClient.post<{ success: boolean }>('/test', data)

      expect(fetchSpy).toHaveBeenCalledWith('/api/test', expect.any(Object))
      expect(result).toEqual({ success: true })
    })

    it('should include request body', async () => {
      const mockResponse = new Response(JSON.stringify({}), { status: 201 })
      fetchSpy.mockResolvedValueOnce(mockResponse)

      const data = { name: 'test' }
      await ApiClient.post('/test', data)

      const callArgs = fetchSpy.mock.calls[0]
      expect(callArgs[1].body).toBe(JSON.stringify(data))
    })
  })

  describe('Error handling with fetcher', () => {
    it('should handle 401 responses with retry after token refresh', async () => {
      AuthService.storeToken('old-token')

      const errorResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401
      })
      const successResponse = new Response(JSON.stringify({ data: 'success' }), {
        status: 200
      })

      fetchSpy
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(successResponse)

      vi.spyOn(AuthService, 'refreshToken').mockResolvedValueOnce({
        token: 'new-token',
        user_id: 'user-123',
        expires_at: '2025-12-31T00:00:00Z',
        onboarding_completed: true
      })

      const result = await ApiClient.get<{ data: string }>('/test')

      expect(result).toEqual({ data: 'success' })
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    it('should retry on 503 Service Unavailable', async () => {
      const errorResponse = new Response(JSON.stringify({ error: 'Service Unavailable' }), {
        status: 503
      })
      const successResponse = new Response(JSON.stringify({ data: 'recovered' }), {
        status: 200
      })

      fetchSpy
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(successResponse)

      ApiClient.setTestMaxRetries(1)
      const result = await ApiClient.get<{ data: string }>('/test')

      expect(result).toEqual({ data: 'recovered' })
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    it('should throw error when max retries exceeded', async () => {
      const errorResponse = new Response(JSON.stringify({ error: 'Service Unavailable' }), {
        status: 503
      })
      fetchSpy.mockResolvedValue(errorResponse)

      ApiClient.setTestMaxRetries(0)

      await expect(ApiClient.get('/test')).rejects.toThrow()
    })
  })
})
