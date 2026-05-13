import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { AccountNormalizer, type BackendAccount } from '../domain/AccountNormalizer';
import { PlaidService } from '../services/PlaidService';

type NormalizedAccount = {
  id: string;
  name: string;
  mask: string;
  type: 'checking' | 'savings' | 'credit' | 'loan' | 'other';
  balance?: number;
  transactions?: number;
  connectionKey: string | null;
};

export interface PlaidConnection {
  id: string;
  connectionId: string;
  institutionName: string;
  lastSyncAt: string | null;
  transactionCount: number;
  accountCount: number;
  syncInProgress: boolean;
  isConnected: boolean;
  accounts: Array<{
    id: string;
    name: string;
    mask: string;
    type: 'checking' | 'savings' | 'credit' | 'loan' | 'other';
    balance?: number;
    transactions?: number;
  }>;
}

export interface PlaidConnectionsState {
  connections: PlaidConnection[];
  loading: boolean;
  error: string | null;
}

export interface PlaidConnectionsActions {
  addConnection: (institutionName: string, connectionId: string) => Promise<void>;
  removeConnection: (connectionId: string) => void;
  updateConnectionSyncInfo: (
    connectionId: string,
    transactionCount: number,
    accountCount: number,
    lastSyncAt: string
  ) => void;
  setConnectionSyncInProgress: (connectionId: string, inProgress: boolean) => void;
  refresh: () => Promise<PlaidConnection[]>;
  getConnection: (connectionId: string) => PlaidConnection | undefined;
}

export type UsePlaidConnectionsReturn = PlaidConnectionsState & PlaidConnectionsActions;

const normalizeAccounts = (backendAccounts: BackendAccount[]): NormalizedAccount[] => {
  return AccountNormalizer.normalize(backendAccounts);
};

const buildFallbackConnections = (backendAccounts: BackendAccount[]): PlaidConnection[] => {
  const normalizedAccounts = normalizeAccounts(backendAccounts);
  const groups = new Map<
    string,
    Array<{ backend: BackendAccount; normalized: NormalizedAccount }>
  >();

  backendAccounts.forEach((backendAccount, index) => {
    const normalizedAccount = normalizedAccounts[index];
    const groupKey =
      normalizedAccount.connectionKey ??
      backendAccount.institution_name ??
      String(backendAccount.id);
    const group = groups.get(groupKey) ?? [];
    group.push({ backend: backendAccount, normalized: normalizedAccount });
    groups.set(groupKey, group);
  });

  return Array.from(groups.entries()).map(([groupKey, entries]) => {
    const accounts = entries.map(({ normalized }) => {
      const { connectionKey: _ignore, ...rest } = normalized;
      return rest;
    });

    return {
      id: groupKey,
      connectionId: groupKey,
      institutionName: entries[0]?.backend.institution_name || 'Unknown Bank',
      lastSyncAt: null,
      transactionCount: entries.reduce(
        (sum, entry) => sum + (entry.normalized.transactions ?? 0),
        0
      ),
      accountCount: entries.length,
      syncInProgress: false,
      isConnected: true,
      accounts,
    };
  });
};

