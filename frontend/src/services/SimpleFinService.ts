import type {
  PlaidDisconnectResponse,
  PlaidSyncResponse,
  ProviderConnectionStatus,
  ProviderConnectResponse,
  ProviderStatusResponse,
} from '../types/api';
import { buildSyncTransactionsRequest } from '../utils/syncTransactionsRequest';
import { ApiClient } from './ApiClient';

export class SimpleFinService {
  static async submitSetupToken(token: string): Promise<ProviderConnectResponse> {
    return ApiClient.post<ProviderConnectResponse>('/providers/connect', {
      provider: 'simplefin',
      access_token: token,
      enrollment_id: '',
    });
  }

  static async getStatus(): Promise<ProviderConnectionStatus[]> {
    const status = await ApiClient.get<ProviderStatusResponse>('/providers/status');

    if (status.provider !== 'simplefin') {
      return [];
    }

    return status.connections;
  }

  static async syncTransactions(connectionId?: string): Promise<PlaidSyncResponse> {
    return ApiClient.post<PlaidSyncResponse>(
      '/providers/sync-transactions',
      buildSyncTransactionsRequest(connectionId)
    );
  }

  static async disconnect(connectionId: string): Promise<PlaidDisconnectResponse> {
    return ApiClient.post<PlaidDisconnectResponse>('/providers/disconnect', {
      connection_id: connectionId,
    });
  }
}
