import { useCallback, useEffect, useMemo } from 'react';
import { formatSimpleFinInstitutionsLabel } from '@/features/simplefin/utils/formatSimpleFinInstitutionsLabel';
import { connectionActions } from '@/hooks/financialConnection/connectionState';
import { recordHandledIssue } from '@/observability';
import { SimpleFinService } from '@/services/SimpleFinService';
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

  const submitSetupToken = useCallback(
    async (token: string) => {
      dispatch(
        connectionActions.patch({ connectionInProgress: true, error: null, isSyncing: true })
      );
      try {
        const connectResult = await SimpleFinService.submitSetupToken(token);
        const connectionId = connectResult.connection_id;

        if (connectionId) {
          try {
            await SimpleFinService.syncTransactions(connectionId);
          } catch (syncError) {
            recordHandledIssue(
              'financial-connection.simplefin.sync-transactions',
              'Failed to sync transactions during connection',
              syncError,
              { provider: 'simplefin', connection_id: connectionId }
            );
          }

          const statuses = await SimpleFinService.getStatus();
          const connected = statuses.filter((status) => status.is_connected);
          for (const status of connected) {
            if (status.connection_id) {
              try {
                await SimpleFinService.syncTransactions(status.connection_id);
              } catch (syncError) {
                recordHandledIssue(
                  'financial-connection.simplefin.sync-transactions',
                  'Failed to sync SimpleFIN institution during connection',
                  syncError,
                  { provider: 'simplefin', connection_id: status.connection_id }
                );
              }
            }
          }
        }

        const latest = await refreshStatus();
        if (!latest) {
          handleError('Connected institutions not found. Please try again.');
          dispatch(connectionActions.patch({ isConnected: false }));
        } else {
          await invalidateCache();
        }
      } catch (connectError) {
        const message =
          connectError instanceof Error
            ? connectError.message
            : 'Failed to connect with SimpleFIN setup token';
        handleError(message);
      } finally {
        dispatch(connectionActions.patch({ isSyncing: false, connectionInProgress: false }));
      }
    },
    [dispatch, handleError, invalidateCache, refreshStatus]
  );

  return useMemo(
    () => ({
      getReady: () => true,
      open: () => {},
      load: async () => {},
      reset: () => {},
      loadFailedMessage: '',
      render: () => null,
      submitSetupToken,
    }),
    [submitSetupToken]
  );
}
