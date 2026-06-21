/**
 * Teller link flow for managing connections outside onboarding.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  TellerConnectSdk,
  type TellerConnectSdkHandle,
} from '@/features/teller/components/TellerConnectSdk';
import type { TellerEnvironment } from '@/features/teller/tellerConnectScript';
import {
  POPUP_BLOCKED_MESSAGE,
  TELLER_CONNECT_LOAD_FAILED_MESSAGE,
} from '@/utils/popupBlockedMessage';
import type { BackendAccount } from '../domain/AccountNormalizer';
import { mapStoredAccountTypeToUiType } from '../domain/accountCategories';
import { ProviderCatalog } from '../services/ProviderCatalog';
import { TellerService } from '../services/TellerService';
import { dispatchAccountsChanged } from '../utils/events';
import {
  type InvalidateStaleCacheOptions,
  invalidateStaleCacheQueries,
} from '../utils/queryInvalidation';
import type { PlaidConnection } from './usePlaidConnections';

export interface UseTellerLinkFlowOptions {
  applicationId: string | null;
  environment?: TellerEnvironment;
  onError?: (message: string | null) => void;
  enabled?: boolean;
  isOnline?: boolean;
}

export interface UseTellerLinkFlowResult {
  connections: PlaidConnection[];
  loading: boolean;
  error: string | null;
  toast: string | null;
  setToast: (value: string | null) => void;
  connect: () => Promise<void>;
  syncOne: (connectionId: string) => Promise<void>;
  syncAll: () => Promise<void>;
  disconnect: (connectionId: string) => Promise<void>;
  syncingAll: boolean;
  tellerConnectMount: ReturnType<typeof createElement> | null;
}

interface LoadResult {
  hasPopulatedBalances: boolean;
  connectionIds: string[];
}

const parseNumeric = (value: unknown): number | undefined => {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const isNegativeParenthetical = trimmed.startsWith('(') && trimmed.endsWith(')');
    const stripped = trimmed.replace(/[^0-9.-]/g, '');
    if (stripped.length === 0) {
      return undefined;
    }
    const parsed = Number(stripped);
    if (Number.isNaN(parsed)) {
      return undefined;
    }
    return isNegativeParenthetical ? -parsed : parsed;
  }

  return undefined;
};

const resolveConnectionId = (account: BackendAccount): string | null => {
  const raw =
    account.provider_connection_id ??
    account.connection_id ??
    account.plaid_connection_id ??
    account.providerConnectionId ??
    account.connectionId ??
    null;

  return raw != null ? String(raw) : null;
};

const mapAccount = (account: BackendAccount) => {
  const ledger =
    parseNumeric(account.balance_ledger) ??
    parseNumeric(account.balance_current) ??
    parseNumeric(account.current_balance ?? null);

  const txnCount = parseNumeric(account.transaction_count);

  const name =
    account.name ??
    account.account_name ??
    account.official_name ??
    account.institution_name ??
    'Account';

  const maskSource =
    account.mask ?? account.account_mask ?? account.last_four ?? account.lastFour ?? '0000';

  return {
    id: String(account.id),
    name,
    mask: maskSource != null ? String(maskSource) : '0000',
    type: mapStoredAccountTypeToUiType(
      account.account_type ?? account.type ?? account.accountType ?? account.subtype ?? undefined
    ),
    balance: ledger ?? undefined,
    transactions: txnCount ?? undefined,
  };
};

const buildFallbackConnections = (typedAccounts: BackendAccount[]): PlaidConnection[] => {
  const grouped = new Map<string, BackendAccount[]>();

  for (const account of typedAccounts) {
    const connectionId = resolveConnectionId(account);
    const groupKey = connectionId ?? account.institution_name ?? String(account.id);
    const group = grouped.get(groupKey) ?? [];
    group.push(account);
    grouped.set(groupKey, group);
  }

  return Array.from(grouped.entries()).map(([groupKey, groupAccounts]) => ({
    id: groupKey,
    connectionId: groupKey,
    institutionName: groupAccounts[0]?.institution_name || 'Unknown Bank',
    lastSyncAt: null,
    transactionCount: groupAccounts.reduce(
      (sum, account) => sum + (parseNumeric(account.transaction_count) ?? 0),
      0
    ),
    accountCount: groupAccounts.length,
    syncInProgress: false,
    isConnected: true,
    accounts: groupAccounts.map(mapAccount),
  }));
};

const buildTellerConnections = async (): Promise<PlaidConnection[]> => {
  const [statusResult, accountsResult] = await Promise.allSettled([
    TellerService.getStatus(),
    ProviderCatalog.getAccounts(),
  ]);
  const hadLoadFailure = statusResult.status === 'rejected' || accountsResult.status === 'rejected';
  const statusList =
    statusResult.status === 'fulfilled' && Array.isArray(statusResult.value)
      ? statusResult.value
      : [];
  const typedAccounts =
    accountsResult.status === 'fulfilled' && Array.isArray(accountsResult.value)
      ? (accountsResult.value as BackendAccount[])
      : [];

  const statusConnections: PlaidConnection[] = statusList
    .filter((status) => status.is_connected)
    .map((status) => {
      const statusConnectionId = status.connection_id != null ? String(status.connection_id) : null;
      const connectionAccounts = typedAccounts
        .filter((account) => resolveConnectionId(account) === statusConnectionId)
        .map(mapAccount);
      const connectionId = statusConnectionId ?? 'unknown';

      return {
        id: connectionId,
        connectionId,
        institutionName: status.institution_name || 'Unknown Bank',
        lastSyncAt: status.last_sync_at ?? null,
        transactionCount: status.transaction_count ?? 0,
        accountCount: status.account_count ?? connectionAccounts.length,
        syncInProgress: status.sync_in_progress ?? false,
        isConnected: status.is_connected,
        accounts: connectionAccounts,
      };
    });
  const mapped =
    statusConnections.length > 0 ? statusConnections : buildFallbackConnections(typedAccounts);

  if (hadLoadFailure && mapped.length === 0) {
    throw new Error('Failed to load Teller connections');
  }

  return mapped;
};

const analyzeConnections = (connections: PlaidConnection[]): LoadResult => {
  return {
    hasPopulatedBalances: connections.some((conn) =>
      conn.accounts.some((acc) => typeof acc.balance === 'number' && !Number.isNaN(acc.balance))
    ),
    connectionIds: connections.map((conn) => conn.connectionId).filter(Boolean),
  };
};

export function useTellerLinkFlow(options: UseTellerLinkFlowOptions): UseTellerLinkFlowResult {
  const {
    applicationId,
    environment = 'development',
    onError,
    enabled = true,
    isOnline = true,
  } = options;

  const queryClient = useQueryClient();
  const connectionsQuery = useQuery<PlaidConnection[], Error>({
    queryKey: ['teller', 'connections'],
    queryFn: buildTellerConnections,
    enabled: enabled && isOnline && !!applicationId,
    staleTime: 5 * 60 * 1000,
  });
  const connections = connectionsQuery.data ?? [];
  const loading = enabled && isOnline && applicationId ? connectionsQuery.isPending : false;
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const retryTimeoutRef = useRef<number | null>(null);
  const retryAttemptsRef = useRef(0);
  const hasTriggeredFollowupSyncRef = useRef(false);
  const [tellerConnectNonce, setTellerConnectNonce] = useState(0);
  const tellerSdkRef = useRef<TellerConnectSdkHandle>(null);
  const tellerSdkFailedRef = useRef(false);

  const handleError = useCallback(
    (message: string) => {
      if (enabled && isOnline) {
        setError(message);
        onError?.(message);
      }
    },
    [enabled, onError, isOnline]
  );

  const clearError = useCallback(() => {
    if (enabled) {
      setError(null);
      onError?.(null);
    }
  }, [enabled, onError]);

  const invalidateTellerCache = useCallback(
    (options?: InvalidateStaleCacheOptions) => {
      return invalidateStaleCacheQueries(queryClient, ['teller'], options);
    },
    [queryClient]
  );

  const loadConnectionsWithRetry = useCallback(async () => {
    const result = await connectionsQuery.refetch();
    const effectiveConnections = result.data ?? connectionsQuery.data ?? [];
    const { hasPopulatedBalances, connectionIds } = analyzeConnections(effectiveConnections);
    if (retryTimeoutRef.current) {
      window.clearTimeout(retryTimeoutRef.current);
    }
    if (!hasPopulatedBalances && connectionIds.length > 0 && !hasTriggeredFollowupSyncRef.current) {
      hasTriggeredFollowupSyncRef.current = true;
      try {
        await Promise.all(connectionIds.map((id) => TellerService.syncTransactions(id)));
        await invalidateStaleCacheQueries(queryClient, ['teller']);
      } catch (err) {
        console.warn('Follow-up Teller sync failed', err);
      }
    } else if (effectiveConnections.length > 0) {
      await invalidateTellerCache();
    }
    if (hasPopulatedBalances || retryAttemptsRef.current >= 5) {
      retryAttemptsRef.current = 0;
      hasTriggeredFollowupSyncRef.current = false;
      retryTimeoutRef.current = null;
      return;
    }
    retryAttemptsRef.current += 1;
    retryTimeoutRef.current = window.setTimeout(() => {
      retryTimeoutRef.current = null;
      void loadConnectionsWithRetry();
    }, 1500);
  }, [connectionsQuery, queryClient, invalidateTellerCache]);

  const onEnrollmentConnected = useCallback(
    async ({ connectionId }: { connectionId: string }) => {
      try {
        await TellerService.syncTransactions(connectionId);
      } catch (err) {
        console.warn('Initial Teller sync failed after enrollment', err);
      }
      await loadConnectionsWithRetry();
      dispatchAccountsChanged();
    },
    [loadConnectionsWithRetry]
  );

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      clearError();
      return;
    }
    if (!isOnline) {
      clearError();
      return;
    }
    if (!applicationId) {
      handleError('Missing Teller application ID');
      return;
    }
    clearError();
  }, [applicationId, clearError, enabled, handleError, isOnline]);

  const tellerApplicationIdForSdk =
    enabled && isOnline && tellerConnectNonce > 0 && applicationId ? applicationId : '';

  const onScriptLoadFailed = useCallback(() => {
    tellerSdkFailedRef.current = true;
    handleError(TELLER_CONNECT_LOAD_FAILED_MESSAGE);
  }, [handleError]);

  const onEnrollmentError = useCallback(
    async (err: unknown) => {
      if (!enabled) {
        return;
      }
      handleError(
        err instanceof Error && err.message.includes('did not finish loading')
          ? TELLER_CONNECT_LOAD_FAILED_MESSAGE
          : err instanceof Error
            ? err.message
            : 'Failed to complete bank connection'
      );
    },
    [enabled, handleError]
  );

  const tellerConnectMount = enabled
    ? createElement(TellerConnectSdk, {
        key: `${tellerConnectNonce}:${applicationId}:${environment}`,
        ref: tellerSdkRef,
        applicationId: tellerApplicationIdForSdk,
        environment,
        retryKey: tellerConnectNonce,
        onConnected: enabled && isOnline ? onEnrollmentConnected : undefined,
        onEnrollmentError,
        onScriptLoadFailed,
      })
    : null;

  const waitForTellerReady = useCallback(async (timeoutMs: number) => {
    await new Promise((r) => setTimeout(r, 0));
    const start = performance.now();
    while (performance.now() - start < timeoutMs) {
      if (tellerSdkFailedRef.current) {
        return false;
      }
      if (tellerSdkRef.current?.getReady()) {
        return true;
      }
      await new Promise((r) => setTimeout(r, 32));
    }
    return false;
  }, []);

  const connect = useCallback(async () => {
    clearError();
    if (!enabled || !isOnline) {
      return;
    }

    if (!applicationId) {
      handleError('Missing Teller application ID');
      return;
    }

    tellerSdkFailedRef.current = false;
    flushSync(() => {
      setTellerConnectNonce((s) => s + 1);
    });

    const becameReady = await waitForTellerReady(60_000);
    if (!becameReady) {
      handleError(TELLER_CONNECT_LOAD_FAILED_MESSAGE);
      return;
    }

    try {
      tellerSdkRef.current?.open();
    } catch (error) {
      console.warn('Failed to open Teller Connect', error);
      handleError(POPUP_BLOCKED_MESSAGE);
    }
  }, [applicationId, clearError, handleError, enabled, isOnline, waitForTellerReady]);

  const syncOne = useCallback(
    async (connectionId: string) => {
      if (!enabled || !isOnline) {
        return;
      }

      clearError();
      try {
        await TellerService.syncTransactions(connectionId);
        await invalidateTellerCache({ resetTransactions: 'reset' });
        setToast('Sync started for Teller connection');
      } catch (err) {
        console.warn('Failed to sync Teller connection', err);
        handleError('Failed to sync Teller connection');
      }
    },
    [clearError, enabled, handleError, invalidateTellerCache, isOnline]
  );

  const syncAll = useCallback(async () => {
    if (!enabled || !isOnline) {
      return;
    }

    clearError();
    setSyncingAll(true);
    try {
      const ids = connections
        .map((connection) => connection.connectionId)
        .filter((id): id is string => Boolean(id));

      if (ids.length === 0) {
        setToast('No Teller connections to sync');
        return;
      }

      await Promise.all(ids.map((id) => TellerService.syncTransactions(id)));
      await invalidateTellerCache({ resetTransactions: 'reset' });
      setToast('Sync started for all Teller connections');
    } catch (err) {
      console.warn('Failed to sync Teller connections', err);
      handleError('Failed to sync Teller connections');
    } finally {
      setSyncingAll(false);
    }
  }, [clearError, connections, enabled, handleError, invalidateTellerCache, isOnline]);

  const disconnect = useCallback(
    async (connectionId: string) => {
      if (!enabled || !isOnline) {
        return;
      }

      clearError();
      try {
        await TellerService.disconnect(connectionId);
        await invalidateTellerCache({ resetTransactions: 'remove' });
        setToast('Disconnected Teller connection');
      } catch (err) {
        console.warn('Failed to disconnect Teller connection', err);
        handleError('Failed to disconnect Teller connection');
      }
    },
    [clearError, enabled, handleError, invalidateTellerCache, isOnline]
  );

  return {
    connections,
    loading,
    error:
      error ??
      connectionsQuery.error?.message ??
      (!applicationId && enabled && isOnline ? 'Missing Teller application ID' : null),
    toast,
    setToast,
    connect,
    syncOne,
    syncAll,
    disconnect,
    syncingAll,
    tellerConnectMount,
  };
}
