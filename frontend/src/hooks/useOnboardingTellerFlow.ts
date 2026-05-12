import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  TellerConnectSdk,
  type TellerConnectSdkHandle,
} from '@/features/teller/components/TellerConnectSdk';
import { type TellerEnvironment } from '@/features/teller/tellerConnectScript';
import { TellerService } from '@/services/TellerService';
import {
  POPUP_BLOCKED_MESSAGE,
  TELLER_CONNECT_LOAD_FAILED_MESSAGE,
} from '@/utils/popupBlockedMessage';

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
  tellerConnectMount: ReturnType<typeof createElement> | null;
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
  const [tellerConnectNonce, setTellerConnectNonce] = useState(0);

  const tellerSdkRef = useRef<TellerConnectSdkHandle>(null);
  const tellerSdkFailedRef = useRef(false);

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

  const tellerApplicationIdForSdk =
    enabled && tellerConnectNonce > 0 && applicationId ? applicationId : '';

  const onScriptLoadFailed = useCallback(() => {
    tellerSdkFailedRef.current = true;
    handleError(TELLER_CONNECT_LOAD_FAILED_MESSAGE);
  }, [handleError]);

  const onEnrollmentError = useCallback(
    async (_err: unknown) => {
      if (!enabled) {
        return;
      }
      handleError(POPUP_BLOCKED_MESSAGE);
    },
    [enabled, handleError]
  );

  const onTellerConnected = useCallback(async () => {
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
  }, [enabled, handleError, refreshStatus]);

  const onTellerExit = useCallback(async () => {
    if (!enabled) {
      return;
    }
    setConnectionInProgress(false);
  }, [enabled]);

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

    setConnectionInProgress(true);

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
    setTellerConnectNonce(0);
  }, [enabled]);

  const tellerConnectMount = enabled
    ? createElement(TellerConnectSdk, {
        key: tellerConnectNonce,
        ref: tellerSdkRef,
        applicationId: tellerApplicationIdForSdk,
        environment,
        retryKey: tellerConnectNonce,
        onConnected: onTellerConnected,
        onExit: onTellerExit,
        onEnrollmentError,
        onScriptLoadFailed,
      })
    : null;

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
    tellerConnectMount,
  };
}
