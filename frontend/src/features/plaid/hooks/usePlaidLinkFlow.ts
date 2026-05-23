/**
 * Plaid link flow used by the accounts experience.
 */

import { useQueryClient } from '@tanstack/react-query';
import { createElement, useCallback, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { PlaidLinkSdk, type PlaidLinkSdkHandle } from '@/features/plaid/components/PlaidLinkSdk';
import { PLAID_LINK_LOAD_FAILED_MESSAGE, POPUP_BLOCKED_MESSAGE } from '@/utils/popupBlockedMessage';
import { type PlaidConnection, usePlaidConnections } from '../../../hooks/usePlaidConnections';
import { useInstrumentedCallback } from '../../../observability';
import { ApiClient } from '../../../services/ApiClient';
import { PlaidService } from '../../../services/PlaidService';
import { invalidateStaleCacheQueries } from '../../../utils/queryInvalidation';

interface UsePlaidLinkFlowOptions {
  onError?: (message: string | null) => void;
  enabled?: boolean;
  isOnline?: boolean;
}

export interface UsePlaidLinkFlowResult {
  connections: PlaidConnection[];
  loading: boolean;
  error: string | null;
  toast: string | null;
  setToast: (next: string | null) => void;
  connect: (setupToken?: string) => Promise<void>;
  syncOne: (connectionId: string) => Promise<void>;
  syncAll: () => Promise<void>;
  disconnect: (connectionId: string) => Promise<void>;
  syncingAll: boolean;
  plaidLinkMount: ReturnType<typeof createElement> | null;
}

export function usePlaidLinkFlow(options: UsePlaidLinkFlowOptions = {}): UsePlaidLinkFlowResult {
  const { onError, enabled = true, isOnline = true } = options;
  const plaidConnections = usePlaidConnections({ enabled });
  const queryClient = useQueryClient();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [plaidSdkNonce, setPlaidSdkNonce] = useState(0);

  const plaidSdkRef = useRef<PlaidLinkSdkHandle>(null);
  const plaidSdkFailedRef = useRef(false);

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

  const invalidatePlaidCache = useCallback(() => {
    return invalidateStaleCacheQueries(queryClient, ['plaid']);
  }, [queryClient]);

  const handleSuccess = useInstrumentedCallback(
    'PlaidLink.onSuccess',
    async (publicToken: string) => {
      if (!enabled || !isOnline) return;

      try {
        clearError();
        const exchange = await PlaidService.exchangeToken(publicToken);
        const exchangedConnectionId = exchange.connection_id ?? null;

        const updatedConnections = await plaidConnections.refresh();

        const syncConnectionId =
          exchangedConnectionId ?? updatedConnections[0]?.connectionId ?? null;

        if (syncConnectionId) {
          const syncTarget =
            updatedConnections.find((c) => c.connectionId === syncConnectionId) ??
            updatedConnections[0];
          try {
            const result = await PlaidService.syncTransactions(syncConnectionId);
            const { transactions = [] } = result || {};
            const count = Array.isArray(transactions) ? transactions.length : 0;
            setToast(`Bank connected! Synced ${count} transactions`);
            await invalidatePlaidCache();
          } catch (syncError: unknown) {
            console.warn('Failed to sync transactions after connection', syncError);
            await invalidatePlaidCache();
            setToast(`Bank connected to ${syncTarget?.institutionName ?? 'your bank'}`);
          }
        } else {
          await invalidatePlaidCache();
          setToast('Bank connected successfully!');
        }
      } catch (error: unknown) {
        const message = `Failed to exchange token: ${error instanceof Error ? error.message : 'Unknown error'}`;
        handleError(message);
      }
    },
    [clearError, handleError, invalidatePlaidCache, plaidConnections, enabled, isOnline]
  );

  const handleExit = useCallback(
    (err: unknown) => {
      if (!enabled || !isOnline) return;
      if (err) {
        handleError(POPUP_BLOCKED_MESSAGE);
      }
    },
    [enabled, handleError, isOnline]
  );

  const onScriptLoadFailed = useCallback(() => {
    console.warn('Plaid Link script failed to load');
    plaidSdkFailedRef.current = true;
    handleError(PLAID_LINK_LOAD_FAILED_MESSAGE);
  }, [handleError]);

  const waitForPlaidReady = useCallback(async (timeoutMs: number) => {
    await new Promise((r) => setTimeout(r, 0));
    const start = performance.now();
    while (performance.now() - start < timeoutMs) {
      if (plaidSdkFailedRef.current) {
        return false;
      }
      if (plaidSdkRef.current?.getReady()) {
        return true;
      }
      await new Promise((r) => setTimeout(r, 32));
    }
    return false;
  }, []);

  const connect = useInstrumentedCallback('PlaidLink.connect', async () => {
    if (!enabled || !isOnline) return;
    clearError();

    try {
      plaidSdkFailedRef.current = false;
      flushSync(() => {
        setPlaidSdkNonce((n) => n + 1);
        setLinkToken(null);
      });
      const data = await ApiClient.post<{ link_token: string }>('/plaid/link-token', {});
      flushSync(() => {
        setLinkToken(data.link_token);
      });
      const becameReady = await waitForPlaidReady(60_000);
      if (!becameReady) {
        handleError(PLAID_LINK_LOAD_FAILED_MESSAGE);
        return;
      }
      try {
        plaidSdkRef.current?.open();
      } catch {
        handleError(POPUP_BLOCKED_MESSAGE);
      }
    } catch (error: unknown) {
      const message = `Failed to start bank connection: ${error instanceof Error ? error.message : 'Unknown error'}`;
      handleError(message);
      throw error;
    }
  }, [clearError, handleError, enabled, isOnline, waitForPlaidReady]);

  const syncOne = useInstrumentedCallback(
    'PlaidLink.syncOne',
    async (connectionId: string) => {
      if (!enabled || !isOnline) return;
      const connection = plaidConnections.getConnection(connectionId);
      if (!connection) return;

      clearError();
      plaidConnections.setConnectionSyncInProgress(connectionId, true);
      try {
        const result = await PlaidService.syncTransactions(connectionId);
        const { transactions = [] } = result || {};
        const count = Array.isArray(transactions) ? transactions.length : 0;
        setToast(`Synced ${count} new transactions from ${connection.institutionName}`);
        await invalidatePlaidCache();
      } catch (error: unknown) {
        const message = `Sync failed for ${connection.institutionName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        handleError(message);
        plaidConnections.setConnectionSyncInProgress(connectionId, false);
      }
    },
    [clearError, handleError, invalidatePlaidCache, plaidConnections, enabled, isOnline]
  );

  const syncAll = useInstrumentedCallback('PlaidLink.syncAll', async () => {
    if (!enabled || !isOnline) return;
    clearError();
    setSyncingAll(true);
    try {
      const tasks = plaidConnections.connections.map((conn) => syncOne(conn.connectionId));
      await Promise.all(tasks);
    } finally {
      setSyncingAll(false);
    }
  }, [clearError, plaidConnections, syncOne, enabled, isOnline]);

  const disconnect = useInstrumentedCallback(
    'PlaidLink.disconnect',
    async (connectionId: string) => {
      if (!enabled || !isOnline) return;
      const connection = plaidConnections.getConnection(connectionId);
      if (!connection) return;

      clearError();
      try {
        await PlaidService.disconnect(connectionId);
        setToast(`${connection.institutionName} disconnected successfully`);
        await invalidatePlaidCache();
      } catch (error: unknown) {
        const message = `Failed to disconnect ${connection.institutionName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        handleError(message);
      }
    },
    [clearError, handleError, invalidatePlaidCache, plaidConnections, enabled, isOnline]
  );

  const { connections, loading } = plaidConnections;
  const resolvedConnections = enabled ? connections : [];
  const resolvedLoading = enabled ? loading : false;
  const resolvedError = enabled ? error : null;
  const resolvedSyncingAll = enabled ? syncingAll : false;

  const plaidLinkMount =
    enabled && linkToken
      ? createElement(PlaidLinkSdk, {
          key: plaidSdkNonce,
          ref: plaidSdkRef,
          token: linkToken,
          onSuccess: handleSuccess,
          onExit: handleExit,
          onScriptLoadFailed: onScriptLoadFailed,
        })
      : null;

  return {
    connections: resolvedConnections,
    loading: resolvedLoading,
    error: resolvedError,
    toast,
    setToast,
    connect,
    syncOne,
    syncAll,
    disconnect,
    syncingAll: resolvedSyncingAll,
    plaidLinkMount,
  };
}
