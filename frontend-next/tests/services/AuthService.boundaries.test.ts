import { setupTestBoundaries } from '../setup/setupTestBoundaries'
import { AuthService } from '@/services/authService'

describe('AuthService with injected boundaries', () => {
  beforeEach(() => {
    setupTestBoundaries()
  })

  it('stores token in injected storage boundary', () => {
    const { storage } = setupTestBoundaries()

    const token = 'test-jwt-token'
    AuthService.storeToken(token)

    expect(storage.getItem('auth_token')).toBe(token)
  })

  it('retrieves token from injected storage boundary', () => {
    const { storage } = setupTestBoundaries()

    const token = 'test-jwt-token'
    storage.setItem('auth_token', token)

    const retrieved = AuthService.getToken()
    expect(retrieved).toBe(token)
  })

  it('clears tokens from injected storage boundary', () => {
    const { storage } = setupTestBoundaries()

    storage.setItem('auth_token', 'token')
    storage.setItem('refresh_token', 'refresh')

    AuthService.clearToken()

    expect(storage.getItem('auth_token')).toBeNull()
    expect(storage.getItem('refresh_token')).toBeNull()
  })

  it('stores refresh token when provided', () => {
    const { storage } = setupTestBoundaries()

    const token = 'access-token'
    const refreshToken = 'refresh-token'
    AuthService.storeToken(token, refreshToken)

    expect(storage.getItem('auth_token')).toBe(token)
    expect(storage.getItem('refresh_token')).toBe(refreshToken)
  })

  it('returns null when token does not exist in storage', () => {
    setupTestBoundaries()

    const token = AuthService.getToken()
    expect(token).toBeNull()
  })

  it('different instances have isolated storage', () => {
    const boundaries1 = setupTestBoundaries()
    const boundaries2 = setupTestBoundaries()

    boundaries1.storage.setItem('key', 'value1')
    boundaries2.storage.setItem('key', 'value2')

    expect(boundaries1.storage.getItem('key')).toBe('value1')
    expect(boundaries2.storage.getItem('key')).toBe('value2')
  })

  it('can clear all storage using boundary', () => {
    const { storage } = setupTestBoundaries()

    storage.setItem('auth_token', 'token')
    storage.setItem('refresh_token', 'refresh')
    storage.setItem('user_data', 'data')

    storage.clear()

    expect(storage.getItem('auth_token')).toBeNull()
    expect(storage.getItem('refresh_token')).toBeNull()
    expect(storage.getItem('user_data')).toBeNull()
  })

  it('session storage is isolated between test runs', () => {
    const boundaries1 = setupTestBoundaries()
    boundaries1.storage.setItem('test_key', 'test_value')

    const boundaries2 = setupTestBoundaries()
    expect(boundaries2.storage.getItem('test_key')).toBeNull()
  })
})
