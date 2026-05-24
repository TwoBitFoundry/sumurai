import { useCallback, useEffect, useMemo } from 'react';
import { formatSimpleFinAuthRequiredToast } from '@/features/simplefin/utils/formatSimpleFinAuthRequiredToast';
import { formatSimpleFinInstitutionsLabel } from '@/features/simplefin/utils/formatSimpleFinInstitutionsLabel';
import { connectionActions } from '@/hooks/financialConnection/connectionState';
import { recordHandledIssue } from '@/observability';
import { ValidationError } from '@/services/ApiClient';
import { SimpleFinService } from '@/services/SimpleFinService';
import type { SimpleFinInstitutionAuthRequired } from '@/types/api';
import { formatUserFacingApiError } from '@/utils/formatUserFacingApiError';
import type { FinancialConnectionStrategy, FinancialConnectionStrategyContext } from './types';

const DEFAULT_INSTITUTION_NAME = 'SimpleFIN';

export function useSimpleFinConnectionStrategy(
  context: FinancialConnectionStrategyContext
): FinancialConnectionStrategy {
  const {
    isOnline,
    dispatch,
    handleError,
    onConnectionSuccess,
    onSimpleFinAuthRequired,
    invalidateCache,
  } = context;

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

  const connect = useCallback(
    async (setupToken?: string) => {
      dispatch(
        connectionActions.patch({ connectionInProgress: true, error: null, isSyncing: true })
      );
      try {
        const result = await SimpleFinService.connectAndSyncAll(setupToken);
        dispatch(
          connectionActions.patch({
            isConnected: true,
            institutionName: DEFAULT_INSTITUTION_NAME,
            error: null,
          })
        );
        onConnectionSuccess?.(DEFAULT_INSTITUTION_NAME);
        if (result.institutionsRequiringAuth.length > 0) {
          onSimpleFinAuthRequired?.(result.institutionsRequiringAuth);
        }
        await refreshStatus();
        await invalidateCache();
      } catch (connectError) {
        if (
          connectError instanceof ValidationError &&
          connectError.details &&
          typeof connectError.details === 'object' &&
          'error' in connectError.details &&
          connectError.details.error === 'SIMPLEFIN_INSTITUTIONS_REQUIRE_AUTH'
        ) {
          const details = connectError.details as {
            error?: string;
            details?: SimpleFinInstitutionAuthRequired[];
          };
          if (Array.isArray(details.details) && details.details.length > 0) {
            onSimpleFinAuthRequired?.(details.details);
            dispatch(connectionActions.patch({ error: null }));
          } else {
            const message = formatUserFacingApiError(
              connectError,
              'Failed to connect with SimpleFIN'
            );
            handleError(message);
          }
        } else {
          const message = formatUserFacingApiError(
            connectError,
            'Failed to connect with SimpleFIN'
          );
          handleError(message);
        }
      } finally {
        dispatch(connectionActions.patch({ isSyncing: false, connectionInProgress: false }));
      }
    },
    [
      dispatch,
      handleError,
      invalidateCache,
      onConnectionSuccess,
      onSimpleFinAuthRequired,
      refreshStatus,
    ]
  );

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
