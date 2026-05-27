/**
 * Teller-specific link, sync, and cache refresh behavior.
 */

import { createElement, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  TellerConnectSdk,
  type TellerConnectSdkHandle,
} from '@/features/teller/components/TellerConnectSdk';
import { connectionActions } from '@/hooks/financialConnection/connectionState';
import { recordHandledIssue } from '@/observability';
import { TellerService } from '@/services/TellerService';
import { dispatchAccountsChanged } from '@/utils/events';
import {
  POPUP_BLOCKED_MESSAGE,
  TELLER_CONNECT_LOAD_FAILED_MESSAGE,
} from '@/utils/popupBlockedMessage';
import type { FinancialConnectionStrategy, FinancialConnectionStrategyContext } from './types';

const DEFAULT_INSTITUTION_NAME = 'Connected Bank';

export function useTellerConnectionStrategy(
  context: FinancialConnectionStrategyContext
): FinancialConnectionStrategy {
  const {
    isOnline,
    sdkNonce,
    setSdkNonce,
    setReady,
    sdkFailedRef,
    dispatch,
    handleError,
    onConnectionSuccess,
    invalidateCache,
    tellerApplicationId,
    tellerEnvironment,
  } = context;

  const sdkRef = useRef<TellerConnectSdkHandle>(null);

  const rearmSdk = useCallback(() => {
    setReady(false);
    setSdkNonce((value) => value + 1);
  }, [setReady, setSdkNonce]);

  const refreshStatus = useCallback(async () => {
    if (!isOnline) {
      return null;
    }

    try {
      const statuses = await TellerService.getStatus();
      const latest = statuses.find((status) => status.is_connected);

      if (latest) {
        const name = latest.institution_name || DEFAULT_INSTITUTION_NAME;
        dispatch(connectionActions.patch({ isConnected: true, institutionName: name }));
        onConnectionSuccess?.(name);
        return latest;
      }
    } catch (statusError) {
      recordHandledIssue(
        'financial-connection.teller.refresh-status',
        'Failed to load Teller connection status',
        statusError,
        { provider: 'teller' }
      );
    }

    return null;
  }, [dispatch, isOnline, onConnectionSuccess]);

  useEffect(() => {
    if (!isOnline || !tellerApplicationId) {
      setReady(false);
    }
  }, [isOnline, tellerApplicationId, setReady]);

  useEffect(() => {
    let isMounted = true;
    const loadExistingConnection = async () => {
      try {
        const latest = await refreshStatus();
        if (!latest && isMounted) {
          dispatch(connectionActions.patch({ isConnected: false, institutionName: null }));
        }
      } catch (err) {
        recordHandledIssue(
          'financial-connection.teller.load-onboarding-status',
          'Unable to load Teller onboarding status',
          err,
          { provider: 'teller' }
        );
      }
    };

    void loadExistingConnection();

    return () => {
      isMounted = false;
    };
  }, [dispatch, refreshStatus]);

  const onConnected = useCallback(
    async ({
      connectionId,
      institutionName,
    }: {
      connectionId: string;
      institutionName: string;
    }) => {
      dispatch(connectionActions.patch({ isSyncing: true, error: null }));
      try {
        let resolvedInstitutionName = institutionName || DEFAULT_INSTITUTION_NAME;
        dispatch(
          connectionActions.patch({
            isConnected: true,
            institutionName: resolvedInstitutionName,
          })
        );

        try {
          await TellerService.syncTransactions(connectionId);
        } catch (syncError) {
          recordHandledIssue(
            'financial-connection.teller.sync-transactions',
            'Failed to sync transactions during connection',
            syncError,
            { provider: 'teller', connection_id: connectionId }
          );
        }

        const latest = await refreshStatus();
        if (latest) {
          resolvedInstitutionName = latest.institution_name || resolvedInstitutionName;
          dispatch(connectionActions.patch({ institutionName: resolvedInstitutionName }));
        }

        onConnectionSuccess?.(resolvedInstitutionName);
        await invalidateCache();
        dispatchAccountsChanged();
      } finally {
        dispatch(connectionActions.patch({ isSyncing: false, connectionInProgress: false }));
        rearmSdk();
      }
    },
    [dispatch, invalidateCache, onConnectionSuccess, rearmSdk, refreshStatus]
  );

  const onExit = useCallback(() => {
    dispatch(connectionActions.patch({ connectionInProgress: false }));
    rearmSdk();
  }, [dispatch, rearmSdk]);

  const onEnrollmentError = useCallback(
    (error?: unknown) => {
      rearmSdk();
      const message =
        error instanceof Error && error.message.includes('did not finish loading')
          ? TELLER_CONNECT_LOAD_FAILED_MESSAGE
          : POPUP_BLOCKED_MESSAGE;
      handleError(message);
    },
    [handleError, rearmSdk]
  );

  const onScriptLoadFailed = useCallback(() => {
    sdkFailedRef.current = true;
    setReady(false);
    handleError(TELLER_CONNECT_LOAD_FAILED_MESSAGE);
  }, [handleError, sdkFailedRef, setReady]);

  return useMemo(
    () => ({
      getReady: () => sdkRef.current?.getReady() ?? false,
      open: () => sdkRef.current?.open(),
      load: async () => {
        if (!tellerApplicationId) {
          throw new Error('Missing Teller application ID');
        }
      },
      reset: () => {},
      loadFailedMessage: TELLER_CONNECT_LOAD_FAILED_MESSAGE,
      render: () => {
        if (!tellerApplicationId) {
          setReady(false);
          return null;
        }
        const applicationIdForSdk = isOnline ? tellerApplicationId : '';
        return createElement(TellerConnectSdk, {
          key: `${sdkNonce}:${tellerApplicationId}:${tellerEnvironment}`,
          ref: sdkRef,
          applicationId: applicationIdForSdk,
          environment: tellerEnvironment,
          retryKey: sdkNonce,
          onReady: () => setReady(true),
          onConnected,
          onExit,
          onEnrollmentError,
          onScriptLoadFailed,
        });
      },
    }),
    [
      onConnected,
      onEnrollmentError,
      onExit,
      onScriptLoadFailed,
      isOnline,
      sdkNonce,
      tellerApplicationId,
      tellerEnvironment,
      setReady,
    ]
  );
}
