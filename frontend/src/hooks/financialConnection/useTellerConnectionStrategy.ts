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
    sdkFailedRef,
    dispatch,
    handleError,
    onConnectionSuccess,
    invalidateCache,
    tellerApplicationId,
    tellerEnvironment,
  } = context;

  const sdkRef = useRef<TellerConnectSdkHandle>(null);

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
    async ({ connectionId }: { connectionId: string }) => {
      dispatch(connectionActions.patch({ isSyncing: true, error: null }));
      try {
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
        if (!latest) {
          handleError('Connected account not found. Please try again.');
          dispatch(connectionActions.patch({ isConnected: false }));
        } else {
          await invalidateCache();
        }
      } finally {
        dispatch(connectionActions.patch({ isSyncing: false, connectionInProgress: false }));
      }
    },
    [dispatch, handleError, invalidateCache, refreshStatus]
  );

  const onExit = useCallback(() => {
    dispatch(connectionActions.patch({ connectionInProgress: false }));
  }, [dispatch]);

  const onEnrollmentError = useCallback(() => {
    handleError(POPUP_BLOCKED_MESSAGE);
  }, [handleError]);

  const onScriptLoadFailed = useCallback(() => {
    sdkFailedRef.current = true;
    handleError(TELLER_CONNECT_LOAD_FAILED_MESSAGE);
  }, [handleError, sdkFailedRef]);

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
          return null;
        }
        const applicationIdForSdk = sdkNonce > 0 ? tellerApplicationId : '';
        return createElement(TellerConnectSdk, {
          key: sdkNonce,
          ref: sdkRef,
          applicationId: applicationIdForSdk,
          environment: tellerEnvironment,
          retryKey: sdkNonce,
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
      sdkNonce,
      tellerApplicationId,
      tellerEnvironment,
    ]
  );
}
