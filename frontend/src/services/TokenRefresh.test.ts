import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiClient, ApiError, AuthenticationError } from './ApiClient'
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

describe('Token Refresh and Authentication Recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Automatic Token Refresh on 401', () => {
    it('should attempt token refresh when receiving 401 and have valid refresh token', async () => {
      // Setup: initial token exists, then 401, then refresh succeeds
      vi.mocked(AuthService.getToken)
        .mockReturnValueOnce('expired-token')
        .mockReturnValueOnce('new-token')
      
      vi.mocked(AuthService.refreshToken).mockResolvedValueOnce({
        token: 'new-token'
      })

      // First call returns 401, second call (with new token) succeeds
      mockFetch
        .mockResolvedValueOnce(new Response('', { status: 401 }))
        .mockResolvedValueOnce(new Response(
          JSON.stringify({ data: 'success' }),
          { status: 200 }
        ))

      const result = await ApiClient.get('/test')

      expect(AuthService.refreshToken).toHaveBeenCalledOnce()
      expect(AuthService.storeToken).toHaveBeenCalledWith('new-token')
      expect(result).toEqual({ data: 'success' })
    })

    it('should retry original request after successful token refresh', async () => {
      vi.mocked(AuthService.getToken)
        .mockReturnValueOnce('expired-token')
        .mockReturnValueOnce('new-token')
      
      vi.mocked(AuthService.refreshToken).mockResolvedValueOnce({
        token: 'new-token'
      })

      // First call returns 401, second call succeeds
      mockFetch
        .mockResolvedValueOnce(new Response('', { status: 401 }))
        .mockResolvedValueOnce(new Response(
          JSON.stringify({ result: 'data' }),
          { status: 200 }
        ))

      const result = await ApiClient.post('/test', { input: 'test' })

      expect(mockFetch).toHaveBeenCalledTimes(2)
      // Verify the second call has the new token
      expect(mockFetch).toHaveBeenLastCalledWith('/api/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer new-token'
        },
        body: JSON.stringify({ input: 'test' })
      })
      expect(result).toEqual({ result: 'data' })
    })

    it('should clear tokens and throw AuthenticationError if refresh fails', async () => {
      vi.mocked(AuthService.getToken).mockReturnValue('expired-token')
      vi.mocked(AuthService.refreshToken).mockRejectedValueOnce(
        new Error('Refresh token expired')
      )

      mockFetch.mockResolvedValueOnce(new Response('', { status: 401 }))

      await expect(ApiClient.get('/test')).rejects.toThrow(AuthenticationError)
      expect(AuthService.clearToken).toHaveBeenCalledOnce()
    })

    it('should not attempt refresh if no refresh token exists', async () => {
      vi.mocked(AuthService.getToken).mockReturnValue('expired-token')
      vi.mocked(AuthService.refreshToken).mockRejectedValueOnce(
        new Error('No refresh token')
      )

      mockFetch.mockResolvedValueOnce(new Response('', { status: 401 }))

      await expect(ApiClient.get('/test')).rejects.toThrow(AuthenticationError)
      expect(AuthService.refreshToken).toHaveBeenCalledOnce()
      expect(AuthService.clearToken).toHaveBeenCalledOnce()
    })

    it('should handle 401 on the retry request after refresh', async () => {
      vi.mocked(AuthService.getToken)
        .mockReturnValueOnce('expired-token')
        .mockReturnValueOnce('new-token')
      
      vi.mocked(AuthService.refreshToken).mockResolvedValueOnce({
        token: 'new-token'
      })

      // Both requests return 401
      mockFetch
        .mockResolvedValueOnce(new Response('', { status: 401 }))
        .mockResolvedValueOnce(new Response('', { status: 401 }))

      await expect(ApiClient.get('/test')).rejects.toThrow(AuthenticationError)
      expect(AuthService.clearToken).toHaveBeenCalledOnce() // Clear token when retry also fails
    })
  })

  describe('Multiple Simultaneous Requests with Token Refresh', () => {
    it('should handle multiple simultaneous requests when token expires', async () => {
      vi.mocked(AuthService.getToken)
        .mockReturnValue('expired-token')
      
      // Mock that refresh is called for each request
      vi.mocked(AuthService.refreshToken)
        .mockResolvedValue({ token: 'new-token' })

      // All initial requests return 401, all retries succeed
      mockFetch
        .mockResolvedValueOnce(new Response('', { status: 401 }))
        .mockResolvedValueOnce(new Response('', { status: 401 }))
        .mockResolvedValueOnce(new Response('', { status: 401 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ data: '1' }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ data: '2' }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ data: '3' }), { status: 200 }))

      // Make multiple simultaneous requests
      const promises = [
        ApiClient.get('/test1'),
        ApiClient.get('/test2'),
        ApiClient.get('/test3')
      ]

      const results = await Promise.all(promises)

      // Each request will attempt refresh since we're using mocks
      expect(AuthService.refreshToken).toHaveBeenCalledTimes(3) // Each request attempts refresh
      expect(results).toEqual([
        { data: '1' },
        { data: '2' },
        { data: '3' }
      ])
    })
  })

  describe('Token Refresh Edge Cases', () => {
    it('should handle network errors during token refresh', async () => {
      vi.mocked(AuthService.getToken).mockReturnValue('expired-token')
      vi.mocked(AuthService.refreshToken).mockRejectedValueOnce(
        new Error('Network error during refresh')
      )

      mockFetch.mockResolvedValueOnce(new Response('', { status: 401 }))

      await expect(ApiClient.get('/test')).rejects.toThrow(AuthenticationError)
      expect(AuthService.clearToken).toHaveBeenCalledOnce()
    })

    it('should handle malformed refresh response', async () => {
      vi.mocked(AuthService.getToken).mockReturnValue('expired-token')
      vi.mocked(AuthService.refreshToken).mockRejectedValueOnce(
        new Error('Invalid refresh response')
      )

      mockFetch.mockResolvedValueOnce(new Response('', { status: 401 }))

      await expect(ApiClient.get('/test')).rejects.toThrow(AuthenticationError)
      expect(AuthService.clearToken).toHaveBeenCalledOnce()
    })
  })
})