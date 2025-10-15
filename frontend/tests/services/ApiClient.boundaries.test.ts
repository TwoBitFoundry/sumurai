import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setupTestBoundaries } from '../setup/setupTestBoundaries'
import { ApiClient } from '@/services/ApiClient'

describe('ApiClient boundary injection infrastructure', () => {
  beforeEach(() => {
    setupTestBoundaries()
  })

  it('ApiClient can be configured with a mock http client', () => {
    const { http } = setupTestBoundaries()
    const configuredClient = ApiClient.getHttpClient()
    expect(configuredClient).toBe(http)
  })

  it('setupTestBoundaries configures ApiClient with mock boundaries', () => {
    const boundaries = setupTestBoundaries()
    const httpClient = ApiClient.getHttpClient()
    expect(httpClient).toBe(boundaries.http)
    expect(httpClient.get).toBeDefined()
    expect(httpClient.post).toBeDefined()
  })

  it('different setupTestBoundaries calls create independent mocks', () => {
    const boundaries1 = setupTestBoundaries()
    const client1 = ApiClient.getHttpClient()

    const boundaries2 = setupTestBoundaries()
    const client2 = ApiClient.getHttpClient()

    expect(client1).not.toBe(client2)
    expect(boundaries1.http).not.toBe(boundaries2.http)
  })

  it('http boundary is a fully mocked IHttpClient interface', () => {
    const { http } = setupTestBoundaries()
    expect(typeof http.get).toBe('function')
    expect(typeof http.post).toBe('function')
    expect(typeof http.put).toBe('function')
    expect(typeof http.delete).toBe('function')
    expect(typeof http.healthCheck).toBe('function')
  })

  it('can set up custom http mock for testing specific behavior', () => {
    const customHttp = {
      get: vi.fn().mockResolvedValue({ custom: 'response' }),
      post: vi.fn().mockResolvedValue({}),
      put: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      healthCheck: vi.fn().mockResolvedValue('ok')
    }

    const boundaries = setupTestBoundaries({ http: customHttp })
    const httpClient = ApiClient.getHttpClient()
    expect(httpClient).toBe(customHttp)
  })

  it('allows verifying ApiClient has been configured', () => {
    const { http } = setupTestBoundaries()
    expect(ApiClient.getHttpClient()).toBe(http)
    expect(http.get.mock).toBeDefined()
    expect(http.post.mock).toBeDefined()
  })
})
