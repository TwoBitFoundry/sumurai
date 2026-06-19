/**
 * Loads linked accounts from the active financial provider.
 */

import type { Account } from '../types/api';
import { ApiClient } from './ApiClient';

export class ProviderCatalog {
  static async getAccounts(): Promise<Account[]> {
    return ApiClient.get<Account[]>('/providers/accounts');
  }
}
