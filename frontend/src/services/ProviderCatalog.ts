import type { Account } from '../types/api'
import { ApiClient, ApiError } from './ApiClient'
import { PlaidService } from './PlaidService'

export class ProviderCatalog {
  static async getAccounts(): Promise<Account[]> {
    try {
      return await ApiClient.get<Account[]>('/providers/accounts')
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 404) {
          return ApiClient.get<Account[]>('/plaid/accounts')
        }
      }

      try {
        const fallback = await PlaidService.getAccounts()
        return fallback.map(account => ({
          ...account,
          provider: account.provider ?? 'plaid'
        }))
      } catch {
        throw error
      }
    }
  }
}