export const usePlaidConnections = (
  options: { enabled?: boolean } = {}
): UsePlaidConnectionsReturn => {
  const enabled = options.enabled ?? true;
  const queryClient = useQueryClient();
  const query = useQuery<PlaidConnection[], Error>({
    queryKey: ['plaid', 'connections'],
    queryFn: async () => {
      const [statusResult, accountsResult] = await Promise.allSettled([
        PlaidService.getStatus(),
        PlaidService.getAccounts(),
      ]);
      const statusArray =
        statusResult.status === 'fulfilled' && Array.isArray(statusResult.value.connections)
          ? statusResult.value.connections
          : [];
      const backendAccounts =
        accountsResult.status === 'fulfilled' && Array.isArray(accountsResult.value)
          ? (accountsResult.value as BackendAccount[])
          : [];
      const allAccounts = normalizeAccounts(backendAccounts);

      const statusConnections: PlaidConnection[] = statusArray
        .filter((connStatus) => connStatus.is_connected)
        .map((connStatus) => {
          const connectionId = connStatus.connection_id ? String(connStatus.connection_id) : null;
          let matchingAccounts: NormalizedAccount[];

          if (connectionId) {
            matchingAccounts = allAccounts.filter((acc) => acc.connectionKey === connectionId);
            if (matchingAccounts.length === 0) {
              matchingAccounts = allAccounts.filter((acc) => acc.connectionKey === null);
            }
          } else {
            matchingAccounts = allAccounts.slice();
          }

          const connectionAccounts = matchingAccounts.map(
            ({ connectionKey: _ignore, ...rest }) => rest
          );
          return {
            id: connStatus.connection_id || 'unknown',
            connectionId: connStatus.connection_id || 'unknown',
            institutionName: connStatus.institution_name || 'Unknown Bank',
            lastSyncAt: connStatus.last_sync_at,
            transactionCount: connStatus.transaction_count || 0,
            accountCount: connStatus.account_count || 0,
            syncInProgress: connStatus.sync_in_progress || false,
            isConnected: connStatus.is_connected,
            accounts: connectionAccounts,
          };
        });
      return statusConnections.length > 0
        ? statusConnections
        : buildFallbackConnections(backendAccounts);
    },
    enabled,
    staleTime: 0,
  });

  const addConnection = useCallback(
    async (institutionName: string, connectionId: string): Promise<void> => {
      let accounts: Array<{
        id: string;
        name: string;
        mask: string;
        type: 'checking' | 'savings' | 'credit' | 'loan' | 'other';
        balance?: number;
        transactions?: number;
      }> = [];
      // Try to fetch accounts for the new connection
      try {
        const backendAccounts = await PlaidService.getAccounts();
        const normalized = normalizeAccounts(backendAccounts as BackendAccount[]);
        const connectionKey = connectionId ? String(connectionId) : null;

        let matching = connectionKey
          ? normalized.filter((acc) => acc.connectionKey === connectionKey)
          : normalized.slice();

        if (connectionKey && matching.length === 0) {
          matching = normalized.filter((acc) => acc.connectionKey === null);
        }

        accounts = matching.map(({ connectionKey: _ignore, ...rest }) => rest);
      } catch (accountError) {
        console.warn('Failed to fetch accounts for new connection:', accountError);
      }

      const newConnection: PlaidConnection = {
        id: connectionId,
        connectionId,
        institutionName,
        lastSyncAt: null,
        transactionCount: 0,
        accountCount: 0,
        syncInProgress: false,
        isConnected: true,
        accounts: accounts,
      };

      queryClient.setQueryData<PlaidConnection[]>(['plaid', 'connections'], (current = []) => [
        ...current,
        newConnection,
      ]);
    },
    [queryClient]
  );

  const removeConnection = useCallback(
    (connectionId: string): void => {
      queryClient.setQueryData<PlaidConnection[]>(['plaid', 'connections'], (current = []) =>
        current.filter((conn) => conn.connectionId !== connectionId)
      );
    },
    [queryClient]
  );

  const updateConnectionSyncInfo = useCallback(
    (
      connectionId: string,
      transactionCount: number,
      accountCount: number,
      lastSyncAt: string
    ): void => {
      queryClient.setQueryData<PlaidConnection[]>(['plaid', 'connections'], (current = []) =>
        current.map((conn) =>
          conn.connectionId === connectionId
            ? {
                ...conn,
                transactionCount,
                accountCount,
                lastSyncAt,
                syncInProgress: false,
              }
            : conn
        )
      );
    },
    [queryClient]
  );

  const setConnectionSyncInProgress = useCallback(
    (connectionId: string, inProgress: boolean): void => {
      queryClient.setQueryData<PlaidConnection[]>(['plaid', 'connections'], (current = []) =>
        current.map((conn) =>
          conn.connectionId === connectionId ? { ...conn, syncInProgress: inProgress } : conn
        )
      );
    },
    [queryClient]
  );

  const refresh = useCallback(async (): Promise<PlaidConnection[]> => {
    const result = await query.refetch();
    return result.data ?? [];
  }, [query]);

  const getConnection = useCallback(
    (connectionId: string): PlaidConnection | undefined => {
      return (query.data ?? []).find((conn) => conn.connectionId === connectionId);
    },
    [query.data]
  );

  return {
    connections: query.data ?? [],
    loading: enabled ? query.isPending : false,
    error: query.error?.message ?? null,
    addConnection,
    removeConnection,
    updateConnectionSyncInfo,
    setConnectionSyncInProgress,
    refresh,
    getConnection,
  };
};
