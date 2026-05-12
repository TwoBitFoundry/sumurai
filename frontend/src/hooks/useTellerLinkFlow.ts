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
import { ProviderCatalog } from '../services/ProviderCatalog';
import { TellerService } from '../services/TellerService';
import { dispatchAccountsChanged } from '../utils/events';
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

export function useTellerLinkFlow(options: UseTellerLinkFlowOptions): UseTellerLinkFlowResult {
  const {
    applicationId,
    environment = 'development',
    onError,
    enabled = true,
    isOnline = true,
  } = options;

  const [connections, setConnections] = useState<PlaidConnection[]>([]);
  const [loading, setLoading] = useState(false);
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

  const loadConnections = useCallback(async (): Promise<LoadResult> => {
    if (!enabled || !isOnline) {
      return { hasPopulatedBalances: false, connectionIds: [] };
    }

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

    setLoading(true);
    clearError();
    try {
      const [statusResult, accountsResult] = await Promise.allSettled([
        TellerService.getStatus(),
        ProviderCatalog.getAccounts(),
      ]);
      const hadLoadFailure =
        statusResult.status === 'rejected' || accountsResult.status === 'rejected';
      const statusList =
        statusResult.status === 'fulfilled' && Array.isArray(statusResult.value)
          ? statusResult.value
          : [];
      const typedAccounts =
        accountsResult.status === 'fulfilled' && Array.isArray(accountsResult.value)
          ? (accountsResult.value as BackendAccount[])
          : [];

      const mapAccountType = (
        value: string | null | undefined
      ): PlaidConnection['accounts'][number]['type'] => {
        const normalized = (value ?? '').toLowerCase();
        if (normalized.includes('savings')) return 'savings';
        if (normalized.includes('credit')) return 'credit';
        if (normalized.includes('loan')) return 'loan';
        if (normalized.includes('depository') || normalized.includes('checking')) return 'checking';
        return 'other';
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
          type: mapAccountType(
            account.account_type ?? account.type ?? account.accountType ?? account.subtype ?? null
          ),
          balance: ledger ?? undefined,
          transactions: txnCount ?? undefined,
        };
      };

      const buildFallbackConnections = (): PlaidConnection[] => {
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

      const statusConnections: PlaidConnection[] = statusList
        .filter((status) => status.is_connected)
        .map((status) => {
          const statusConnectionId =
            status.connection_id != null ? String(status.connection_id) : null;

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
      const mapped: PlaidConnection[] =
        statusConnections.length > 0 ? statusConnections : buildFallbackConnections();

      let effectiveConnections: PlaidConnection[] = [];
      setConnections((prev) => {
        effectiveConnections = mapped.length > 0 ? mapped : prev;
        return effectiveConnections;
      });
      if (mapped.length > 0) {
        dispatchAccountsChanged();
      }

      setError(
        hadLoadFailure && effectiveConnections.length > 0 ? 'Failed to load connections' : null
      );

      const connectionIds = effectiveConnections.map((conn) => conn.connectionId).filter(Boolean);
      const hasBalances = effectiveConnections.some((conn) =>
        conn.accounts.some((acc) => typeof acc.balance === 'number' && !Number.isNaN(acc.balance))
      );
      return { hasPopulatedBalances: hasBalances, connectionIds };
    } catch (error: unknown) {
      console.warn('Failed to load Teller connections', error);
      let effectiveConnections: PlaidConnection[] = [];
      setConnections((prev) => {
        effectiveConnections = prev;
        return prev;
      });
      if (effectiveConnections.length > 0) {
        handleError('Failed to load Teller connections');
      }
      return {
        hasPopulatedBalances: effectiveConnections.some((conn) =>
          conn.accounts.some((acc) => typeof acc.balance === 'number' && !Number.isNaN(acc.balance))
        ),
        connectionIds: effectiveConnections.map((conn) => conn.connectionId).filter(Boolean),
      };
    } finally {
      setLoading(false);
    }
  }, [clearError, enabled, handleError, isOnline]);

  const loadConnectionsWithRetry = useCallback(async () => {
    const { hasPopulatedBalances, connectionIds } = await loadConnections();
    if (retryTimeoutRef.current) {
      window.clearTimeout(retryTimeoutRef.current);
    }
    if (!hasPopulatedBalances && connectionIds.length > 0 && !hasTriggeredFollowupSyncRef.current) {
      hasTriggeredFollowupSyncRef.current = true;
      try {
        await Promise.all(connectionIds.map((id) => TellerService.syncTransactions(id)));
      } catch (err) {
        console.warn('Follow-up Teller sync failed', err);
      }
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
  }, [loadConnections]);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []);

  const tellerApplicationIdForSdk =
    enabled && tellerConnectNonce > 0 && applicationId ? applicationId : '';

  const onScriptLoadFailed = useCallback(() => {
    tellerSdkFailedRef.current = true;
    handleError(TELLER_CONNECT_LOAD_FAILED_MESSAGE);
  }, [handleError]);

  const onEnrollmentError = useCallback(
    async (err: unknown) => {
      if (!enabled) {
        return;
      }
      handleError(err instanceof Error ? err.message : 'Failed to complete bank connection');
    },
    [enabled, handleError]
  );

  const tellerConnectMount = enabled
    ? createElement(TellerConnectSdk, {
        key: tellerConnectNonce,
        ref: tellerSdkRef,
        applicationId: tellerApplicationIdForSdk,
        environment,
        retryKey: tellerConnectNonce,
        onConnected: enabled && isOnline ? loadConnectionsWithRetry : undefined,
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

  useEffect(() => {
    if (!enabled) {
      setConnections([]);
      clearError();
      return;
    }
    if (!isOnline) {
      return;
    }
    if (!applicationId) {
      handleError('Missing Teller application ID');
      return;
    }
    loadConnections();
  }, [applicationId, enabled, loadConnections, handleError, clearError, isOnline]);

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
        await loadConnections();
        setToast('Sync started for Teller connection');
      } catch (err) {
        console.warn('Failed to sync Teller connection', err);
        handleError('Failed to sync Teller connection');
      }
    },
    [clearError, loadConnections, handleError, enabled, isOnline]
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
      await loadConnections();
      setToast('Sync started for all Teller connections');
    } catch (err) {
      console.warn('Failed to sync Teller connections', err);
      handleError('Failed to sync Teller connections');
    } finally {
      setSyncingAll(false);
    }
  }, [clearError, connections, loadConnections, handleError, enabled, isOnline]);

  const disconnect = useCallback(
    async (connectionId: string) => {
      if (!enabled || !isOnline) {
        return;
      }

      clearError();
      try {
        await TellerService.disconnect(connectionId);
        await loadConnections();
        setToast('Disconnected Teller connection');
      } catch (err) {
        console.warn('Failed to disconnect Teller connection', err);
        handleError('Failed to disconnect Teller connection');
      }
    },
    [clearError, loadConnections, handleError, enabled, isOnline]
  );

  return {
    connections,
    loading,
    error,
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
