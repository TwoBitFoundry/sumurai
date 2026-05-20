/**
 * Loads linked accounts from the active financial provider.
 */

import type { Account } from '../types/api';
import { ApiClient, ApiError } from './ApiClient';

export class ProviderCatalog {
  static async getAccounts(): Promise<Account[]> {
    try {
      return await ApiClient.get<Account[]>('/providers/accounts');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 404) {
          return ApiClient.get<Account[]>('/plaid/accounts');
        }
      }
      return ApiClient.get<Account[]>('/plaid/accounts');
    }
  }
}
