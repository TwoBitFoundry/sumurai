import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import type { UsePlaidLinkFlowResult } from '@/features/plaid/hooks/usePlaidLinkFlow';
import { SimpleFinService } from '@/services/SimpleFinService';
import type { ProviderConnectionStatus } from '@/types/api';
import { invalidateStaleCacheQueries } from '@/utils/queryInvalidation';
import type { PlaidConnection } from '../../../hooks/usePlaidConnections';

interface UseSimpleFinFlowOptions {
  onError?: (message: string | null) => void;
  enabled?: boolean;
  isOnline?: boolean;
}

export interface UseSimpleFinFlowResult extends UsePlaidLinkFlowResult {
  submitSetupToken: (token: string) => Promise<void>;
}

const mapStatusToConnection = (status: ProviderConnectionStatus): PlaidConnection => {
  const connectionId = status.connection_id ?? 'unknown';

  return {
    id: connectionId,
    connectionId,
    institutionName: status.institution_name ?? 'Institution',
    lastSyncAt: status.last_sync_at,
    transactionCount: status.transaction_count ?? 0,
    accountCount: status.account_count ?? 0,
    syncInProgress: status.sync_in_progress ?? false,
    isConnected: status.is_connected,
    accounts: [],
  };
};

const buildSimpleFinConnections = async (): Promise<PlaidConnection[]> => {
  const statuses = await SimpleFinService.getStatus();
  return statuses.filter((status) => status.is_connected).map(mapStatusToConnection);
};

export function useSimpleFinFlow(options: UseSimpleFinFlowOptions = {}): UseSimpleFinFlowResult {
  const { onError, enabled = true, isOnline = true } = options;
  const queryClient = useQueryClient();
  const connectionsQuery = useQuery<PlaidConnection[], Error>({
    queryKey: ['simplefin', 'connections'],
    queryFn: buildSimpleFinConnections,
    enabled: enabled && isOnline,
    staleTime: 5 * 60 * 1000,
  });
  const connections = enabled && isOnline ? (connectionsQuery.data ?? []) : [];
  const loading = enabled && isOnline ? connectionsQuery.isPending : false;
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  const handleError = useCallback(
    (message: string) => {
      if (enabled) {
        setError(message);
        onError?.(message);
      }
    },
    [enabled, onError]
  );

  const clearError = useCallback(() => {
    if (enabled) {
      setError(null);
      onError?.(null);
    }
  }, [enabled, onError]);

  const invalidateSimpleFinCache = useCallback(() => {
    return invalidateStaleCacheQueries(queryClient, ['simplefin']);
  }, [queryClient]);

  const syncAll = useCallback(async () => {
    if (!enabled || !isOnline) {
      return;
    }

    const ids = connections
      .map((connection) => connection.connectionId)
      .filter((id): id is string => Boolean(id));

    if (ids.length === 0) {
      return;
    }

    await Promise.all(ids.map((id) => SimpleFinService.syncTransactions(id)));
    await invalidateSimpleFinCache();
  }, [connections, enabled, invalidateSimpleFinCache, isOnline]);

  const submitSetupToken = useCallback(
    async (token: string) => {
      if (!enabled || !isOnline) {
        return;
      }

      clearError();
      setSyncingAll(true);
      try {
        await SimpleFinService.submitSetupToken(token);
        const refetch = await connectionsQuery.refetch();
        const refreshed = refetch.data ?? [];
        const ids = refreshed
          .map((connection) => connection.connectionId)
          .filter((id): id is string => Boolean(id));

        if (ids.length > 0) {
          await Promise.all(ids.map((id) => SimpleFinService.syncTransactions(id)));
        }

        await invalidateSimpleFinCache();
        setToast('SimpleFIN institutions connected');
      } catch (submitError: unknown) {
        const message = `Failed to connect SimpleFIN: ${submitError instanceof Error ? submitError.message : 'Unknown error'}`;
        handleError(message);
      } finally {
        setSyncingAll(false);
      }
    },
    [clearError, connectionsQuery, enabled, handleError, invalidateSimpleFinCache, isOnline]
  );

  const connect = useCallback(async () => {}, []);

  const syncOne = useCallback(
    async (connectionId: string) => {
      if (!enabled || !isOnline) {
        return;
      }

      clearError();
      try {
        await SimpleFinService.syncTransactions(connectionId);
        await invalidateSimpleFinCache();
        setToast('Sync started for SimpleFIN connection');
      } catch (syncError: unknown) {
        const message = `Sync failed: ${syncError instanceof Error ? syncError.message : 'Unknown error'}`;
        handleError(message);
      }
    },
    [clearError, enabled, handleError, invalidateSimpleFinCache, isOnline]
  );

  const disconnect = useCallback(
    async (connectionId: string) => {
      if (!enabled || !isOnline) {
        return;
      }

      clearError();
      try {
        await SimpleFinService.disconnect(connectionId);
        await connectionsQuery.refetch();
        await invalidateSimpleFinCache();
        setToast('Disconnected SimpleFIN institution');
      } catch (disconnectError: unknown) {
        const message = `Failed to disconnect: ${disconnectError instanceof Error ? disconnectError.message : 'Unknown error'}`;
        handleError(message);
      }
    },
    [clearError, connectionsQuery, enabled, handleError, invalidateSimpleFinCache, isOnline]
  );

  return {
    connections,
    loading,
    error: enabled ? (error ?? connectionsQuery.error?.message ?? null) : null,
    toast,
    setToast,
    connect,
    syncOne,
    syncAll,
    disconnect,
    syncingAll: enabled ? syncingAll : false,
    plaidLinkMount: null,
    submitSetupToken,
  };
}
