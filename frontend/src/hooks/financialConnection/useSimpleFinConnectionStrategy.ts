import { useCallback, useEffect, useMemo } from 'react';
import { formatSimpleFinInstitutionsLabel } from '@/features/simplefin/utils/formatSimpleFinInstitutionsLabel';
import { connectionActions } from '@/hooks/financialConnection/connectionState';
import { recordHandledIssue } from '@/observability';
import { SimpleFinService } from '@/services/SimpleFinService';
import { formatUserFacingApiError } from '@/utils/formatUserFacingApiError';
import type { FinancialConnectionStrategy, FinancialConnectionStrategyContext } from './types';

const DEFAULT_INSTITUTION_NAME = 'SimpleFIN';

export function useSimpleFinConnectionStrategy(
  context: FinancialConnectionStrategyContext
): FinancialConnectionStrategy {
  const { isOnline, dispatch, handleError, onConnectionSuccess, invalidateCache } = context;

  const refreshStatus = useCallback(async () => {
    if (!isOnline) {
      return null;
    }

    try {
      const statuses = await SimpleFinService.getStatus();
      const connected = statuses.filter((status) => status.is_connected);

      if (connected.length > 0) {
        const name =
          connected.length === 1
            ? (connected[0].institution_name ?? DEFAULT_INSTITUTION_NAME)
            : formatSimpleFinInstitutionsLabel(connected.length);
        dispatch(connectionActions.patch({ isConnected: true, institutionName: name }));
        onConnectionSuccess?.(name);
        return connected[0];
      }
    } catch (statusError) {
      recordHandledIssue(
        'financial-connection.simplefin.refresh-status',
        'Failed to load SimpleFIN connection status',
        statusError,
        { provider: 'simplefin' }
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
          'financial-connection.simplefin.load-onboarding-status',
          'Unable to load SimpleFIN onboarding status',
          err,
          { provider: 'simplefin' }
        );
      }
    };

    void loadExistingConnection();

    return () => {
      isMounted = false;
    };
  }, [dispatch, refreshStatus]);

  const connect = useCallback(async () => {
    dispatch(connectionActions.patch({ connectionInProgress: true, error: null, isSyncing: true }));
    try {
      const { rateLimited } = await SimpleFinService.connectAndSyncAll();

      const latest = await refreshStatus();
      await invalidateCache();
      if (latest || rateLimited) {
        dispatch(connectionActions.patch({ error: null }));
      } else {
        dispatch(connectionActions.patch({ isConnected: false, institutionName: null }));
      }
    } catch (connectError) {
      const message = formatUserFacingApiError(connectError, 'Failed to connect with SimpleFIN');
      handleError(message);
    } finally {
      dispatch(connectionActions.patch({ isSyncing: false, connectionInProgress: false }));
    }
  }, [dispatch, handleError, invalidateCache, refreshStatus]);

  return useMemo(
    () => ({
      getReady: () => true,
      open: () => {},
      load: async () => {},
      reset: () => {},
      loadFailedMessage: '',
      render: () => null,
      connect,
    }),
    [connect]
  );
}
