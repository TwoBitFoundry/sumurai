import type { Account } from '../types/api';
import { ApiClient, ApiError } from './ApiClient';
import { PlaidService } from './PlaidService';

interface ProviderCatalogDependencies {
  plaidService: typeof PlaidService;
}

export class ProviderCatalog {
  private static deps: ProviderCatalogDependencies = {
    plaidService: PlaidService,
  };

  static configure(deps: Partial<ProviderCatalogDependencies>): void {
    ProviderCatalog.deps = {
      plaidService: deps.plaidService ?? ProviderCatalog.deps.plaidService,
    };
  }
  static async getAccounts(): Promise<Account[]> {
    try {
      return await ApiClient.get<Account[]>('/providers/accounts');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 404) {
          return ApiClient.get<Account[]>('/plaid/accounts');
        }
      }

      try {
        const fallback = await ProviderCatalog.deps.plaidService.getAccounts();
        return fallback.map((account) => ({
          ...account,
          provider: account.provider ?? 'plaid',
        }));
      } catch {
        throw error;
      }
    }
  }
}
