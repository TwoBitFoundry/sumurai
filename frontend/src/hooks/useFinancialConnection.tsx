/**
 * Orchestrates the bank-linking flow for whichever provider is active.
 */

import { useQueryClient } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import {
  createElement,
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import { ProviderSdkLaunchBackdrop } from '@/components/ProviderSdkLaunchBackdrop';
import {
  connectionActions,
  financialConnectionReducer,
  initialFinancialConnectionState,
} from '@/hooks/financialConnection/connectionState';
import { FinancialConnectionStrategyBridge } from '@/hooks/financialConnection/FinancialConnectionStrategyBridge';
import {
  type FinancialConnectionStrategy,
  type FinancialConnectionStrategyContext,
  PENDING_CONNECTION_STRATEGY,
} from '@/hooks/financialConnection/types';
import { useProviderCatalog } from '@/hooks/useProviderCatalog';
import { recordHandledIssue } from '@/observability';
import type { SimpleFinInstitutionAuthRequired } from '@/types/api';
import { POPUP_BLOCKED_MESSAGE } from '@/utils/popupBlockedMessage';
import {
  refreshFinancialDataAfterProviderChange,
  type SyncProvider,
} from '@/utils/queryInvalidation';

export interface UseFinancialConnectionOptions {
  provider: SyncProvider;
  onConnectionSuccess?: (institutionName: string) => void;
  onError?: (error: string) => void;
  onSimpleFinAuthRequired?: (institutions: SimpleFinInstitutionAuthRequired[]) => void;
  isOnline?: boolean;
}

export interface UseFinancialConnectionReturn {
  isReady: boolean;
  isConnected: boolean;
  connectionInProgress: boolean;
  isSyncing: boolean;
  institutionName: string | null;
  error: string | null;
  initiateConnection: (setupToken?: string) => Promise<void>;
  retryConnection: () => Promise<void>;
  reset: () => void;
  setError: (error: string | null) => void;
  connectionMount: ReactElement | null;
}

export function useFinancialConnection(
  options: UseFinancialConnectionOptions
): UseFinancialConnectionReturn {
  const {
    provider,
    onConnectionSuccess,
    onError,
    onSimpleFinAuthRequired,
    isOnline = true,
  } = options;
  const queryClient = useQueryClient();
  const providerCatalog = useProviderCatalog();

  const [state, dispatch] = useReducer(financialConnectionReducer, initialFinancialConnectionState);
  const [sdkNonce, setSdkNonce] = useState(0);
  const [isReady, setReady] = useState(provider === 'simplefin');
  const sdkFailedRef = useRef(false);
  const strategyRef = useRef<FinancialConnectionStrategy>(PENDING_CONNECTION_STRATEGY);
  useEffect(() => {
    setReady(provider === 'simplefin');
  }, [provider]);

  const handleError = useCallback(
    (message: string) => {
      dispatch(connectionActions.patch({ error: message, connectionInProgress: false }));
      onError?.(message);
    },
    [onError]
  );

  const setError = useCallback((error: string | null) => {
    dispatch(connectionActions.patch({ error }));
  }, []);

  const invalidateCache = useCallback(async () => {
    await refreshFinancialDataAfterProviderChange(queryClient, [provider]);
  }, [queryClient, provider]);

  const strategyContext = useMemo<FinancialConnectionStrategyContext>(
    () => ({
      isOnline,
      sdkNonce,
      setSdkNonce,
      setReady,
      sdkFailedRef,
      state,
      dispatch,
      handleError,
      onConnectionSuccess,
      onSimpleFinAuthRequired,
      invalidateCache,
      tellerApplicationId: providerCatalog.tellerApplicationId,
      tellerEnvironment: providerCatalog.tellerEnvironment,
    }),
    [
      handleError,
      invalidateCache,
      isOnline,
      onConnectionSuccess,
      onSimpleFinAuthRequired,
      providerCatalog.tellerApplicationId,
      providerCatalog.tellerEnvironment,
      sdkNonce,
      state,
    ]
  );

  const sdkLaunchBackdropActive =
    provider !== 'simplefin' && (state.connectionInProgress || state.isSyncing);

  const connectionMount = useMemo(() => {
    const bridge = createElement(FinancialConnectionStrategyBridge, {
      key: provider,
      provider,
      context: strategyContext,
      strategyRef,
    });

    if (provider === 'simplefin') {
      return bridge;
    }

    return createElement(Fragment, { key: `${provider}-connection` }, [
      createElement(ProviderSdkLaunchBackdrop, {
        key: 'sdk-launch-backdrop',
        active: sdkLaunchBackdropActive,
      }),
      bridge,
    ]);
  }, [provider, sdkLaunchBackdropActive, strategyContext]);

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

  const initiateConnection = useCallback(
    async (setupToken?: string) => {
      if (!isOnline) {
        return;
      }

      if (strategyRef.current === PENDING_CONNECTION_STRATEGY) {
        handleError('Connection is not ready. Please try again.');
        return;
      }

      dispatch(connectionActions.patch({ error: null, connectionInProgress: true }));
      sdkFailedRef.current = false;

      try {
        const connectConfigured = strategyRef.current.connect;
        if (connectConfigured) {
          try {
            await connectConfigured(setupToken);
          } catch (err) {
            const errorMessage =
              err instanceof Error ? err.message : `Failed to connect with ${provider}`;
            handleError(errorMessage);
          }
          return;
        }

        if (strategyRef.current.getReady()) {
          try {
            strategyRef.current.open();
          } catch (err) {
            recordHandledIssue('financial-connection.open', `Failed to open ${provider}`, err, {
              provider,
            });
            handleError(POPUP_BLOCKED_MESSAGE);
          }
          return;
        }

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
    },
    [handleError, isOnline, provider, waitForSdkReady]
  );

  const retryConnection = useCallback(async () => {
    if (!isOnline) {
      return;
    }
    dispatch(connectionActions.patch({ error: null }));
    await initiateConnection();
  }, [initiateConnection, isOnline]);

  const reset = useCallback(() => {
    dispatch(connectionActions.reset());
    setSdkNonce(0);
    strategyRef.current.reset();
  }, []);

  return {
    isReady,
    isConnected: state.isConnected,
    connectionInProgress: state.connectionInProgress,
    isSyncing: state.isSyncing,
    institutionName: state.institutionName,
    error: state.error,
    initiateConnection,
    retryConnection,
    reset,
    setError,
    connectionMount,
  };
}
