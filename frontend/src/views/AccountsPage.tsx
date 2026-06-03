import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, cn } from '@/ui/primitives';
import { appTitleBarRecipes } from '@/ui/primitives/AppTitleBar';
import { control, text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import { OnboardingProviderConnectModal } from '../components/onboarding/OnboardingProviderConnectModal';
import { ToastStack } from '../components/toastStack/ToastStack';
import { useAccountsToastStack } from '../features/accounts/hooks/useAccountsToastStack';
import AccountsSummaryStats from '../features/plaid/components/AccountsSummaryStats';
import ConnectButton from '../features/plaid/components/ConnectButton';
import ConnectionsList, {
  type BankConnectionViewModel,
} from '../features/plaid/components/ConnectionsList';
import { ProviderSelectionPanel } from '../features/plaid/components/ProviderSelectionPanel';
import { inferBankProvider } from '../features/plaid/utils/inferBankProvider';
import { SimpleFinIgnoredInstitutionsPanel } from '../features/simplefin/components/SimpleFinIgnoredInstitutionsPanel';
import { formatSimpleFinAuthRequiredToast } from '../features/simplefin/utils/formatSimpleFinAuthRequiredToast';
import { SyncAllStatusToast } from '../features/sync/components/SyncAllStatusModal';
import { useSyncAllOrchestrator } from '../features/sync/hooks/useSyncAllOrchestrator';
import { useAccountFilter } from '../hooks/useAccountFilter';
import { useFinancialConnection } from '../hooks/useFinancialConnection';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePlaidConnections } from '../hooks/usePlaidConnections';
import { useProviderCatalog } from '../hooks/useProviderCatalog';
import { PageLayout } from '../layouts/PageLayout';
import { PlaidService } from '../services/PlaidService';
import { SimpleFinService } from '../services/SimpleFinService';
import { TellerService } from '../services/TellerService';
import type { FinancialProvider } from '../types/api';
import type { ProviderCatalogue } from '../types/providerCatalog';
import { dispatchAccountsChanged } from '../utils/events';
import { formatUserFacingApiError } from '../utils/formatUserFacingApiError';
import {
  getConnectAccountProviderContent,
  getProviderCardConfig,
  getProviderLogoSrc,
} from '../utils/providerCards';
import {
  refreshFinancialDataAfterProviderChange,
  type SyncProvider,
} from '../utils/queryInvalidation';

const formatRelativeTime = (iso: string): string => {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return 'Unknown';
  }

  const now = Date.now();
  const diff = Math.max(0, now - timestamp);

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;
  const year = 365 * day;

  if (diff < minute) return 'just now';
  if (diff < hour) return `${Math.round(diff / minute)}m ago`;
  if (diff < day) return `${Math.round(diff / hour)}h ago`;
  if (diff < month) return `${Math.round(diff / day)}d ago`;
  if (diff < year) return `${Math.round(diff / month)}mo ago`;
  return `${Math.round(diff / year)}y ago`;
};

const formatAbsoluteTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown timestamp';
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

interface AccountsPageProps {
  onError?: (message: string | null) => void;
}

const toAccountType = (
  value: string | undefined
): BankConnectionViewModel['accounts'][number]['type'] => {
  const normalized = (value ?? '').toLowerCase();
  if (normalized === 'savings') return 'savings';
  if (normalized === 'credit' || normalized === 'credit card') return 'credit';
  if (normalized === 'loan') return 'loan';
  if (normalized === 'checking' || normalized === 'depository') return 'checking';
  return 'other';
};

