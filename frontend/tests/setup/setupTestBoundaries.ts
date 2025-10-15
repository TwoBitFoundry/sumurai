import type { IHttpClient } from '@/services/boundaries/IHttpClient'
import type { IStorageAdapter } from '@/services/boundaries/IStorageAdapter'
import { ApiClient } from '@/services/ApiClient'
import { AuthService } from '@/services/AuthService'
import { TransactionService } from '@/services/TransactionService'
import { AnalyticsService } from '@/services/AnalyticsService'
import { BudgetService } from '@/services/BudgetService'
import { PlaidService } from '@/services/PlaidService'
import { TellerService } from '@/services/TellerService'
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
  AuthService.configure({ http: boundaries.http, storage: boundaries.storage })
  TransactionService.configure({ http: boundaries.http })
  AnalyticsService.configure({ http: boundaries.http })
  BudgetService.configure({ http: boundaries.http })
  PlaidService.configure({ http: boundaries.http })
  TellerService.configure({ http: boundaries.http })

  return boundaries
}

export function resetBoundaries(): void {
  const defaultBoundaries = setupTestBoundaries()
  setupTestBoundaries(defaultBoundaries)
}
