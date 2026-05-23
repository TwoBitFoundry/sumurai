import type {
  PlaidDisconnectResponse,
  PlaidSyncResponse,
  ProviderConnectionStatus,
  ProviderConnectResponse,
  ProviderStatusResponse,
  SimpleFinIgnoredInstitution,
} from '../types/api';
import { buildSyncTransactionsRequest } from '../utils/syncTransactionsRequest';
import { ApiClient, ApiError } from './ApiClient';

export type SimpleFinConnectSyncResult = {
  rateLimited: boolean;
  transactionCount: number;
};

const isSyncRateLimited = (error: unknown): boolean =>
  error instanceof ApiError && error.status === 429;

const resolveSimpleFinConnectionId = (
  statuses: ProviderConnectionStatus[],
  preferredOrgConnId?: string
): string | undefined => {
  if (preferredOrgConnId) {
    const scoped = statuses.find(
      (status) =>
        status.connection_id &&
        status.item_id &&
        (status.item_id.endsWith(`_${preferredOrgConnId}`) ||
          status.item_id.includes(preferredOrgConnId))
    )?.connection_id;
    if (scoped) {
      return scoped;
    }
  }

  return statuses.find((status) => status.connection_id)?.connection_id;
};

export class SimpleFinService {
  static async connect(setupToken?: string): Promise<ProviderConnectResponse> {
    return ApiClient.post<ProviderConnectResponse>('/providers/connect', {
      provider: 'simplefin',
      access_token: '',
      enrollment_id: '',
      simplefin: {
        simplefin_setup_token: setupToken ?? null,
      },
    });
  }

  static async getStatus(): Promise<ProviderConnectionStatus[]> {
    const status = await ApiClient.get<ProviderStatusResponse>('/providers/status');

    return status.connections.filter(
      (connection) =>
        connection.is_connected &&
        (connection.item_id?.startsWith('simplefin_') ?? status.provider === 'simplefin')
    );
  }

  static async getIgnoredInstitutions(): Promise<SimpleFinIgnoredInstitution[]> {
    const response = await ApiClient.get<{ institutions: SimpleFinIgnoredInstitution[] }>(
      '/providers/simplefin/ignored-institutions'
    );

    return response.institutions;
  }

  static async restoreIgnoredInstitution(orgConnId: string): Promise<boolean> {
    const response = await ApiClient.post<{ restored: boolean }>(
      '/providers/simplefin/ignored-institutions',
      {
        org_conn_id: orgConnId,
      }
    );

    return response.restored;
  }

  static async connectAndSyncAll(setupToken?: string): Promise<SimpleFinConnectSyncResult> {
    await SimpleFinService.connect(setupToken);
    const statuses = await SimpleFinService.getStatus();
    const connectionId = resolveSimpleFinConnectionId(statuses);

    if (!connectionId) {
      return { rateLimited: false, transactionCount: 0 };
    }

    try {
      const result = await SimpleFinService.syncTransactions(connectionId);
      return { rateLimited: false, transactionCount: result?.metadata?.transaction_count ?? 0 };
    } catch (error) {
      if (isSyncRateLimited(error)) {
        return { rateLimited: true, transactionCount: 0 };
      }

      throw error;
    }
  }

  static async restoreInstitution(orgConnId: string): Promise<SimpleFinConnectSyncResult> {
    await SimpleFinService.restoreIgnoredInstitution(orgConnId);
    await SimpleFinService.connect();
    const statuses = await SimpleFinService.getStatus();
    const connectionId = resolveSimpleFinConnectionId(statuses, orgConnId);

    if (!connectionId) {
      return { rateLimited: false, transactionCount: 0 };
    }

    try {
      const result = await SimpleFinService.syncTransactions(connectionId);
      return { rateLimited: false, transactionCount: result?.metadata?.transaction_count ?? 0 };
    } catch (error) {
      if (isSyncRateLimited(error)) {
        return { rateLimited: true, transactionCount: 0 };
      }

      throw error;
    }
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
