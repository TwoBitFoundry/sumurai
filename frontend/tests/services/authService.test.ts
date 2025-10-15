import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthService } from '@/services/authService'
import type { IHttpClient } from '@/services/boundaries/IHttpClient'
import type { IStorageAdapter } from '@/services/boundaries/IStorageAdapter'

class MockHttpClient implements IHttpClient {
  get = vi.fn()
  post = vi.fn()
  put = vi.fn()
  delete = vi.fn()
  healthCheck = vi.fn()
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

describe('AuthService logout functionality', () => {
  let mockHttpClient: MockHttpClient
  let mockStorageAdapter: MockStorageAdapter

  beforeEach(() => {
    mockHttpClient = new MockHttpClient()
    mockStorageAdapter = new MockStorageAdapter()
    AuthService.configure({
      http: mockHttpClient,
      storage: mockStorageAdapter
    })
    mockStorageAdapter.clear()
    vi.clearAllMocks()
  })

  it('given valid token when logging out then calls logout endpoint and clears tokens', async () => {
    const mockToken = 'valid-jwt-token'
    AuthService.storeToken(mockToken)

    const mockResponse = {
      message: 'Logged out successfully',
      cleared_session: 'session-id'
    }

    mockHttpClient.post.mockResolvedValueOnce(mockResponse)

    const result = await AuthService.logout()

    expect(mockHttpClient.post).toHaveBeenCalledWith('/auth/logout')
    expect(result).toEqual(mockResponse)
    expect(AuthService.getToken()).toBeNull()
  })

  it('given no token when logging out then clears token anyway', async () => {
    const mockResponse = {
      message: 'Logged out',
      cleared_session: ''
    }
    mockHttpClient.post.mockResolvedValueOnce(mockResponse)

    await AuthService.logout()

    expect(AuthService.getToken()).toBeNull()
  })

  it('given server error when logging out then clears tokens locally anyway', async () => {
    const mockToken = 'valid-jwt-token'
    AuthService.storeToken(mockToken)

    mockHttpClient.post.mockRejectedValueOnce(new Error('Server error'))

    await expect(AuthService.logout()).rejects.toThrow('Server error')
    expect(AuthService.getToken()).toBeNull()
  })
})
