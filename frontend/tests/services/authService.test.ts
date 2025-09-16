import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthService } from '@/services/authService'

// Mock fetch globally
global.fetch = vi.fn()

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage
})

describe('AuthService logout functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionStorage.getItem.mockReturnValue(null)
    mockSessionStorage.setItem.mockImplementation(() => {})
    mockSessionStorage.removeItem.mockImplementation(() => {})
    mockSessionStorage.clear.mockImplementation(() => {})
  })

  it('given valid token when logging out then calls logout endpoint and clears tokens', async () => {
    // Given
    const mockToken = 'valid-jwt-token'
    mockSessionStorage.getItem.mockReturnValue(mockToken)
    
    const mockResponse = {
      message: 'Logged out successfully',
      cleared_session: 'session-id'
    }
    
    ;(fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })

    // When
    const result = await AuthService.logout()

    // Then
    expect(fetch).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mockToken}`,
      },
    })
    expect(result).toEqual(mockResponse)
    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('auth_token')
    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('refresh_token')
  })

  it('given no token when logging out then throws error', async () => {
    // Given - no token in sessionStorage

    // When & Then
    await expect(AuthService.logout()).rejects.toThrow('No token to logout with')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('given server returns 401 when logging out then clears tokens locally and returns fallback message', async () => {
    // Given
    const mockToken = 'invalid-jwt-token'
    mockSessionStorage.getItem.mockReturnValue(mockToken)
    
    ;(fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401
    })

    // When
    const result = await AuthService.logout()

    // Then
    expect(result).toEqual({
      message: 'Logged out locally (token was invalid)',
      cleared_session: ''
    })
    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('auth_token')
  })

  it('given server error when logging out then clears tokens locally and throws descriptive error', async () => {
    // Given
    const mockToken = 'valid-jwt-token'
    mockSessionStorage.getItem.mockReturnValue(mockToken)
    
    ;(fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500
    })

    // When & Then
    await expect(AuthService.logout()).rejects.toThrow('Logout failed on server, but cleared locally')
    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('auth_token')
  })
})
