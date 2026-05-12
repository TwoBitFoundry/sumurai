import { createElement, useCallback, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { PlaidLinkSdk, type PlaidLinkSdkHandle } from '@/features/plaid/components/PlaidLinkSdk';
import { PlaidService } from '@/services/PlaidService';
import { PLAID_LINK_LOAD_FAILED_MESSAGE, POPUP_BLOCKED_MESSAGE } from '@/utils/popupBlockedMessage';

export interface UseOnboardingPlaidFlowOptions {
  onConnectionSuccess?: (institutionName: string) => void;
  onError?: (error: string) => void;
  isOnline?: boolean;
}

export interface UseOnboardingPlaidFlowReturn {
  isConnected: boolean;
  connectionInProgress: boolean;
  isSyncing: boolean;
  institutionName: string | null;
  error: string | null;
  initiateConnection: () => Promise<void>;
  handlePlaidSuccess: (publicToken: string) => Promise<void>;
  retryConnection: () => Promise<void>;
  reset: () => void;
  setError: (error: string | null) => void;
  plaidLinkMount: ReturnType<typeof createElement> | null;
}

export function useOnboardingPlaidFlow(
  options: UseOnboardingPlaidFlowOptions = {}
): UseOnboardingPlaidFlowReturn {
  const { onConnectionSuccess, onError, isOnline = true } = options;

  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionInProgress, setConnectionInProgress] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [institutionName, setInstitutionName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plaidSdkNonce, setPlaidSdkNonce] = useState(0);

  const plaidSdkRef = useRef<PlaidLinkSdkHandle>(null);
  const plaidSdkFailedRef = useRef(false);

  const handleError = useCallback(
    (errorMessage: string) => {
      setError(errorMessage);
      setConnectionInProgress(false);
      onError?.(errorMessage);
    },
    [onError]
  );

  const handleSuccess = useCallback(
    async (publicToken: string) => {
      setConnectionInProgress(true);
      setError(null);

      try {
        const exchange = await PlaidService.exchangeToken(publicToken);

        setIsConnected(true);
        setInstitutionName(exchange.institution_name ?? 'Connected Bank');
        onConnectionSuccess?.(exchange.institution_name ?? 'Connected Bank');

        let connectionId: string | null = exchange.connection_id ?? null;
        try {
          const status = await PlaidService.getStatus();
          const connections = Array.isArray(status?.connections) ? status.connections : [];
          const latestConnection = connections.find((conn) => conn.is_connected) ?? connections[0];
          if (latestConnection) {
            setInstitutionName(latestConnection.institution_name || 'Connected Bank');
            connectionId = connectionId ?? latestConnection.connection_id;
          }
        } catch (statusError) {
          console.warn('Failed to refresh Plaid status after connection', statusError);
        }

        if (connectionId) {
          setIsSyncing(true);
          try {
            await PlaidService.syncTransactions(connectionId);
          } catch (syncError) {
            console.warn('Failed to sync transactions during onboarding', syncError);
          } finally {
            setIsSyncing(false);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Connection failed';
        handleError(errorMessage);
      } finally {
        setConnectionInProgress(false);
      }
    },
    [handleError, onConnectionSuccess]
  );

  const onPlaidScriptLoadFailed = useCallback(() => {
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

  const getLinkToken = useCallback(async () => {
    if (!isOnline) {
      throw new Error('Unavailable while offline');
    }

    try {
      setError(null);
      const response = await PlaidService.getLinkToken();
      return response.link_token;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get link token';
      handleError(errorMessage);
      throw error;
    }
  }, [handleError, isOnline]);

  const initiateConnection = useCallback(async () => {
    if (!isOnline) {
      return;
    }

    try {
      setConnectionInProgress(true);
      plaidSdkFailedRef.current = false;
      flushSync(() => {
        setPlaidSdkNonce((n) => n + 1);
        setLinkToken(null);
      });
      const token = await getLinkToken();
      flushSync(() => {
        setLinkToken(token);
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
    } catch {
      setConnectionInProgress(false);
    }
  }, [getLinkToken, handleError, isOnline, waitForPlaidReady]);

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
    setLinkToken(null);
    setPlaidSdkNonce(0);
  }, []);

  const handlePlaidSuccess = useCallback(
    async (publicToken: string) => {
      await handleSuccess(publicToken);
    },
    [handleSuccess]
  );

  const plaidLinkMount = linkToken
    ? createElement(PlaidLinkSdk, {
        key: plaidSdkNonce,
        ref: plaidSdkRef,
        token: linkToken,
        onSuccess: handleSuccess,
        onExit: (err) => {
          setConnectionInProgress(false);
          if (err) {
            handleError(POPUP_BLOCKED_MESSAGE);
          }
        },
        onScriptLoadFailed: onPlaidScriptLoadFailed,
      })
    : null;

  return {
    isConnected,
    connectionInProgress,
    isSyncing,
    institutionName,
    error,
    initiateConnection,
    handlePlaidSuccess,
    retryConnection,
    reset,
    setError,
    plaidLinkMount,
  };
}
