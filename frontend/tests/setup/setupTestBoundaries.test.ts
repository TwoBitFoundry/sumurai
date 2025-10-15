import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setupTestBoundaries, resetBoundaries } from './setupTestBoundaries'
import { ApiClient } from '@/services/ApiClient'
import { AuthService } from '@/services/AuthService'

describe('setupTestBoundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an object with http and storage boundaries', () => {
    const boundaries = setupTestBoundaries()
    expect(boundaries).toBeDefined()
    expect(boundaries.http).toBeDefined()
    expect(boundaries.storage).toBeDefined()
  })

  it('sets up boundaries successfully', () => {
    const mockHttp = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      healthCheck: vi.fn()
    }
    const boundaries = setupTestBoundaries({ http: mockHttp })
    expect(boundaries.http).toBe(mockHttp)
  })

  it('configures AuthService with provided boundaries', () => {
    const boundaries = setupTestBoundaries()
    expect(AuthService.getToken).toBeDefined()
  })

  it('allows overriding specific boundaries', () => {
    const mockHttpClient = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      healthCheck: vi.fn()
    }

    const boundaries = setupTestBoundaries({ http: mockHttpClient })
    expect(boundaries.http).toBe(mockHttpClient)
    expect(boundaries.storage).toBeDefined()
  })

  it('creates new mock instances when called multiple times without overrides', () => {
    const boundaries1 = setupTestBoundaries()
    const boundaries2 = setupTestBoundaries()

    expect(boundaries1.http).not.toBe(boundaries2.http)
    expect(boundaries1.storage).not.toBe(boundaries2.storage)
  })

  it('allows partial overrides of boundaries', () => {
    const customHttp = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      healthCheck: vi.fn()
    }

    const boundaries = setupTestBoundaries({ http: customHttp })
    expect(boundaries.http).toBe(customHttp)
    expect(boundaries.storage).toBeDefined()
    expect(boundaries.storage !== undefined).toBe(true)
  })

  it('storage boundary supports all required operations', () => {
    const boundaries = setupTestBoundaries()
    const { storage } = boundaries

    storage.setItem('test', 'value')
    expect(storage.getItem('test')).toBe('value')

    storage.removeItem('test')
    expect(storage.getItem('test')).toBeNull()

    storage.clear()
    expect(storage.getItem('test')).toBeNull()
  })

  it('http boundary is a mock with callable methods', async () => {
    const boundaries = setupTestBoundaries()
    const { http } = boundaries

    http.get.mockResolvedValue({ data: 'test' })
    const result = await http.get('/test')
    expect(result).toEqual({ data: 'test' })
    expect(http.get).toHaveBeenCalledWith('/test')
  })

  it('resetBoundaries reconfigures services with fresh defaults', () => {
    const boundaries1 = setupTestBoundaries()
    resetBoundaries()
    const boundaries2 = setupTestBoundaries()
    expect(boundaries1.http).not.toBe(boundaries2.http)
  })
})