const AccountsPage = ({ onError }: AccountsPageProps) => {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const accountFilter = useAccountFilter();
  const providerCatalog = useProviderCatalog();
  const primaryProvider = useMemo(() => {
    const preferred = providerCatalog.userProvider ?? providerCatalog.availableProviders[0];
    if (!preferred) {
      return 'simplefin' as const;
    }
    return providerCatalog.resolveConnectProvider(preferred);
  }, [providerCatalog]);
  const primaryProviderCard = getProviderCardConfig(primaryProvider);
  const primaryConnectContent = getConnectAccountProviderContent(primaryProvider);
  const providerLabel = primaryProviderCard.title;
  const providerLogoSrc = getProviderLogoSrc(primaryProvider);

  const plaidConnections = usePlaidConnections({
    enabled: isOnline && providerCatalog.canConnectWith('plaid'),
  });
  const tellerStatusQuery = useQuery({
    queryKey: ['teller', 'connections'],
    queryFn: () => TellerService.getStatus(),
    enabled: isOnline && providerCatalog.canConnectWith('teller'),
    staleTime: 5 * 60 * 1000,
  });

  const providerByConnectionId = useMemo(() => {
    const providers = new Map<string, FinancialProvider>();
    for (const connection of plaidConnections.connections) {
      providers.set(connection.connectionId, 'plaid');
    }
    for (const status of tellerStatusQuery.data ?? []) {
      providers.set(status.connection_id, 'teller');
    }
    return providers;
  }, [plaidConnections.connections, tellerStatusQuery.data]);

  const banks = useMemo(
    () =>
      Object.entries(accountFilter.accountsByBank).map(([bankName, accounts]) => {
        const connectionId =
          accounts.find((account) => account.connection_id)?.connection_id ?? null;
        const provider = inferBankProvider(connectionId, providerByConnectionId, primaryProvider);

        return {
          id: connectionId ?? bankName,
          name: bankName,
          short: bankName
            .split(' ')
            .map((word) => word[0])
            .join('')
            .slice(0, 2)
            .toUpperCase(),
          status: 'connected' as const,
          lastSync: null,
          provider,
          connectionId,
          accounts: accounts.map((account) => ({
            id: account.id,
            name: account.name,
            mask: account.mask ?? '0000',
            type: toAccountType(account.account_type),
            balance:
              account.balance_current ??
              account.balance_ledger ??
              account.balance_available ??
              undefined,
            transactions: account.transaction_count ?? undefined,
            providerAccountId: account.provider_account_id ?? null,
          })),
        };
      }),
    [accountFilter.accountsByBank, primaryProvider, providerByConnectionId]
  );

  const providersForSync = useMemo(() => {
    const providers = new Set<SyncProvider>([primaryProvider]);
    for (const bank of banks) {
      providers.add(bank.provider);
    }
    return providers;
  }, [banks, primaryProvider]);

  const banksWithSync = useMemo(() => {
    const syncByConnectionId = new Map<string, string | null>();
    for (const connection of plaidConnections.connections) {
      syncByConnectionId.set(connection.connectionId, connection.lastSyncAt);
    }
    for (const status of tellerStatusQuery.data ?? []) {
      syncByConnectionId.set(status.connection_id, status.last_sync_at);
    }
    return banks.map((bank) => {
      const connectionId = bank.connectionId;
      if (!connectionId) {
        return bank;
      }
      const fromStatus = syncByConnectionId.get(connectionId);
      return {
        ...bank,
        lastSync: fromStatus ?? bank.lastSync ?? null,
      };
    });
  }, [banks, plaidConnections.connections, tellerStatusQuery.data]);

  const { pushToast: pushAccountsToast, ...accountsToastStack } = useAccountsToastStack(null);
  const connectionFlow = useFinancialConnection({
    provider: primaryProvider,
    onError: (message) => {
      pushAccountsToast(message, 'error');
      onError?.(message);
    },
    onSimpleFinAuthRequired: (institutions) => {
      pushAccountsToast(formatSimpleFinAuthRequiredToast(institutions));
    },
    isOnline,
  });
  const plaidPickerConnectionFlow = useFinancialConnection({
    provider: 'plaid',
    onError: (message) => {
      pushAccountsToast(message, 'error');
      onError?.(message);
    },
    isOnline,
  });
  const tellerPickerConnectionFlow = useFinancialConnection({
    provider: 'teller',
    onError: (message) => {
      pushAccountsToast(message, 'error');
      onError?.(message);
    },
    isOnline,
  });
  const [pickerConnectingProvider, setPickerConnectingProvider] = useState<SyncProvider | null>(
    null
  );
  const pickerPrevInProgressRef = useRef(false);
  const [restoringIgnoredOrgConnId, setRestoringIgnoredOrgConnId] = useState<string | null>(null);
  const accountsDataLoading = providerCatalog.loading || accountFilter.loading;
  const hasActiveConnections = banks.some((bank) => bank.connectionId != null);

  const needsProviderPick =
    !accountsDataLoading && (providerCatalog.userProvider == null || !hasActiveConnections);
  const prevNeedsProviderPickRef = useRef(needsProviderPick);
  const pickerConnectionFlow =
    pickerConnectingProvider === 'plaid'
      ? plaidPickerConnectionFlow
      : pickerConnectingProvider === 'teller'
        ? tellerPickerConnectionFlow
        : null;
  const activePickerConnectingProvider =
    pickerConnectingProvider === 'simplefin'
      ? pickerConnectingProvider
      : pickerConnectionFlow?.connectionInProgress
        ? pickerConnectingProvider
        : null;

  const simpleFinEmptyStateActive =
    primaryProvider === 'simplefin' && banksWithSync.length === 0 && !accountsDataLoading;
  const pickerProviderReadyState = {
    plaid: plaidPickerConnectionFlow.isReady,
    teller: tellerPickerConnectionFlow.isReady,
    simplefin: true,
  } satisfies Partial<Record<FinancialProvider, boolean>>;
  const ignoredInstitutionsQuery = useQuery({
    queryKey: ['simplefin', 'ignored-institutions'],
    queryFn: () => SimpleFinService.getIgnoredInstitutions(),
    enabled: simpleFinEmptyStateActive && isOnline,
    staleTime: 60 * 1000,
  });
  const ignoredInstitutions = ignoredInstitutionsQuery.data ?? [];
  const showSimpleFinIgnoredList = simpleFinEmptyStateActive && ignoredInstitutions.length > 0;
  const refreshBankData = useCallback(
    async (provider: SyncProvider) => {
      await refreshFinancialDataAfterProviderChange(queryClient, [provider]);
    },
    [queryClient]
  );
  const { syncingAll, syncAllModalOpen, syncAllRows, syncAll, closeSyncAllModal } =
    useSyncAllOrchestrator({
      banks: banksWithSync,
      primaryProvider,
      isOnline,
      queryClient,
      onError: (message) => {
        if (message) {
          pushAccountsToast(message, 'error');
          onError?.(message);
        }
      },
    });

  const startProviderPickerConnection = useCallback(
    async (provider: FinancialProvider) => {
      if (provider === 'simplefin') {
        setPickerConnectingProvider(provider);
        return;
      }

      setPickerConnectingProvider(provider);

      if (provider === 'plaid') {
        await plaidPickerConnectionFlow.initiateConnection();
        return;
      }

      await tellerPickerConnectionFlow.initiateConnection();
    },
    [plaidPickerConnectionFlow, tellerPickerConnectionFlow]
  );

  const finishSimpleFinPickerConnection = useCallback(
    async (provider: FinancialProvider) => {
      try {
        await providerCatalog.chooseProvider(provider);
      } catch (error) {
        console.warn('Failed to select provider after SimpleFIN connection', error);
        pushAccountsToast('Unable to select provider right now', 'error');
      } finally {
        setPickerConnectingProvider(null);
      }
    },
    [providerCatalog, pushAccountsToast]
  );

  const openConnectModal = useCallback(() => {
    setPickerConnectingProvider('simplefin');
  }, []);

  const handlePrimaryConnect = useCallback(() => {
    if (primaryProvider === 'simplefin') {
      openConnectModal();
      return;
    }

    void connectionFlow.initiateConnection();
  }, [connectionFlow, openConnectModal, primaryProvider]);

  useEffect(() => {
    if (prevNeedsProviderPickRef.current === needsProviderPick) {
      return;
    }

    prevNeedsProviderPickRef.current = needsProviderPick;
    setPickerConnectingProvider(null);
    pickerPrevInProgressRef.current = false;
  }, [needsProviderPick]);

  useEffect(() => {
    if (!pickerConnectionFlow || !pickerConnectingProvider) {
      pickerPrevInProgressRef.current = false;
      return;
    }

    const wasInProgress = pickerPrevInProgressRef.current;
    pickerPrevInProgressRef.current = pickerConnectionFlow.connectionInProgress;

    if (
      wasInProgress &&
      !pickerConnectionFlow.connectionInProgress &&
      !pickerConnectionFlow.isConnected
    ) {
      setPickerConnectingProvider(null);
    }
  }, [pickerConnectingProvider, pickerConnectionFlow]);

  useEffect(() => {
    if (!pickerConnectionFlow || !pickerConnectingProvider) {
      return;
    }

    if (
      pickerConnectionFlow.isConnected &&
      !pickerConnectionFlow.connectionInProgress &&
      !pickerConnectionFlow.isSyncing
    ) {
      void providerCatalog
        .chooseProvider(pickerConnectingProvider)
        .catch(() => pushAccountsToast('Unable to select provider right now', 'error'))
        .finally(() => {
          setPickerConnectingProvider(null);
          pickerPrevInProgressRef.current = false;
        });
    }
  }, [pickerConnectingProvider, pickerConnectionFlow, providerCatalog, pushAccountsToast]);

  const dismissTransient = accountsToastStack.dismissTransient;
  const syncBank = useCallback(
    async (bankId: string) => {
      if (!isOnline) {
        return;
      }

      const bank = banks.find((entry) => entry.id === bankId);
      if (!bank?.connectionId) {
        return;
      }

      const statusToastId = pushAccountsToast(`Syncing ${bank.name}…`);
      try {
        let count = 0;
        if (bank.provider === 'simplefin') {
          const result = await SimpleFinService.syncBridge(bank.connectionId);
          if (result.rateLimited) {
            dismissTransient(statusToastId);
            pushAccountsToast('Daily sync limit reached. Try again tomorrow.', 'error');
            return;
          }

          const matchingResult = result.simplefin_institution_results.find(
            (entry) =>
              entry.org_conn_id === bank.connectionId || entry.institution_name === bank.name
          );
          if (matchingResult?.status === 'auth_required') {
            dismissTransient(statusToastId);
            pushAccountsToast(
              formatSimpleFinAuthRequiredToast([
                {
                  institution_name: bank.name,
                  org_conn_id: bank.connectionId,
                  message:
                    matchingResult.message ?? 'Re-authenticate this institution in SimpleFIN.',
                },
              ])
            );
            return;
          }

          count = result.transactions.length;
        } else if (bank.provider === 'teller') {
          const result = await TellerService.syncTransactions(bank.connectionId);
          count = result.transactions.length;
        } else {
          const result = await PlaidService.syncTransactions(bank.connectionId);
          count = result.transactions.length;
        }
        await refreshBankData(bank.provider);
        pushAccountsToast(
          `Synced ${count} new transaction${count === 1 ? '' : 's'} for ${bank.name}`
        );
      } catch (error) {
        console.warn('Failed to sync bank', error);
        dismissTransient(statusToastId);
        const message = formatUserFacingApiError(error, `Failed to sync ${bank.name}`);
        pushAccountsToast(message, 'error');
      }
    },
    [banks, dismissTransient, isOnline, pushAccountsToast, refreshBankData]
  );

  const disconnect = useCallback(
    async (bankId: string) => {
      const bank = banks.find((entry) => entry.id === bankId);
      if (!bank?.connectionId) {
        return;
      }

      const disconnectingLastBank = banks.length === 1;

      try {
        if (bank.provider === 'teller') {
          await TellerService.disconnect(bank.connectionId);
        } else {
          await PlaidService.disconnect(bank.connectionId);
        }
        await refreshBankData(bank.provider);
        dispatchAccountsChanged();
        if (disconnectingLastBank) {
          queryClient.setQueryData<ProviderCatalogue>(['provider', 'catalog'], (prev) =>
            prev ? { ...prev, user_provider: null } : prev
          );
        }
        try {
          await providerCatalog.refresh();
        } catch (refreshError) {
          console.warn('Failed to refresh provider catalog after disconnect', refreshError);
        }
        pushAccountsToast(`${bank.name} disconnected successfully`);
      } catch (error) {
        console.warn('Failed to disconnect bank', error);
        onError?.('Failed to disconnect institution');
      }
    },
    [banks, onError, providerCatalog, refreshBankData, pushAccountsToast, queryClient.setQueryData]
  );

  const handleImportSuccess = useCallback(
    (count: number, mask: string) => {
      pushAccountsToast(`Imported ${count} transactions for ••${mask}`);
    },
    [pushAccountsToast]
  );

  const restoreIgnoredInstitution = useCallback(
    async (orgConnId: string) => {
      if (!isOnline) {
        return;
      }

      setRestoringIgnoredOrgConnId(orgConnId);
      connectionFlow.setError(null);
      onError?.(null);

      try {
        const { rateLimited, transactionCount, institutionsRequiringAuth } =
          await SimpleFinService.restoreInstitution(orgConnId);

        await queryClient.refetchQueries({
          queryKey: ['simplefin', 'ignored-institutions'],
          type: 'active',
        });
        await refreshBankData('simplefin');
        dispatchAccountsChanged();
        connectionFlow.setError(null);
        onError?.(null);

        if (rateLimited) {
          pushAccountsToast(
            'Institution restored. Balances are ready; transaction sync will resume when the rate limit clears.'
          );
        } else if (institutionsRequiringAuth.length > 0) {
          pushAccountsToast(formatSimpleFinAuthRequiredToast(institutionsRequiringAuth));
        } else {
          pushAccountsToast(
            `Institution restored — synced ${transactionCount} new transaction${transactionCount === 1 ? '' : 's'}`
          );
        }
      } catch (error) {
        console.warn('Failed to restore SimpleFIN institution', error);
        const message = formatUserFacingApiError(
          error,
          'Failed to restore institution. Try again.'
        );
        connectionFlow.setError(message);
        onError?.(message);
      } finally {
        setRestoringIgnoredOrgConnId(null);
      }
    },
    [connectionFlow, isOnline, onError, queryClient, refreshBankData, pushAccountsToast]
  );

  const connectionsEmptyState = useMemo(() => {
    if (!showSimpleFinIgnoredList) {
      return undefined;
    }

    return (
      <SimpleFinIgnoredInstitutionsPanel
        institutions={ignoredInstitutions}
        onRestore={restoreIgnoredInstitution}
        restoringOrgConnId={restoringIgnoredOrgConnId}
        isOnline={isOnline}
      />
    );
  }, [
    ignoredInstitutions,
    isOnline,
    restoreIgnoredInstitution,
    restoringIgnoredOrgConnId,
    showSimpleFinIgnoredList,
  ]);

  const summary = useMemo(() => {
    let connectedInstitutions = 0;
    let totalAccounts = 0;
    let latestSyncIso: string | null = null;
    let latestSyncTime = 0;

    for (const bank of banksWithSync) {
      if (bank.status === 'connected') connectedInstitutions += 1;
      totalAccounts += bank.accounts.length;

      if (bank.lastSync) {
        const parsed = Date.parse(bank.lastSync);
        if (!Number.isNaN(parsed) && parsed > latestSyncTime) {
          latestSyncTime = parsed;
          latestSyncIso = bank.lastSync;
        }
      }
    }

    return {
      institutions: banksWithSync.length,
      connectedInstitutions,
      accounts: totalAccounts,
      latestSync: latestSyncIso,
    };
  }, [banksWithSync]);

  const catalogLoading = providerCatalog.loading || accountFilter.loading;

  const connectDisabled =
    catalogLoading ||
    connectionFlow.connectionInProgress ||
    (primaryProvider === 'teller' && !connectionFlow.isReady) ||
    !isOnline ||
    !providerCatalog.canConnectWith(primaryProvider);

  const lastSyncValue = syncingAll
    ? 'Syncing...'
    : summary.institutions === 0 && catalogLoading
      ? 'Loading...'
      : summary.latestSync
        ? formatRelativeTime(summary.latestSync)
        : summary.institutions > 0
          ? 'Just now'
          : 'Awaiting first ledger.';
  const lastSyncDetail = summary.latestSync
    ? `Refreshed ${formatAbsoluteTime(summary.latestSync)}`
    : '';
  const actions = (
    <div className="inline-flex max-w-full flex-col items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-3">
        {summary.institutions > 0 && (
          <Button
            type="button"
            onClick={syncAll}
            disabled={syncingAll || !isOnline}
            variant="ghost"
            size="md"
            className={cn(appTitleBarRecipes.settingsIdle, 'normal-case')}
            title={!isOnline ? 'Unavailable while offline' : undefined}
          >
            <RefreshCw className={cn(control.glyph.md, syncingAll && 'animate-spin')} />
            {syncingAll ? 'Syncing...' : !isOnline ? 'Offline' : 'Sync all'}
          </Button>
        )}
        <ConnectButton
          onClick={handlePrimaryConnect}
          disabled={connectDisabled}
          title={!isOnline ? 'Unavailable while offline' : undefined}
          leadingImageSrc={providerLogoSrc}
        >
          {primaryConnectContent.cta.defaultLabel}
        </ConnectButton>
      </div>
      {!isOnline && (
        <span
          className={cn('w-full text-center', uiTypographyRecipes.caption, uiTextRecipes.warning)}
        >
          Unavailable while offline
        </span>
      )}
    </div>
  );

  const statsGrid = (
    <AccountsSummaryStats
      summary={summary}
      syncingAll={syncingAll}
      lastSyncValue={lastSyncValue}
      lastSyncDetail={lastSyncDetail}
    />
  );

  if (needsProviderPick) {
    return (
      <div data-testid="accounts-page">
        <div hidden>
          {plaidPickerConnectionFlow.connectionMount}
          {tellerPickerConnectionFlow.connectionMount}
        </div>
        <div className={cn('flex', 'h-full', 'items-center', 'justify-center', 'px-4', 'py-8')}>
          <div className={cn('w-full', 'max-w-7xl')}>
            <ProviderSelectionPanel
              loading={providerCatalog.loading}
              error={providerCatalog.error}
              availableProviders={providerCatalog.availableProviders}
              tellerApplicationId={providerCatalog.tellerApplicationId}
              providerReadyState={pickerProviderReadyState}
              connectingProvider={activePickerConnectingProvider}
              onSelectProvider={(provider) => void startProviderPickerConnection(provider)}
            />
          </div>
        </div>
        {pickerConnectingProvider === 'simplefin' ? (
          <OnboardingProviderConnectModal
            provider={pickerConnectingProvider}
            isOpen
            onClose={() => setPickerConnectingProvider(null)}
            onConnected={(provider) => void finishSimpleFinPickerConnection(provider)}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div data-testid="accounts-page">
      {connectionFlow.connectionMount}
      <PageLayout
        badge={`${providerLabel} Connections`}
        title="Every institution, answering to you."
        subtitle="Link your ally accounts. Keep every balance in clear view."
        actions={actions}
        stats={statsGrid}
      >
        <ConnectionsList
          banks={banksWithSync}
          onConnect={handlePrimaryConnect}
          onSync={syncBank}
          onDisconnect={disconnect}
          isOnline={isOnline}
          providerName={`${providerLabel} accounts`}
          connectLabel={primaryConnectContent.cta.defaultLabel}
          connectLogoSrc={providerLogoSrc}
          onImportSuccess={handleImportSuccess}
          emptyState={connectionsEmptyState}
        />

        <ToastStack
          transients={accountsToastStack.transients}
          pinnedToast={accountsToastStack.pinnedToast}
          onDismissTransient={accountsToastStack.dismissTransient}
          onDismissPinned={accountsToastStack.dismissPinned}
        />
        <SyncAllStatusToast
          isOpen={syncAllModalOpen}
          syncingAll={syncingAll}
          rows={syncAllRows}
          onClose={closeSyncAllModal}
        />
      </PageLayout>
      {pickerConnectingProvider === 'simplefin' ? (
        <OnboardingProviderConnectModal
          provider={pickerConnectingProvider}
          isOpen
          onClose={() => setPickerConnectingProvider(null)}
          onConnected={(provider) => void finishSimpleFinPickerConnection(provider)}
        />
      ) : null}
    </div>
  );
};

export default AccountsPage;
