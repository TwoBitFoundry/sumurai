import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { usePlaidLink } from 'react-plaid-link';
import { PlaidService } from '@/services/PlaidService';
import { POPUP_BLOCKED_MESSAGE } from '@/utils/popupBlockedMessage';

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

  const {
    open,
    ready,
    error: plaidLinkError,
  } = usePlaidLink({
    token: linkToken,
    onSuccess: handleSuccess,
    onExit: (err) => {
      setConnectionInProgress(false);
      if (err) {
        handleError(POPUP_BLOCKED_MESSAGE);
      }
    },
    onEvent: () => {},
  });

  const readyRef = useRef(ready);
  const openRef = useRef(open);
  readyRef.current = ready;
  openRef.current = open;

  useEffect(() => {
    if (plaidLinkError) {
      handleError(POPUP_BLOCKED_MESSAGE);
    }
  }, [handleError, plaidLinkError]);

  const waitForPlaidReady = useCallback(async (timeoutMs: number) => {
    await new Promise((r) => setTimeout(r, 0));
    const start = performance.now();
    while (performance.now() - start < timeoutMs) {
      if (readyRef.current) {
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
      setLinkToken(response.link_token);
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
      setLinkToken(null);
      await getLinkToken();
      flushSync(() => {});
      const becameReady = await waitForPlaidReady(60_000);
      if (!becameReady) {
        handleError('Plaid Link took too long to load. Please try again.');
        return;
      }
      try {
        openRef.current();
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
    setLinkToken(null);
    await initiateConnection();
  }, [initiateConnection, isOnline]);

  const reset = useCallback(() => {
    setIsConnected(false);
    setConnectionInProgress(false);
    setIsSyncing(false);
    setInstitutionName(null);
    setError(null);
    setLinkToken(null);
  }, []);

  const handlePlaidSuccess = useCallback(
    async (publicToken: string) => {
      await handleSuccess(publicToken);
    },
    [handleSuccess]
  );

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
  };
}
