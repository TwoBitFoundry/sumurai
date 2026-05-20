/**
 * Plaid-specific link, exchange, sync, and cache refresh behavior.
 */

import { createElement, useCallback, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { PlaidLinkSdk, type PlaidLinkSdkHandle } from '@/features/plaid/components/PlaidLinkSdk';
import { connectionActions } from '@/hooks/financialConnection/connectionState';
import { recordHandledIssue } from '@/observability';
import { PlaidService } from '@/services/PlaidService';
import { PLAID_LINK_LOAD_FAILED_MESSAGE, POPUP_BLOCKED_MESSAGE } from '@/utils/popupBlockedMessage';
import type { FinancialConnectionStrategy, FinancialConnectionStrategyContext } from './types';

const DEFAULT_INSTITUTION_NAME = 'Connected Bank';

export function usePlaidConnectionStrategy(
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
  } = context;

  const [linkToken, setLinkToken] = useState<string | null>(null);
  const sdkRef = useRef<PlaidLinkSdkHandle>(null);

  const handleSuccess = useCallback(
    async (publicToken: string) => {
      dispatch(connectionActions.patch({ connectionInProgress: true, error: null }));

      try {
        const exchange = await PlaidService.exchangeToken(publicToken);

        dispatch(
          connectionActions.patch({
            isConnected: true,
            institutionName: exchange.institution_name ?? DEFAULT_INSTITUTION_NAME,
          })
        );
        onConnectionSuccess?.(exchange.institution_name ?? DEFAULT_INSTITUTION_NAME);

        let connectionId: string | null = exchange.connection_id ?? null;
        try {
          const status = await PlaidService.getStatus();
          const connections = Array.isArray(status?.connections) ? status.connections : [];
          const latestConnection = connections.find((conn) => conn.is_connected) ?? connections[0];
          if (latestConnection) {
            dispatch(
              connectionActions.patch({
                institutionName: latestConnection.institution_name || DEFAULT_INSTITUTION_NAME,
              })
            );
            connectionId = connectionId ?? latestConnection.connection_id;
          }
        } catch (statusError) {
          recordHandledIssue(
            'financial-connection.plaid.refresh-status',
            'Failed to refresh Plaid status after connection',
            statusError,
            { provider: 'plaid' }
          );
        }

        if (connectionId) {
          dispatch(connectionActions.patch({ isSyncing: true }));
          try {
            await PlaidService.syncTransactions(connectionId);
            await invalidateCache();
          } catch (syncError) {
            recordHandledIssue(
              'financial-connection.plaid.sync-transactions',
              'Failed to sync transactions during onboarding',
              syncError,
              { provider: 'plaid' }
            );
            await invalidateCache();
          } finally {
            dispatch(connectionActions.patch({ isSyncing: false }));
          }
        } else {
          await invalidateCache();
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Connection failed';
        handleError(errorMessage);
      } finally {
        dispatch(connectionActions.patch({ connectionInProgress: false }));
      }
    },
    [dispatch, handleError, invalidateCache, onConnectionSuccess]
  );

  const onScriptLoadFailed = useCallback(() => {
    recordHandledIssue(
      'financial-connection.plaid.script-load',
      'Plaid Link script failed to load',
      undefined,
      { provider: 'plaid' }
    );
    sdkFailedRef.current = true;
    handleError(PLAID_LINK_LOAD_FAILED_MESSAGE);
  }, [handleError, sdkFailedRef]);

  const getLinkToken = useCallback(async () => {
    if (!isOnline) {
      throw new Error('Unavailable while offline');
    }

    dispatch(connectionActions.patch({ error: null }));
    const response = await PlaidService.getLinkToken();
    return response.link_token;
  }, [dispatch, isOnline]);

  return useMemo(
    () => ({
      getReady: () => sdkRef.current?.getReady() ?? false,
      open: () => sdkRef.current?.open(),
      load: async () => {
        const token = await getLinkToken();
        flushSync(() => {
          setLinkToken(token);
        });
      },
      reset: () => setLinkToken(null),
      loadFailedMessage: PLAID_LINK_LOAD_FAILED_MESSAGE,
      render: () =>
        linkToken
          ? createElement(PlaidLinkSdk, {
              key: sdkNonce,
              ref: sdkRef,
              token: linkToken,
              onSuccess: handleSuccess,
              onExit: (err) => {
                dispatch(connectionActions.patch({ connectionInProgress: false }));
                if (err) {
                  handleError(POPUP_BLOCKED_MESSAGE);
                }
              },
              onScriptLoadFailed,
            })
          : null,
    }),
    [dispatch, getLinkToken, handleError, handleSuccess, linkToken, onScriptLoadFailed, sdkNonce]
  );
}
