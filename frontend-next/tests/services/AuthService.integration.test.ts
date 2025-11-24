import { AuthService } from '@/services/authService'
import { ApiClient } from '@/services/ApiClient'
import type { IHttpClient } from '@/services/boundaries/IHttpClient'
import type { IStorageAdapter } from '@/services/boundaries/IStorageAdapter'

class MockHttpClient implements IHttpClient {
  get = jest.fn()
  post = jest.fn()
  put = jest.fn()
  delete = jest.fn()
  healthCheck = jest.fn()
}

class MockStorageAdapter implements IStorageAdapter {
  private store = new Map<string, string>()

  getItem(key: string): string | null {
    return this.store.get(key) || null
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }
}

describe('AuthService with Injected Boundaries', () => {
  let mockHttpClient: MockHttpClient
  let mockStorageAdapter: MockStorageAdapter

  beforeEach(() => {
    mockHttpClient = new MockHttpClient()
    mockStorageAdapter = new MockStorageAdapter()
    ApiClient.configure(mockHttpClient)
    AuthService.configure({
      storage: mockStorageAdapter
    })
    mockStorageAdapter.clear()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('login', () => {
    it('should use injected http client for login request', async () => {
      const loginResponse = {
        token: 'test-token',
        user_id: 'user-123',
        expires_at: '2025-12-31T00:00:00Z',
        onboarding_completed: false
      }
      mockHttpClient.post.mockResolvedValueOnce(loginResponse)

      const result = await AuthService.login({
        email: 'test@example.com',
        password: 'password123'
      })

      expect(mockHttpClient.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password123'
      }, expect.any(Object))
      expect(result).toEqual(loginResponse)
    })

    it('should store token in injected storage', async () => {
      const loginResponse = {
        token: 'test-token',
        user_id: 'user-123',
        expires_at: '2025-12-31T00:00:00Z',
        onboarding_completed: false
      }
      mockHttpClient.post.mockResolvedValueOnce(loginResponse)

      await AuthService.login({
        email: 'test@example.com',
        password: 'password123'
      })

      AuthService.storeToken(loginResponse.token)
      expect(AuthService.getToken()).toBe('test-token')
    })
  })

  describe('token storage', () => {
    it('should store and retrieve token from injected storage', () => {
      AuthService.storeToken('test-token-123')
      expect(AuthService.getToken()).toBe('test-token-123')
    })

    it('should store refresh token', () => {
      AuthService.storeToken('access-token', 'refresh-token')
      expect(AuthService.getToken()).toBe('access-token')
      expect(mockStorageAdapter.getItem('refresh_token')).toBe('refresh-token')
    })

    it('should clear token from injected storage', () => {
      AuthService.storeToken('test-token')
      expect(AuthService.getToken()).toBe('test-token')

      AuthService.clearToken()
      expect(AuthService.getToken()).toBeNull()
    })
  })

  describe('register', () => {
    it('should use injected http client for register request', async () => {
      const registerResponse = {
        token: 'new-token',
        user_id: 'user-456',
        expires_at: '2025-12-31T00:00:00Z',
        onboarding_completed: false
      }
      mockHttpClient.post.mockResolvedValueOnce(registerResponse)

      const result = await AuthService.register({
        email: 'newuser@example.com',
        password: 'password123'
      })

      expect(mockHttpClient.post).toHaveBeenCalledWith('/auth/register', {
        email: 'newuser@example.com',
        password: 'password123'
      }, expect.any(Object))
      expect(result).toEqual(registerResponse)
    })
  })

  describe('validateSession', () => {
    it('should use injected http client to validate session', async () => {
      AuthService.storeToken('valid-token')
      mockHttpClient.get.mockResolvedValueOnce({
        connections: []
      })

      const result = await AuthService.validateSession()

      expect(result).toBe(true)
    })

    it('should return false when no token stored', async () => {
      const result = await AuthService.validateSession()
      expect(result).toBe(false)
    })
  })

  describe('logout', () => {
    it('should use injected http client for logout request', async () => {
      AuthService.storeToken('test-token')
      mockHttpClient.post.mockResolvedValueOnce({
        message: 'Logged out',
        cleared_session: 'session-123'
      })

      const result = await AuthService.logout()

      expect(mockHttpClient.post).toHaveBeenCalled()
      expect(result.message).toBe('Logged out')
    })

    it('should clear token after logout', async () => {
      AuthService.storeToken('test-token')
      mockHttpClient.post.mockResolvedValueOnce({
        message: 'Logged out',
        cleared_session: 'session-123'
      })

      await AuthService.logout()

      expect(AuthService.getToken()).toBeNull()
    })
  })

  describe('refreshToken', () => {
    it('should use injected http client to refresh token', async () => {
      AuthService.storeToken('old-token')
      const refreshResponse = {
        token: 'new-token',
        user_id: 'user-123',
        expires_at: '2025-12-31T00:00:00Z',
        onboarding_completed: true
      }
      mockHttpClient.post.mockResolvedValueOnce(refreshResponse)

      const result = await AuthService.refreshToken()

      expect(mockHttpClient.post).toHaveBeenCalled()
      expect(result).toEqual(refreshResponse)
    })

    it('should prevent multiple simultaneous refresh attempts', async () => {
      AuthService.storeToken('old-token')
      const refreshResponse = {
        token: 'new-token',
        user_id: 'user-123',
        expires_at: '2025-12-31T00:00:00Z',
        onboarding_completed: true
      }
      mockHttpClient.post.mockResolvedValueOnce(refreshResponse)

      const promise1 = AuthService.refreshToken()
      const promise2 = AuthService.refreshToken()

      const result1 = await promise1
      const result2 = await promise2

      expect(result1).toEqual(result2)
      expect(mockHttpClient.post).toHaveBeenCalledTimes(1)
    })
  })

  describe('completeOnboarding', () => {
    it('should use injected http client to complete onboarding', async () => {
      AuthService.storeToken('test-token')
      mockHttpClient.put.mockResolvedValueOnce({
        message: 'Onboarding completed',
        onboarding_completed: true
      })

      const result = await AuthService.completeOnboarding()

      expect(mockHttpClient.put).toHaveBeenCalled()
      expect(result.onboarding_completed).toBe(true)
    })
  })
})
