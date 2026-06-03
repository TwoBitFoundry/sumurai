import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import type { UsePlaidLinkFlowResult } from '@/features/plaid/hooks/usePlaidLinkFlow';
import { formatSimpleFinAuthRequiredToast } from '@/features/simplefin/utils/formatSimpleFinAuthRequiredToast';
import { SimpleFinService } from '@/services/SimpleFinService';
import type { ProviderConnectionStatus } from '@/types/api';
import { refreshFinancialDataAfterProviderChange } from '@/utils/queryInvalidation';
import type { PlaidConnection } from '../../../hooks/usePlaidConnections';

interface UseSimpleFinFlowOptions {
  onError?: (message: string | null) => void;
  enabled?: boolean;
  isOnline?: boolean;
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

export function useSimpleFinFlow(options: UseSimpleFinFlowOptions = {}): UsePlaidLinkFlowResult {
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
    return refreshFinancialDataAfterProviderChange(queryClient, ['simplefin']);
  }, [queryClient]);

  const syncAll = useCallback(async () => {
    if (!enabled || !isOnline) {
      return;
    }

    const connectionId = connections.find((connection) => connection.connectionId)?.connectionId;

    if (!connectionId) {
      return;
    }

    await SimpleFinService.syncBridge(connectionId);
    await invalidateSimpleFinCache();
  }, [connections, enabled, invalidateSimpleFinCache, isOnline]);

  const connect = useCallback(
    async (setupToken?: string) => {
      if (!enabled || !isOnline) {
        return;
      }

      clearError();
      setSyncingAll(true);
      try {
        const result = await SimpleFinService.connectAndSyncAll(setupToken);
        await connectionsQuery.refetch();
        await invalidateSimpleFinCache();
        if (result.institutionsRequiringAuth.length > 0) {
          setToast(formatSimpleFinAuthRequiredToast(result.institutionsRequiringAuth));
        } else {
          setToast('SimpleFIN institutions connected');
        }
      } catch (connectError: unknown) {
        const message = `Failed to connect SimpleFIN: ${connectError instanceof Error ? connectError.message : 'Unknown error'}`;
        handleError(message);
      } finally {
        setSyncingAll(false);
      }
    },
    [clearError, connectionsQuery, enabled, handleError, invalidateSimpleFinCache, isOnline]
  );

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
  };
}
