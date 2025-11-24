import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiClient, ApiError, AuthenticationError } from '@/services/ApiClient'
import { AuthService } from '@/services/authService'
import { setupTestBoundaries } from '../setup/setupTestBoundaries'

describe('Token Refresh and Authentication Recovery', () => {
  let mockHttp: any

  beforeEach(() => {
    vi.clearAllMocks()
    const boundaries = setupTestBoundaries()
    mockHttp = boundaries.http
    vi.spyOn(AuthService, 'getToken')
    vi.spyOn(AuthService, 'clearToken')
    vi.spyOn(AuthService, 'refreshToken')
    vi.spyOn(AuthService, 'storeToken')
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Automatic Token Refresh on 401', () => {
    it('should attempt token refresh when receiving 401 and have valid refresh token', async () => {
      vi.spyOn(AuthService, 'getToken')
        .mockReturnValueOnce('expired-token')
        .mockReturnValueOnce('new-token')

      vi.spyOn(AuthService, 'refreshToken').mockResolvedValueOnce({
        token: 'new-token'
      })

      mockHttp.get
        .mockRejectedValueOnce(new AuthenticationError())
        .mockResolvedValueOnce({ data: 'success' })

      const result = await ApiClient.get('/test')

      expect(AuthService.refreshToken).toHaveBeenCalledOnce()
      expect(AuthService.storeToken).toHaveBeenCalledWith('new-token')
      expect(result).toEqual({ data: 'success' })
    })

    it('should retry original request after successful token refresh', async () => {
      vi.spyOn(AuthService, 'getToken')
        .mockReturnValueOnce('expired-token')
        .mockReturnValueOnce('new-token')

      vi.spyOn(AuthService, 'refreshToken').mockResolvedValueOnce({
        token: 'new-token'
      })

      mockHttp.post
        .mockRejectedValueOnce(new AuthenticationError())
        .mockResolvedValueOnce({ result: 'data' })

      const result = await ApiClient.post('/test', { input: 'test' })

      expect(mockHttp.post).toHaveBeenCalledTimes(2)
      expect(mockHttp.post).toHaveBeenLastCalledWith('/test', { input: 'test' }, expect.any(Object))
      expect(result).toEqual({ result: 'data' })
    })

    it('should clear tokens and throw AuthenticationError if refresh fails', async () => {
      vi.spyOn(AuthService, 'getToken').mockReturnValue('expired-token')
      vi.spyOn(AuthService, 'refreshToken').mockRejectedValueOnce(
        new Error('Refresh token expired')
      )

      mockHttp.get.mockRejectedValueOnce(new AuthenticationError())

      await expect(ApiClient.get('/test')).rejects.toThrow(AuthenticationError)
      expect(AuthService.clearToken).toHaveBeenCalledOnce()
    })

    it('should not attempt refresh if no refresh token exists', async () => {
      vi.spyOn(AuthService, 'getToken').mockReturnValue('expired-token')
      vi.spyOn(AuthService, 'refreshToken').mockRejectedValueOnce(
        new Error('No refresh token')
      )

      mockHttp.get.mockRejectedValueOnce(new AuthenticationError())

      await expect(ApiClient.get('/test')).rejects.toThrow(AuthenticationError)
      expect(AuthService.refreshToken).toHaveBeenCalledOnce()
      expect(AuthService.clearToken).toHaveBeenCalledOnce()
    })

    it('should handle 401 on the retry request after refresh', async () => {
      vi.spyOn(AuthService, 'getToken')
        .mockReturnValueOnce('expired-token')
        .mockReturnValueOnce('new-token')

      vi.spyOn(AuthService, 'refreshToken').mockResolvedValueOnce({
        token: 'new-token'
      })

      mockHttp.get
        .mockRejectedValueOnce(new AuthenticationError())
        .mockRejectedValueOnce(new AuthenticationError())

      await expect(ApiClient.get('/test')).rejects.toThrow(AuthenticationError)
      expect(AuthService.clearToken).toHaveBeenCalledOnce()
    })
  })

  describe('Multiple Simultaneous Requests with Token Refresh', () => {
    it('should handle multiple simultaneous requests when token expires', async () => {
      vi.spyOn(AuthService, 'getToken')
        .mockReturnValue('expired-token')

      vi.spyOn(AuthService, 'refreshToken')
        .mockResolvedValue({ token: 'new-token' })

      mockHttp.get
        .mockRejectedValueOnce(new AuthenticationError())
        .mockRejectedValueOnce(new AuthenticationError())
        .mockRejectedValueOnce(new AuthenticationError())
        .mockResolvedValueOnce({ data: '1' })
        .mockResolvedValueOnce({ data: '2' })
        .mockResolvedValueOnce({ data: '3' })

      const promises = [
        ApiClient.get('/test1'),
        ApiClient.get('/test2'),
        ApiClient.get('/test3')
      ]

      const results = await Promise.all(promises)

      expect(AuthService.refreshToken).toHaveBeenCalledTimes(3)
      expect(results).toEqual([
        { data: '1' },
        { data: '2' },
        { data: '3' }
      ])
    })
  })

  describe('Token Refresh Edge Cases', () => {
    it('should handle network errors during token refresh', async () => {
      vi.spyOn(AuthService, 'getToken').mockReturnValue('expired-token')
      vi.spyOn(AuthService, 'refreshToken').mockRejectedValueOnce(
        new Error('Network error during refresh')
      )

      mockHttp.get.mockRejectedValueOnce(new AuthenticationError())

      await expect(ApiClient.get('/test')).rejects.toThrow(AuthenticationError)
      expect(AuthService.clearToken).toHaveBeenCalledOnce()
    })

    it('should handle malformed refresh response', async () => {
      vi.spyOn(AuthService, 'getToken').mockReturnValue('expired-token')
      vi.spyOn(AuthService, 'refreshToken').mockRejectedValueOnce(
        new Error('Invalid refresh response')
      )

      mockHttp.get.mockRejectedValueOnce(new AuthenticationError())

      await expect(ApiClient.get('/test')).rejects.toThrow(AuthenticationError)
      expect(AuthService.clearToken).toHaveBeenCalledOnce()
    })
  })
})
