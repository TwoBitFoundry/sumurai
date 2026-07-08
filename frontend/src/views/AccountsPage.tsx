import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn, IconButton, MenuDropdown, MenuItem } from '@/ui/primitives';
import { appTitleBarRecipes } from '@/ui/primitives/AppTitleBar';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import { OnboardingProviderConnectModal } from '../components/onboarding/OnboardingProviderConnectModal';
import { ToastStack } from '../components/toastStack/ToastStack';
import { mapStoredAccountTypeToUiType } from '../domain/accountCategories';
import { compareInstitutionNames } from '../domain/institutionSort';
import { useAccountsToastStack } from '../features/accounts/hooks/useAccountsToastStack';
import { DemoExitWarningModal } from '../features/demo/DemoExitWarningModal';
import { DiyInstitutionModal } from '../features/diy/DiyInstitutionModal';
import AccountsSummaryStats from '../features/plaid/components/AccountsSummaryStats';
import ConnectButton from '../features/plaid/components/ConnectButton';
import ConnectionsList, {
  type BankConnectionViewModel,
} from '../features/plaid/components/ConnectionsList';
import { ProviderSelectionPanel } from '../features/plaid/components/ProviderSelectionPanel';
import { inferBankProvider } from '../features/plaid/utils/inferBankProvider';
import { SimpleFinIgnoredInstitutionsPanel } from '../features/simplefin/components/SimpleFinIgnoredInstitutionsPanel';
import { formatSimpleFinAuthRequiredToast } from '../features/simplefin/utils/formatSimpleFinAuthRequiredToast';
import { SyncAllStatusToast } from '../features/sync/components/SyncAllStatusToast';
import { SyncInstitutionStatusToast } from '../features/sync/components/SyncInstitutionStatusToast';
import { useSyncAllOrchestrator } from '../features/sync/hooks/useSyncAllOrchestrator';
import type { SyncAllRow } from '../features/sync/types/syncAllStatus';
import { isProviderReconnectRequiredError } from '../features/sync/utils/isProviderReconnectRequiredError';
import { useAccountFilter } from '../hooks/useAccountFilter';
import { useExport } from '../hooks/useExport';
import { useFinancialConnection } from '../hooks/useFinancialConnection';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePlaidConnections } from '../hooks/usePlaidConnections';
import { useProviderCatalog } from '../hooks/useProviderCatalog';
import { PageLayout } from '../layouts/PageLayout';
import { DiyService } from '../services/DiyService';
import { PlaidService } from '../services/PlaidService';
import { SimpleFinService } from '../services/SimpleFinService';
import { TellerService } from '../services/TellerService';
import type { FinancialProvider } from '../types/api';
import type { ProviderCatalogue } from '../types/providerCatalog';
import { dispatchFinancialAccountsRefresh, dispatchFinancialAppRefresh } from '../utils/events';
import { formatUserFacingApiError } from '../utils/formatUserFacingApiError';
import { getProviderCardConfig, resolvePickerVisibleProviders } from '../utils/providerCards';
import {
  type InvalidateStaleCacheOptions,
  isSyncProvider,
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

interface AccountsPageProps {
  onError?: (message: string | null) => void;
  demoModeActive?: boolean;
}

type DiyModalTarget = {
  connectionId?: string | null;
  institutionName?: string | null;
  existingAccounts?: { name: string; mask: string | null }[];
};

type BankStatus = BankConnectionViewModel['status'];

const mapSyncRowStatusToBankStatus = (status: SyncAllRow['status']): BankStatus | null => {
  if (status === 'auth_required') {
    return 'needs_reauth';
  }

  if (status === 'error') {
    return 'error';
  }

  if (status === 'synced' || status === 'skipped_hidden' || status === 'no_accounts') {
    return 'connected';
  }

  return null;
};

const AccountsPage = ({ onError, demoModeActive = false }: AccountsPageProps) => {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const accountFilter = useAccountFilter();
  const providerCatalog = useProviderCatalog();
  const preferredProvider = useMemo(() => {
    const preferred = providerCatalog.userProvider ?? providerCatalog.availableProviders[0];
    if (!preferred) {
      return 'simplefin' as const;
    }
    return providerCatalog.resolveConnectProvider(preferred);
  }, [providerCatalog]);
  const { isExporting, error: exportError, toast: exportToast, exportAccounts } = useExport();

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

  const connectedAggregators = useMemo(() => {
    const providers = new Set<SyncProvider>();
    for (const provider of providerByConnectionId.values()) {
      if (isSyncProvider(provider)) providers.add(provider);
    }
    return providers;
  }, [providerByConnectionId]);

  const banks = useMemo(
    () =>
      Object.entries(accountFilter.accountsByBank)
        .map(([bankName, accounts]) => {
          const displayName = accounts[0]?.institution_name ?? bankName.split('::')[0] ?? bankName;
          const connectionId =
            accounts.find((account) => account.connection_id)?.connection_id ?? null;
          const provider =
            accounts.find((account) => account.provider != null)?.provider ??
            inferBankProvider(connectionId, providerByConnectionId, preferredProvider);

          return {
            id: connectionId ?? bankName,
            name: displayName,
            short: displayName
              .split(' ')
              .map((word) => word[0])
              .join('')
              .slice(0, 2)
              .toUpperCase(),
            status: 'connected' as BankStatus,
            lastSync: null,
            provider,
            connectionId,
            accounts: accounts.map((account) => ({
              id: account.id,
              name: account.name,
              mask: account.mask ?? '0000',
              type: mapStoredAccountTypeToUiType(account.account_type),
              balance:
                account.balance_current ??
                account.balance_ledger ??
                account.balance_available ??
                undefined,
              transactions: account.transaction_count ?? undefined,
              providerAccountId: account.provider_account_id ?? null,
            })),
          };
        })
        .sort((left, right) => compareInstitutionNames(left.name, right.name)),
    [accountFilter.accountsByBank, preferredProvider, providerByConnectionId]
  );
  const [bankStatuses, setBankStatuses] = useState<Record<string, BankStatus>>({});

  useEffect(() => {
    setBankStatuses((current) => {
      let changed = false;
      const next: Record<string, BankStatus> = {};

      for (const bank of banks) {
        const status = current[bank.id] ?? bank.status;
        next[bank.id] = status;

        if (current[bank.id] !== status) {
          changed = true;
        }
      }

      if (!changed && Object.keys(current).length === banks.length) {
        return current;
      }

      return next;
    });
  }, [banks]);

  const updateBankStatus = useCallback((bankId: string, status: BankStatus) => {
    setBankStatuses((current) =>
      current[bankId] === status ? current : { ...current, [bankId]: status }
    );
  }, []);

  const activeAggregator = useMemo<SyncProvider | null>(() => {
    for (const bank of banks) {
      if (isSyncProvider(bank.provider)) {
        return bank.provider;
      }
    }
    return null;
  }, [banks]);
  const primaryProvider = activeAggregator ?? 'diy';
  const primaryProviderCard = getProviderCardConfig(primaryProvider);
  const providerLabel = primaryProviderCard.title;
  const connectAccountLabel = 'Link Account';

  const existingInstitutionNames = useMemo(() => banks.map((bank) => bank.name), [banks]);

  const providersForSync = useMemo(() => {
    const providers = new Set<SyncProvider>();
    if (isSyncProvider(primaryProvider)) providers.add(primaryProvider);
    for (const bank of banks) {
      if (isSyncProvider(bank.provider)) providers.add(bank.provider);
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
        return {
          ...bank,
          status: bankStatuses[bank.id] ?? bank.status,
        };
      }
      const fromStatus = syncByConnectionId.get(connectionId);
      return {
        ...bank,
        lastSync: fromStatus ?? bank.lastSync ?? null,
        status: bankStatuses[bank.id] ?? bank.status,
      };
    });
  }, [bankStatuses, banks, plaidConnections.connections, tellerStatusQuery.data]);

  const { pushToast: pushAccountsToast, ...accountsToastStack } = useAccountsToastStack(null);
  const [syncInstitutionRow, setSyncInstitutionRow] = useState<SyncAllRow | null>(null);
  const [diyModalTarget, setDiyModalTarget] = useState<DiyModalTarget | null>(null);
  const [demoExitWarningOpen, setDemoExitWarningOpen] = useState(false);
  const pendingDemoExitActionRef = useRef<(() => void | Promise<void>) | null>(null);
  const [isProviderPickerOpen, setIsProviderPickerOpen] = useState(false);
  const [pickerConnectingProvider, setPickerConnectingProvider] = useState<SyncProvider | null>(
    null
  );
  const exportInFlightRef = useRef(false);
  const dismissSyncInstitutionToast = useCallback(() => {
    setSyncInstitutionRow(null);
  }, []);
  const connectionFlow = useFinancialConnection({
    provider: activeAggregator ?? 'simplefin',
    mountKey: 'accounts-main',
    onError: (message) => {
      pushAccountsToast(message, 'error');
      onError?.(message);
    },
    onSimpleFinAuthRequired: (institutions) => {
      pushAccountsToast(formatSimpleFinAuthRequiredToast(institutions));
    },
    isOnline,
  });
  const handlePickerSdkExit = useCallback(() => {
    setPickerConnectingProvider(null);
    setIsProviderPickerOpen(true);
  }, []);
  const plaidPickerConnectionFlow = useFinancialConnection({
    provider: 'plaid',
    mountKey: 'accounts-picker-plaid',
    onError: (message) => {
      pushAccountsToast(message, 'error');
      onError?.(message);
    },
    onExit: handlePickerSdkExit,
    isOnline: isOnline && providerCatalog.canConnectWith('plaid'),
  });
  const tellerPickerConnectionFlow = useFinancialConnection({
    provider: 'teller',
    mountKey: 'accounts-picker-teller',
    onError: (message) => {
      pushAccountsToast(message, 'error');
      onError?.(message);
    },
    onExit: handlePickerSdkExit,
    isOnline: isOnline && providerCatalog.canConnectWith('teller'),
  });
  const [restoringIgnoredOrgConnId, setRestoringIgnoredOrgConnId] = useState<string | null>(null);
  const accountsDataLoading = providerCatalog.loading || accountFilter.loading;
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
    preferredProvider === 'simplefin' && banksWithSync.length === 0 && !accountsDataLoading;
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
    async (provider: SyncProvider, options?: InvalidateStaleCacheOptions) => {
      await refreshFinancialDataAfterProviderChange(queryClient, [provider], options);
    },
    [queryClient]
  );
  const { syncingAll, syncAllModalOpen, syncAllRows, syncAll, closeSyncAllModal } =
    useSyncAllOrchestrator({
      banks: banksWithSync,
      primaryProvider,
      isOnline,
      onError: (message) => {
        if (message) {
          pushAccountsToast(message, 'error');
          onError?.(message);
        }
      },
    });

  useEffect(() => {
    for (const row of syncAllRows) {
      const nextStatus = mapSyncRowStatusToBankStatus(row.status);
      if (nextStatus) {
        updateBankStatus(row.id, nextStatus);
      }
    }
  }, [syncAllRows, updateBankStatus]);

  const finishSimpleFinPickerConnection = useCallback(
    async (provider: FinancialProvider) => {
      try {
        await providerCatalog.chooseProvider(provider);
        dispatchFinancialAppRefresh({ tab: 'accounts', refreshSession: true });
        setIsProviderPickerOpen(false);
      } catch (error) {
        console.warn('Failed to select provider after SimpleFIN connection', error);
        pushAccountsToast('Unable to select provider right now', 'error');
      } finally {
        setPickerConnectingProvider(null);
      }
    },
    [providerCatalog, pushAccountsToast]
  );

  const runAfterDemoExitWarning = useCallback(
    (action: () => void | Promise<void>, requiresWarning: boolean) => {
      if (!demoModeActive || !requiresWarning) {
        void action();
        return;
      }

      pendingDemoExitActionRef.current = action;
      setDemoExitWarningOpen(true);
    },
    [demoModeActive]
  );

  const handleDemoExitConfirm = useCallback(() => {
    setDemoExitWarningOpen(false);
    const action = pendingDemoExitActionRef.current;
    pendingDemoExitActionRef.current = null;
    if (action) {
      void action();
    }
  }, []);

  const handleDemoExitCancel = useCallback(() => {
    setDemoExitWarningOpen(false);
    pendingDemoExitActionRef.current = null;
  }, []);

  const setDiyModalTargetDirect = useCallback((target: DiyModalTarget | null = null) => {
    setDiyModalTarget(
      target ?? {
        connectionId: null,
        institutionName: null,
      }
    );
  }, []);

  const openDiyInstitutionModal = useCallback(
    (target: DiyModalTarget | null = null) => {
      runAfterDemoExitWarning(() => setDiyModalTargetDirect(target), target?.connectionId == null);
    },
    [runAfterDemoExitWarning, setDiyModalTargetDirect]
  );

  const startProviderPickerConnection = useCallback(
    async (provider: FinancialProvider) => {
      runAfterDemoExitWarning(async () => {
        if (provider === 'diy') {
          setDiyModalTargetDirect();
          return;
        }

        if (!isSyncProvider(provider)) {
          return;
        }

        setIsProviderPickerOpen(true);

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
      }, true);
    },
    [
      plaidPickerConnectionFlow,
      runAfterDemoExitWarning,
      setDiyModalTargetDirect,
      tellerPickerConnectionFlow,
    ]
  );

  const closeDiyInstitutionModal = useCallback(() => {
    setDiyModalTarget(null);
  }, []);

  const handleDiyInstitutionComplete = useCallback(
    async (_connectionId: string) => {
      const createdNewInstitution = diyModalTarget?.connectionId == null;
      const shouldSelectDiy = activeAggregator == null;

      try {
        if (shouldSelectDiy) {
          await providerCatalog.chooseProvider('diy');
        }
      } catch (error) {
        console.warn('Failed to select DIY provider after institution creation', error);
        pushAccountsToast('Unable to select provider right now', 'error');
      }

      if (createdNewInstitution) {
        dispatchFinancialAppRefresh({ tab: 'accounts', refreshSession: true });
      } else {
        dispatchFinancialAccountsRefresh();
      }

      try {
        await providerCatalog.refresh();
      } catch (error) {
        console.warn('Failed to refresh provider catalog after DIY institution creation', error);
      } finally {
        setIsProviderPickerOpen(false);
        setDiyModalTarget(null);
      }
    },
    [activeAggregator, diyModalTarget, providerCatalog, pushAccountsToast]
  );

  useEffect(() => {
    if (exportInFlightRef.current && !isExporting && exportToast) {
      pushAccountsToast(exportToast, exportError ? 'error' : 'success');
      if (exportError) {
        onError?.(exportError);
      }
    }

    exportInFlightRef.current = isExporting;
  }, [exportError, exportToast, isExporting, onError, pushAccountsToast]);

  const handlePrimaryConnect = useCallback(() => {
    setIsProviderPickerOpen(true);
  }, []);

  useEffect(() => {
    if (
      accountsDataLoading ||
      providerCatalog.userProvider != null ||
      connectedAggregators.size !== 1
    ) {
      return;
    }
    const [provider] = connectedAggregators;
    if (!providerCatalog.canConnectWith(provider)) return;
    void providerCatalog.chooseProvider(provider).catch(() => undefined);
  }, [accountsDataLoading, connectedAggregators, providerCatalog]);

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
        .then(() => {
          dispatchFinancialAppRefresh({ tab: 'accounts', refreshSession: true });
        })
        .catch(() => pushAccountsToast('Unable to select provider right now', 'error'))
        .finally(() => {
          setPickerConnectingProvider(null);
        });
    }
  }, [pickerConnectingProvider, pickerConnectionFlow, providerCatalog, pushAccountsToast]);

  const syncBank = useCallback(
    async (bankId: string) => {
      if (!isOnline) {
        return;
      }

      const bank = banks.find((entry) => entry.id === bankId);
      if (!bank?.connectionId || !isSyncProvider(bank.provider)) {
        return;
      }

      const startRow: SyncAllRow = {
        id: bank.id,
        provider: bank.provider,
        institutionName: bank.name,
        connectionId: bank.connectionId,
        status: 'syncing',
        detail: null,
        transactionCount: null,
        retryAfterSeconds: null,
      };
      setSyncInstitutionRow(startRow);

      const countNewTransactions = (transactions: { provider_account_id?: string | null }[]) => {
        const providerAccountIds = new Set(
          bank.accounts
            .map((account) => account.providerAccountId)
            .filter((id): id is string => Boolean(id))
        );

        if (providerAccountIds.size === 0) {
          return transactions.length;
        }

        return transactions.filter((transaction) => {
          if (!transaction.provider_account_id) {
            return false;
          }

          return providerAccountIds.has(transaction.provider_account_id);
        }).length;
      };

      try {
        let count = 0;
        if (bank.provider === 'simplefin') {
          const result = await SimpleFinService.syncBridge(bank.connectionId);
          if (result.rateLimited) {
            setSyncInstitutionRow({
              ...startRow,
              status: 'rate_limited',
              retryAfterSeconds: result.retryAfterSeconds ?? null,
            });
            return;
          }

          const matchingResult = result.simplefin_institution_results.find(
            (entry) =>
              entry.connection_id === bank.connectionId ||
              entry.org_conn_id === bank.connectionId ||
              entry.institution_name === bank.name
          );
          if (!matchingResult) {
            setSyncInstitutionRow({
              ...startRow,
              status: 'error',
              detail: 'No bridge result was returned for this institution.',
            });
            updateBankStatus(bank.id, 'error');
            return;
          }

          if (matchingResult.status === 'auth_required') {
            setSyncInstitutionRow({
              ...startRow,
              status: 'auth_required',
              detail: matchingResult.message ?? 'Re-authenticate this institution in SimpleFIN.',
            });
            updateBankStatus(bank.id, 'needs_reauth');
            return;
          }

          if (matchingResult.status !== 'synced') {
            setSyncInstitutionRow({
              ...startRow,
              status: matchingResult.status,
              detail: matchingResult.message ?? null,
            });
            const nextStatus = mapSyncRowStatusToBankStatus(matchingResult.status);
            if (nextStatus) {
              updateBankStatus(bank.id, nextStatus);
            }
            return;
          }

          count = countNewTransactions(result.transactions);
        } else if (bank.provider === 'teller') {
          const result = await TellerService.syncTransactions(bank.connectionId);
          count = result.transactions.length;
        } else {
          const result = await PlaidService.syncTransactions(bank.connectionId);
          count = result.transactions.length;
        }
        await refreshBankData(bank.provider, { resetTransactions: 'reset' });
        setSyncInstitutionRow({
          ...startRow,
          status: 'synced',
          detail: `Synced ${count} new transaction${count === 1 ? '' : 's'}`,
          transactionCount: count,
        });
        updateBankStatus(bank.id, 'connected');
      } catch (error) {
        console.warn('Failed to sync bank', error);
        const message = formatUserFacingApiError(error, `Failed to sync ${bank.name}`);
        const nextStatus = isProviderReconnectRequiredError(error) ? 'needs_reauth' : 'error';
        setSyncInstitutionRow({
          ...startRow,
          status: nextStatus === 'needs_reauth' ? 'auth_required' : 'error',
          detail: message,
        });
        updateBankStatus(bank.id, nextStatus);
      }
    },
    [banks, isOnline, refreshBankData, updateBankStatus]
  );

  const disconnect = useCallback(
    async (bankId: string) => {
      const bank = banks.find((entry) => entry.id === bankId);
      const connectionId =
        bank?.connectionId ??
        (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bankId)
          ? bankId
          : null);
      if (!bank || !connectionId) {
        return;
      }

      const disconnectingLastBank = banks.length === 1;
      const disconnectedAccountIds = bank.accounts.map((account) => account.id);

      try {
        if (bank.provider === 'diy') {
          await DiyService.disconnectInstitution(connectionId);
        } else if (bank.provider === 'teller') {
          await TellerService.disconnect(connectionId);
        } else {
          await PlaidService.disconnect(connectionId);
        }

        accountFilter.removeAccountsByIds(disconnectedAccountIds);

        if (isSyncProvider(bank.provider)) {
          await refreshBankData(bank.provider, { resetTransactions: 'remove' });
        } else if (bank.provider === 'diy') {
          await refreshFinancialDataAfterProviderChange(queryClient, [], {
            resetTransactions: 'remove',
          });
        } else {
          return;
        }

        dispatchFinancialAppRefresh({ tab: 'accounts' });
        if (disconnectingLastBank && isSyncProvider(bank.provider)) {
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
    [
      accountFilter.removeAccountsByIds,
      banks,
      onError,
      providerCatalog,
      pushAccountsToast,
      queryClient,
      refreshBankData,
    ]
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
        await refreshBankData('simplefin', { resetTransactions: 'remove' });
        dispatchFinancialAccountsRefresh();
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

  const pickerVisibleProviders = useMemo(
    () => resolvePickerVisibleProviders(activeAggregator, demoModeActive),
    [activeAggregator, demoModeActive]
  );

  const catalogLoading = providerCatalog.loading || accountFilter.loading;

  const connectDisabled = catalogLoading || !isOnline;
  const showProviderPicker = isProviderPickerOpen || pickerConnectingProvider !== null;

  const lastSyncValue = syncingAll
    ? 'Syncing...'
    : summary.institutions === 0 && catalogLoading
      ? 'Loading...'
      : summary.latestSync
        ? formatRelativeTime(summary.latestSync)
        : summary.institutions > 0
          ? 'Just now'
          : 'Awaiting first ledger.';
  const actions = (
    <div className={cn('inline-flex', 'max-w-full', 'w-full', 'flex-col', 'gap-2', 'lg:w-auto')}>
      <div
        className={cn('flex', 'w-full', 'flex-wrap', 'items-center', 'justify-between', 'gap-3')}
      >
        <div className={cn('flex', 'flex-wrap', 'items-center', 'gap-3')}>
          {summary.institutions > 0 && (
            <IconButton
              type="button"
              onClick={syncAll}
              disabled={syncingAll || !isOnline}
              variant="ghost"
              size="md"
              aria-label={syncingAll ? 'Syncing all institutions' : 'Sync all'}
              className={cn(appTitleBarRecipes.settingsIdle)}
              title={
                syncingAll
                  ? 'Syncing all institutions'
                  : !isOnline
                    ? 'Unavailable while offline'
                    : 'Sync all'
              }
            >
              <RefreshCw className={cn(syncingAll && 'animate-spin')} />
            </IconButton>
          )}
          <MenuDropdown
            trigger={
              <IconButton
                type="button"
                variant="ghost"
                size="md"
                className={cn(appTitleBarRecipes.settingsIdle)}
                disabled={isExporting || !isOnline}
                aria-label={isExporting ? 'Exporting all institutions' : 'Export All'}
                title={
                  isExporting
                    ? 'Export all in progress'
                    : !isOnline
                      ? 'Unavailable while offline'
                      : 'Export all'
                }
              >
                <Download className={cn(isExporting && 'animate-pulse')} />
              </IconButton>
            }
          >
            <MenuItem onClick={() => void exportAccounts('csv')}>Export as CSV</MenuItem>
            <MenuItem onClick={() => void exportAccounts('ofx')}>Export as OFX</MenuItem>
          </MenuDropdown>
        </div>
        <ConnectButton
          onClick={handlePrimaryConnect}
          disabled={connectDisabled}
          title={!isOnline ? 'Unavailable while offline' : undefined}
        >
          {connectAccountLabel}
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

  const statsGrid = <AccountsSummaryStats summary={summary} lastSyncValue={lastSyncValue} />;
  const showConnectionsList =
    !showProviderPicker && (banksWithSync.length > 0 || showSimpleFinIgnoredList);

  return (
    <div data-testid="accounts-page">
      <div hidden>
        {connectionFlow.connectionMount}
        {plaidPickerConnectionFlow.connectionMount}
        {tellerPickerConnectionFlow.connectionMount}
      </div>
      <PageLayout
        hideHero={showProviderPicker}
        title="Unite your accounts"
        subtitle="Securely link and sync accounts on-demand, view balances, and import or export your data any time."
        actions={actions}
        stats={statsGrid}
      >
        {showProviderPicker ? (
          <ProviderSelectionPanel
            loading={providerCatalog.loading}
            error={providerCatalog.error}
            availableProviders={providerCatalog.availableProviders}
            visibleProviders={pickerVisibleProviders}
            tellerApplicationId={providerCatalog.tellerApplicationId}
            providerReadyState={pickerProviderReadyState}
            connectingProvider={activePickerConnectingProvider}
            onSelectProvider={(provider) => void startProviderPickerConnection(provider)}
            onClose={() => setIsProviderPickerOpen(false)}
            isOnline={isOnline}
          />
        ) : null}
        {showConnectionsList ? (
          <ConnectionsList
            banks={banksWithSync}
            onConnect={handlePrimaryConnect}
            onSync={syncBank}
            onDisconnect={disconnect}
            onAddAccount={(bank) => {
              const existingAccounts = Object.values(accountFilter.accountsByBank)
                .flat()
                .filter((account) => account.connection_id === bank.connectionId)
                .map((account) => ({
                  name: account.name,
                  mask: account.mask,
                }));

              openDiyInstitutionModal({
                connectionId: bank.connectionId,
                institutionName: bank.name,
                existingAccounts,
              });
            }}
            onExport={exportAccounts}
            isExporting={isExporting}
            isOnline={isOnline}
            providerName={`${providerLabel} accounts`}
            connectLabel={connectAccountLabel}
            onImportSuccess={handleImportSuccess}
            emptyState={connectionsEmptyState}
          />
        ) : null}

        <ToastStack
          transients={accountsToastStack.transients}
          pinnedToast={accountsToastStack.pinnedToast}
          onDismissTransient={accountsToastStack.dismissTransient}
          onDismissPinned={accountsToastStack.dismissPinned}
        />
        <SyncInstitutionStatusToast
          row={syncInstitutionRow}
          onClose={dismissSyncInstitutionToast}
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
      <DiyInstitutionModal
        isOpen={diyModalTarget !== null}
        connectionId={diyModalTarget?.connectionId ?? null}
        institutionName={diyModalTarget?.institutionName ?? null}
        existingInstitutionNames={existingInstitutionNames}
        existingInstitutionAccounts={diyModalTarget?.existingAccounts ?? []}
        onClose={closeDiyInstitutionModal}
        onComplete={handleDiyInstitutionComplete}
      />
      <DemoExitWarningModal
        isOpen={demoExitWarningOpen}
        onConfirm={handleDemoExitConfirm}
        onCancel={handleDemoExitCancel}
      />
    </div>
  );
};

export default AccountsPage;
