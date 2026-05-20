import { useQueryClient } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { createElement, useCallback, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { FinancialConnectionStrategyBridge } from '@/hooks/financialConnection/FinancialConnectionStrategyBridge';
import {
  type FinancialConnectionStrategy,
  type FinancialConnectionStrategyContext,
  PENDING_CONNECTION_STRATEGY,
} from '@/hooks/financialConnection/types';
import { recordHandledIssue } from '@/observability';
import { POPUP_BLOCKED_MESSAGE } from '@/utils/popupBlockedMessage';
import { invalidateStaleCacheQueries, type SyncProvider } from '@/utils/queryInvalidation';

export interface UseFinancialConnectionOptions {
  provider: SyncProvider;
  onConnectionSuccess?: (institutionName: string) => void;
  onError?: (error: string) => void;
  isOnline?: boolean;
}

export interface UseFinancialConnectionReturn {
  isConnected: boolean;
  connectionInProgress: boolean;
  isSyncing: boolean;
  institutionName: string | null;
  error: string | null;
  initiateConnection: () => Promise<void>;
  retryConnection: () => Promise<void>;
  reset: () => void;
  setError: (error: string | null) => void;
  connectionMount: ReactElement | null;
}

export function useFinancialConnection(
  options: UseFinancialConnectionOptions
): UseFinancialConnectionReturn {
  const { provider, onConnectionSuccess, onError, isOnline = true } = options;
  const queryClient = useQueryClient();

  const [isConnected, setIsConnected] = useState(false);
  const [connectionInProgress, setConnectionInProgress] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [institutionName, setInstitutionName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sdkNonce, setSdkNonce] = useState(0);
  const sdkFailedRef = useRef(false);
  const strategyRef = useRef<FinancialConnectionStrategy>(PENDING_CONNECTION_STRATEGY);

  const handleError = useCallback(
    (message: string) => {
      setError(message);
      setConnectionInProgress(false);
      onError?.(message);
    },
    [onError]
  );

  const invalidateCache = useCallback(async () => {
    await invalidateStaleCacheQueries(queryClient, [provider]);
  }, [queryClient, provider]);

  const strategyContext = useMemo<FinancialConnectionStrategyContext>(
    () => ({
      isOnline,
      sdkNonce,
      setSdkNonce,
      sdkFailedRef,
      handleError,
      setConnectionInProgress,
      setIsConnected,
      setInstitutionName,
      setIsSyncing,
      setError,
      onConnectionSuccess,
      invalidateCache,
    }),
    [handleError, invalidateCache, isOnline, onConnectionSuccess, sdkNonce]
  );

  const connectionMount = useMemo(
    () =>
      createElement(FinancialConnectionStrategyBridge, {
        key: provider,
        provider,
        context: strategyContext,
        strategyRef,
      }),
    [provider, strategyContext]
  );

  const waitForSdkReady = useCallback(async (timeoutMs: number) => {
    await new Promise((r) => setTimeout(r, 0));
    const start = performance.now();
    while (performance.now() - start < timeoutMs) {
      if (sdkFailedRef.current) {
        return false;
      }
      if (strategyRef.current.getReady()) {
        return true;
      }
      await new Promise((r) => setTimeout(r, 32));
    }
    return false;
  }, []);

  const initiateConnection = useCallback(async () => {
    if (!isOnline) {
      return;
    }

    if (strategyRef.current === PENDING_CONNECTION_STRATEGY) {
      handleError('Connection is not ready. Please try again.');
      return;
    }

    setError(null);
    setConnectionInProgress(true);
    sdkFailedRef.current = false;

    try {
      flushSync(() => {
        setSdkNonce((n) => n + 1);
      });

      strategyRef.current.reset();
      await strategyRef.current.load();

      const becameReady = await waitForSdkReady(60_000);
      if (!becameReady) {
        handleError(strategyRef.current.loadFailedMessage);
        return;
      }

      try {
        strategyRef.current.open();
      } catch (err) {
        recordHandledIssue('financial-connection.open', `Failed to open ${provider}`, err, {
          provider,
        });
        handleError(POPUP_BLOCKED_MESSAGE);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : `Failed to connect with ${provider}`;
      handleError(errorMessage);
    }
  }, [handleError, isOnline, provider, waitForSdkReady]);

  const retryConnection = useCallback(async () => {
    if (!isOnline) {
      return;
    }
    setError(null);
    await initiateConnection();
  }, [initiateConnection, isOnline]);

  const reset = useCallback(() => {
    setIsConnected(false);
    setConnectionInProgress(false);
    setIsSyncing(false);
    setInstitutionName(null);
    setError(null);
    setSdkNonce(0);
    strategyRef.current.reset();
  }, []);

  return {
    isConnected,
    connectionInProgress,
    isSyncing,
    institutionName,
    error,
    initiateConnection,
    retryConnection,
    reset,
    setError,
    connectionMount,
  };
}
