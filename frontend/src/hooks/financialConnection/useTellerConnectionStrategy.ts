import { createElement, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  TellerConnectSdk,
  type TellerConnectSdkHandle,
} from '@/features/teller/components/TellerConnectSdk';
import { useTellerProviderInfo } from '@/hooks/useTellerProviderInfo';
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
    handleError,
    setConnectionInProgress,
    setIsConnected,
    setInstitutionName,
    setIsSyncing,
    setError,
    onConnectionSuccess,
    invalidateCache,
  } = context;

  const providerInfo = useTellerProviderInfo();
  const applicationId = providerInfo.tellerApplicationId;
  const environment = providerInfo.tellerEnvironment;
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
        setIsConnected(true);
        setInstitutionName(name);
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
  }, [isOnline, onConnectionSuccess, setInstitutionName, setIsConnected]);

  useEffect(() => {
    let isMounted = true;
    const loadExistingConnection = async () => {
      try {
        const latest = await refreshStatus();
        if (!latest && isMounted) {
          setIsConnected(false);
          setInstitutionName(null);
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
  }, [refreshStatus, setInstitutionName, setIsConnected]);

  const onConnected = useCallback(async () => {
    setIsSyncing(true);
    try {
      const latest = await refreshStatus();
      if (!latest) {
        handleError('Connected account not found. Please try again.');
        setIsConnected(false);
      } else {
        setError(null);
        await invalidateCache();
      }
    } finally {
      setIsSyncing(false);
      setConnectionInProgress(false);
    }
  }, [
    handleError,
    invalidateCache,
    refreshStatus,
    setConnectionInProgress,
    setError,
    setIsConnected,
    setIsSyncing,
  ]);

  const onExit = useCallback(() => {
    setConnectionInProgress(false);
  }, [setConnectionInProgress]);

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
        if (!applicationId) {
          throw new Error('Missing Teller application ID');
        }
      },
      reset: () => {},
      loadFailedMessage: TELLER_CONNECT_LOAD_FAILED_MESSAGE,
      render: () => {
        if (!applicationId) {
          return null;
        }
        const applicationIdForSdk = sdkNonce > 0 ? applicationId : '';
        return createElement(TellerConnectSdk, {
          key: sdkNonce,
          ref: sdkRef,
          applicationId: applicationIdForSdk,
          environment,
          retryKey: sdkNonce,
          onConnected,
          onExit,
          onEnrollmentError,
          onScriptLoadFailed,
        });
      },
    }),
    [
      applicationId,
      environment,
      onConnected,
      onEnrollmentError,
      onExit,
      onScriptLoadFailed,
      sdkNonce,
    ]
  );
}
