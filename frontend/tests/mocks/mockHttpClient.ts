import { vi } from 'vitest'
import type { IHttpClient } from '@/services/boundaries/IHttpClient'

export function createMockHttpClient(): IHttpClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}
