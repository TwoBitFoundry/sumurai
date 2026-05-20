import { createElement, useCallback, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { PlaidLinkSdk, type PlaidLinkSdkHandle } from '@/features/plaid/components/PlaidLinkSdk';
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
    handleError,
    setConnectionInProgress,
    setIsConnected,
    setInstitutionName,
    setIsSyncing,
    setError,
    onConnectionSuccess,
    invalidateCache,
  } = context;

  const [linkToken, setLinkToken] = useState<string | null>(null);
  const sdkRef = useRef<PlaidLinkSdkHandle>(null);

  const handleSuccess = useCallback(
    async (publicToken: string) => {
      setConnectionInProgress(true);
      setError(null);

      try {
        const exchange = await PlaidService.exchangeToken(publicToken);

        setIsConnected(true);
        const name = exchange.institution_name ?? DEFAULT_INSTITUTION_NAME;
        setInstitutionName(name);
        onConnectionSuccess?.(name);

        let connectionId: string | null = exchange.connection_id ?? null;
        try {
          const status = await PlaidService.getStatus();
          const connections = Array.isArray(status?.connections) ? status.connections : [];
          const latestConnection = connections.find((conn) => conn.is_connected) ?? connections[0];
          if (latestConnection) {
            setInstitutionName(latestConnection.institution_name || DEFAULT_INSTITUTION_NAME);
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
          setIsSyncing(true);
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
            setIsSyncing(false);
          }
        } else {
          await invalidateCache();
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Connection failed';
        handleError(errorMessage);
      } finally {
        setConnectionInProgress(false);
      }
    },
    [
      handleError,
      invalidateCache,
      onConnectionSuccess,
      setConnectionInProgress,
      setError,
      setInstitutionName,
      setIsConnected,
      setIsSyncing,
    ]
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

    setError(null);
    const response = await PlaidService.getLinkToken();
    return response.link_token;
  }, [isOnline, setError]);

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
                setConnectionInProgress(false);
                if (err) {
                  handleError(POPUP_BLOCKED_MESSAGE);
                }
              },
              onScriptLoadFailed,
            })
          : null,
    }),
    [
      getLinkToken,
      handleError,
      handleSuccess,
      linkToken,
      onScriptLoadFailed,
      sdkNonce,
      setConnectionInProgress,
    ]
  );
}
