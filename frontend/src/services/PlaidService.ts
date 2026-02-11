import type {
  Account,
  PlaidDisconnectResponse,
  PlaidExchangeTokenResponse,
  PlaidLinkTokenResponse,
  PlaidSyncResponse,
  ProviderStatusResponse,
} from '../types/api';
import { ApiClient } from './ApiClient';

export class PlaidService {
  static async getLinkToken(): Promise<PlaidLinkTokenResponse> {
    return ApiClient.post<PlaidLinkTokenResponse>('/plaid/link-token', {});
  }

  static async exchangeToken(publicToken: string): Promise<PlaidExchangeTokenResponse> {
    return ApiClient.post<PlaidExchangeTokenResponse>('/plaid/exchange-token', {
      public_token: publicToken,
    });
  }

  static async getAccounts(): Promise<Account[]> {
    return ApiClient.get<Account[]>('/plaid/accounts');
  }

  static async syncTransactions(connectionId?: string): Promise<PlaidSyncResponse> {
    return ApiClient.post<PlaidSyncResponse>(
      '/providers/sync-transactions',
      connectionId ? { connection_id: connectionId } : {}
    );
  }

  static async getStatus(): Promise<ProviderStatusResponse> {
    return ApiClient.get<ProviderStatusResponse>('/providers/status');
  }

  static async disconnect(connectionId: string): Promise<PlaidDisconnectResponse> {
    return ApiClient.post<PlaidDisconnectResponse>('/providers/disconnect', {
      connection_id: connectionId,
    });
  }

  static async clearSyncedData(): Promise<{ cleared: boolean }> {
    return ApiClient.post<{ cleared: boolean }>('/plaid/clear-synced-data');
  }
}
