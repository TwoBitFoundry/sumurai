import type {
  PlaidDisconnectResponse,
  PlaidSyncResponse,
  ProviderConnectionStatus,
  ProviderConnectResponse,
  ProviderStatusResponse,
  SimpleFinBridgeSyncResponse,
  SimpleFinIgnoredInstitution,
  SimpleFinInstitutionAuthRequired,
} from '../types/api';
import { buildSyncTransactionsRequest } from '../utils/syncTransactionsRequest';
import { ApiClient, ApiError, RateLimitError } from './ApiClient';

export type SimpleFinConnectSyncResult = {
  rateLimited: boolean;
  transactionCount: number;
  institutionsRequiringAuth: SimpleFinInstitutionAuthRequired[];
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
    const connectResponse = await SimpleFinService.connect(setupToken);
    const institutionsRequiringAuth = connectResponse.simplefin_institutions_requiring_auth ?? [];
    const statuses = await SimpleFinService.getStatus();
    const connectionId = resolveSimpleFinConnectionId(statuses);

    if (!connectionId) {
      return { rateLimited: false, transactionCount: 0, institutionsRequiringAuth };
    }

    try {
      const result = await SimpleFinService.syncTransactions(connectionId);
      return {
        rateLimited: false,
        transactionCount: result.transactions.length,
        institutionsRequiringAuth,
      };
    } catch (error) {
      if (isSyncRateLimited(error)) {
        return { rateLimited: true, transactionCount: 0, institutionsRequiringAuth };
      }

      throw error;
    }
  }

  static async restoreInstitution(orgConnId: string): Promise<SimpleFinConnectSyncResult> {
    await SimpleFinService.restoreIgnoredInstitution(orgConnId);
    const connectResponse = await SimpleFinService.connect();
    const institutionsRequiringAuth = connectResponse.simplefin_institutions_requiring_auth ?? [];
    const statuses = await SimpleFinService.getStatus();
    const connectionId = resolveSimpleFinConnectionId(statuses, orgConnId);

    if (!connectionId) {
      return { rateLimited: false, transactionCount: 0, institutionsRequiringAuth };
    }

    try {
      const result = await SimpleFinService.syncTransactions(connectionId);
      return {
        rateLimited: false,
        transactionCount: result.transactions.length,
        institutionsRequiringAuth,
      };
    } catch (error) {
      if (isSyncRateLimited(error)) {
        return { rateLimited: true, transactionCount: 0, institutionsRequiringAuth };
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

  static async syncBridge(connectionId?: string): Promise<SimpleFinBridgeSyncResponse> {
    try {
      const response = await ApiClient.post<PlaidSyncResponse>(
        '/providers/sync-transactions',
        buildSyncTransactionsRequest(connectionId)
      );

      return {
        rateLimited: false,
        transactions: response.transactions,
        metadata: response.metadata,
        simplefin_institution_results: response.simplefin_institution_results ?? [],
        bridge_warnings: response.bridge_warnings ?? [],
      };
    } catch (error) {
      if (error instanceof RateLimitError || (error instanceof ApiError && error.status === 429)) {
        return {
          rateLimited: true,
          retryAfterSeconds: error instanceof RateLimitError ? error.retryAfterSeconds : undefined,
          transactions: [],
          simplefin_institution_results: [],
          bridge_warnings: [],
        };
      }

      throw error;
    }
  }

  static async disconnect(connectionId: string): Promise<PlaidDisconnectResponse> {
    return ApiClient.post<PlaidDisconnectResponse>('/providers/disconnect', {
      connection_id: connectionId,
    });
  }
}
