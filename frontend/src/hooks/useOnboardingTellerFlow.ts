import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { type TellerEnvironment, useTellerConnect } from '@/hooks/useTellerConnect';
import { TellerService } from '@/services/TellerService';
import { POPUP_BLOCKED_MESSAGE } from '@/utils/popupBlockedMessage';

export interface UseOnboardingTellerFlowOptions {
  applicationId: string | null;
  environment?: TellerEnvironment;
  enabled?: boolean;
  isOnline?: boolean;
  onConnectionSuccess?: (institutionName: string) => void;
  onError?: (error: string) => void;
}

export interface UseOnboardingTellerFlowResult {
  isConnected: boolean;
  connectionInProgress: boolean;
  isSyncing: boolean;
  institutionName: string | null;
  error: string | null;
  initiateConnection: () => Promise<void>;
  retryConnection: () => Promise<void>;
  reset: () => void;
  setError: (value: string | null) => void;
}

const DEFAULT_INSTITUTION_NAME = 'Connected Bank';

export function useOnboardingTellerFlow(
  options: UseOnboardingTellerFlowOptions
): UseOnboardingTellerFlowResult {
  const {
    applicationId,
    environment = 'development',
    enabled = true,
    isOnline = true,
    onConnectionSuccess,
    onError,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionInProgress, setConnectionInProgress] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [institutionName, setInstitutionName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectSessionKey, setConnectSessionKey] = useState(0);

  const handleError = useCallback(
    (message: string) => {
      if (!enabled) {
        return;
      }
      setError(message);
      setConnectionInProgress(false);
      onError?.(message);
    },
    [enabled, onError]
  );

  const refreshStatus = useCallback(async () => {
    if (!enabled || !isOnline) {
      return null;
    }

    try {
      const statuses = await TellerService.getStatus();
      const latest = statuses.find((status) => status.is_connected);

      if (latest) {
        const name = latest.institution_name || DEFAULT_INSTITUTION_NAME;
        setIsConnected(true);
        setInstitutionName(name);
        onConnectionSuccess?.(name);
        return latest;
      }
    } catch (statusError) {
      console.warn('Failed to load Teller connection status', statusError);
    }

    return null;
  }, [enabled, isOnline, onConnectionSuccess]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let isMounted = true;
    const loadExistingConnection = async () => {
      try {
        const latest = await refreshStatus();
        if (!latest && isMounted) {
          setIsConnected(false);
          setInstitutionName(null);
        }
      } catch (err) {
        console.warn('Unable to load Teller onboarding status', err);
      }
    };

    void loadExistingConnection();

    return () => {
      isMounted = false;
    };
  }, [enabled, refreshStatus]);

  const tellerApplicationIdForConnect =
    enabled && connectSessionKey > 0 && applicationId ? applicationId : '';

  const { ready, open } = useTellerConnect({
    applicationId: tellerApplicationIdForConnect,
    environment,
    retryKey: connectSessionKey,
    onConnected: async () => {
      if (!enabled) {
        return;
      }

      setIsSyncing(true);
      try {
        const latest = await refreshStatus();
        if (!latest) {
          handleError('Connected account not found. Please try again.');
          setIsConnected(false);
        } else {
          setError(null);
        }
      } finally {
        setIsSyncing(false);
        setConnectionInProgress(false);
      }
    },
    onExit: async () => {
      if (!enabled) {
        return;
      }
      setConnectionInProgress(false);
    },
    onError: async (err) => {
      if (!enabled) {
        return;
      }
      console.warn('Teller Connect error during onboarding', err);
      handleError(POPUP_BLOCKED_MESSAGE);
    },
  });

  const readyRef = useRef(ready);
  const openRef = useRef(open);
  readyRef.current = ready;
  openRef.current = open;

  const waitForTellerReady = useCallback(async (timeoutMs: number) => {
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

  const initiateConnection = useCallback(async () => {
    if (!enabled) {
      return;
    }

    if (!isOnline) {
      return;
    }

    setError(null);

    if (!applicationId) {
      handleError('Missing Teller application ID');
      return;
    }

    flushSync(() => {
      setConnectSessionKey((s) => s + 1);
      setConnectionInProgress(true);
    });

    const becameReady = await waitForTellerReady(60_000);
    if (!becameReady) {
      handleError('Teller Connect took too long to load. Please try again.');
      return;
    }

    try {
      openRef.current();
    } catch (err) {
      console.warn('Failed to open Teller Connect', err);
      handleError(POPUP_BLOCKED_MESSAGE);
    }
  }, [applicationId, enabled, handleError, isOnline, waitForTellerReady]);

  const retryConnection = useCallback(async () => {
    if (!enabled || !isOnline) {
      return;
    }
    setError(null);
    await initiateConnection();
  }, [enabled, initiateConnection, isOnline]);

  const reset = useCallback(() => {
    if (!enabled) {
      return;
    }
    setIsConnected(false);
    setConnectionInProgress(false);
    setIsSyncing(false);
    setInstitutionName(null);
    setError(null);
    setConnectSessionKey(0);
  }, [enabled]);

  return useMemo(
    () => ({
      isConnected,
      connectionInProgress,
      isSyncing,
      institutionName,
      error,
      initiateConnection,
      retryConnection,
      reset,
      setError,
    }),
    [
      error,
      initiateConnection,
      isConnected,
      connectionInProgress,
      isSyncing,
      institutionName,
      retryConnection,
      reset,
    ]
  );
}
