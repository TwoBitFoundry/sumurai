import type { IHttpClient } from '@/services/boundaries/IHttpClient'
import type { IStorageAdapter } from '@/services/boundaries/IStorageAdapter'
import { ApiClient } from '@/services/ApiClient'
import { AuthService } from '@/services/AuthService'
import { createMockHttpClient } from '../mocks/mockHttpClient'
import { createMockStorage } from '../mocks/mockStorage'

export interface TestBoundaries {
  http: IHttpClient
  storage: IStorageAdapter
}

export function setupTestBoundaries(
  overrides?: Partial<TestBoundaries>
): TestBoundaries {
  const boundaries: TestBoundaries = {
    http: overrides?.http ?? createMockHttpClient(),
    storage: overrides?.storage ?? createMockStorage()
  }

  ApiClient.configure(boundaries.http)
  AuthService.configure({ storage: boundaries.storage })

  return boundaries
}

export function resetBoundaries(): void {
  const defaultBoundaries = setupTestBoundaries()
  setupTestBoundaries(defaultBoundaries)
}
