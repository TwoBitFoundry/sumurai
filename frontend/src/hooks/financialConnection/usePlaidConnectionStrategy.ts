/**
 * Plaid-specific link, exchange, sync, and cache refresh behavior.
 */

import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    setReady,
    sdkFailedRef,
    dispatch,
    handleError,
    onConnectionSuccess,
    invalidateCache,
  } = context;

  const [linkToken, setLinkToken] = useState<string | null>(null);
  const sdkRef = useRef<PlaidLinkSdkHandle>(null);
  const prefetchInFlightRef = useRef(false);

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
        setLinkToken(null);
        setReady(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Connection failed';
        handleError(errorMessage);
      } finally {
        dispatch(connectionActions.patch({ connectionInProgress: false }));
      }
    },
    [dispatch, handleError, invalidateCache, onConnectionSuccess, setReady]
  );

  const onScriptLoadFailed = useCallback(() => {
    recordHandledIssue(
      'financial-connection.plaid.script-load',
      'Plaid Link script failed to load',
      undefined,
      { provider: 'plaid' }
    );
    sdkFailedRef.current = true;
    setReady(false);
    handleError(PLAID_LINK_LOAD_FAILED_MESSAGE);
  }, [handleError, sdkFailedRef, setReady]);

  const getLinkToken = useCallback(async () => {
    if (!isOnline) {
      throw new Error('Unavailable while offline');
    }

    dispatch(connectionActions.patch({ error: null }));
    const response = await PlaidService.getLinkToken();
    return response.link_token;
  }, [dispatch, isOnline]);

  useEffect(() => {
    if (!isOnline || linkToken || prefetchInFlightRef.current) {
      return;
    }

    let isActive = true;
    prefetchInFlightRef.current = true;

    const prefetch = async () => {
      try {
        const token = await getLinkToken();
        if (isActive) {
          flushSync(() => {
            setLinkToken(token);
          });
        }
      } catch (err) {
        recordHandledIssue(
          'financial-connection.plaid.prefetch-link-token',
          'Failed to prefetch Plaid link token',
          err,
          { provider: 'plaid' }
        );
      } finally {
        prefetchInFlightRef.current = false;
      }
    };

    void prefetch();

    return () => {
      isActive = false;
    };
  }, [getLinkToken, isOnline, linkToken]);

  useEffect(() => {
    if (!linkToken) {
      setReady(false);
    }
  }, [linkToken, setReady]);

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
      reset: () => {
        setReady(false);
        setLinkToken(null);
      },
      loadFailedMessage: PLAID_LINK_LOAD_FAILED_MESSAGE,
      render: () =>
        linkToken
          ? createElement(PlaidLinkSdk, {
              key: sdkNonce,
              ref: sdkRef,
              token: linkToken,
              onSuccess: handleSuccess,
              onReady: () => setReady(true),
              onExit: (err) => {
                setReady(false);
                setLinkToken(null);
                dispatch(connectionActions.patch({ connectionInProgress: false }));
                if (err) {
                  handleError(POPUP_BLOCKED_MESSAGE);
                }
              },
              onScriptLoadFailed,
            })
          : null,
    }),
    [
      dispatch,
      getLinkToken,
      handleError,
      handleSuccess,
      linkToken,
      onScriptLoadFailed,
      sdkNonce,
      setReady,
    ]
  );
}
