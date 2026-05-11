import { useCallback, useState } from 'react';
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
  const [state, setState] = useState<PlaidConnectionsState>({
    connections: [],
    loading: false,
    error: null,
  });

  const fetchConnections = useCallback(async (): Promise<PlaidConnection[]> => {
    if (!enabled) {
      setState((prev) => ({ ...prev, connections: [], loading: false, error: null }));
      return [];
    }
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

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
      const connections: PlaidConnection[] =
        statusConnections.length > 0
          ? statusConnections
          : buildFallbackConnections(backendAccounts);

      let effectiveConnections: PlaidConnection[] = [];
      setState((prev) => {
        effectiveConnections = connections.length > 0 ? connections : prev.connections;
        return {
          ...prev,
          connections: effectiveConnections,
          loading: false,
          error: effectiveConnections.length > 0 ? null : 'Failed to load connections',
        };
      });
      return effectiveConnections;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load connections';
      let effectiveConnections: PlaidConnection[] = [];
      setState((prev) => {
        effectiveConnections = prev.connections;
        return {
          ...prev,
          loading: false,
          error: prev.connections.length > 0 ? null : message,
        };
      });
      return effectiveConnections;
    }
  }, [enabled]);

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

      setState((prev) => ({
        ...prev,
        connections: [...prev.connections, newConnection],
        error: null,
      }));
    },
    []
  );

  const removeConnection = useCallback((connectionId: string): void => {
    setState((prev) => ({
      ...prev,
      connections: prev.connections.filter((conn) => conn.connectionId !== connectionId),
    }));
  }, []);

  const updateConnectionSyncInfo = useCallback(
    (
      connectionId: string,
      transactionCount: number,
      accountCount: number,
      lastSyncAt: string
    ): void => {
      setState((prev) => ({
        ...prev,
        connections: prev.connections.map((conn) =>
          conn.connectionId === connectionId
            ? {
                ...conn,
                transactionCount,
                accountCount,
                lastSyncAt,
                syncInProgress: false,
              }
            : conn
        ),
      }));
    },
    []
  );

  const setConnectionSyncInProgress = useCallback(
    (connectionId: string, inProgress: boolean): void => {
      setState((prev) => ({
        ...prev,
        connections: prev.connections.map((conn) =>
          conn.connectionId === connectionId ? { ...conn, syncInProgress: inProgress } : conn
        ),
      }));
    },
    []
  );

  const refresh = useCallback(async (): Promise<PlaidConnection[]> => {
    return await fetchConnections();
  }, [fetchConnections]);

  const getConnection = useCallback(
    (connectionId: string): PlaidConnection | undefined => {
      return state.connections.find((conn) => conn.connectionId === connectionId);
    },
    [state.connections]
  );

  return {
    ...state,
    addConnection,
    removeConnection,
    updateConnectionSyncInfo,
    setConnectionSyncInProgress,
    refresh,
    getConnection,
  };
};
