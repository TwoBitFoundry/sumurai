import type { IHttpClient } from '@/services/boundaries/IHttpClient'

export function createMockHttpClient(): IHttpClient {
  return {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    healthCheck: jest.fn()
  }
}
