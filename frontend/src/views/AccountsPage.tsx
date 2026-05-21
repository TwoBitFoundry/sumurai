import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Button, cn } from '@/ui/primitives';
import { appTitleBarRecipes } from '@/ui/primitives/AppTitleBar';
import { control, text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import { Toast } from '../components/Toast';
import AccountsSummaryStats from '../features/plaid/components/AccountsSummaryStats';
import ConnectButton from '../features/plaid/components/ConnectButton';
import ConnectionsList, {
  type BankConnectionViewModel,
} from '../features/plaid/components/ConnectionsList';
import { useAccountFilter } from '../hooks/useAccountFilter';
import { useFinancialConnection } from '../hooks/useFinancialConnection';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePlaidConnections } from '../hooks/usePlaidConnections';
import { useProviderCatalog } from '../hooks/useProviderCatalog';
import { PageLayout } from '../layouts/PageLayout';
import { PlaidService } from '../services/PlaidService';
import { TellerService } from '../services/TellerService';
import { invalidateStaleCacheQueries, type SyncProvider } from '../utils/queryInvalidation';

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
  const banks = useMemo(
    () =>
      Object.entries(accountFilter.accountsByBank).map(([bankName, accounts]) => {
        const connectionId =
          accounts.find((account) => account.connection_id)?.connection_id ?? null;
        const provider = accounts[0]?.provider ?? 'plaid';

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
          })),
        };
      }),
    [accountFilter.accountsByBank]
  );
  const primaryProvider = useMemo(
    () =>
      providerCatalog.resolveConnectProvider(
        providerCatalog.selectedProvider ??
          providerCatalog.defaultProvider ??
          (banks.length > 0 ? banks[0].provider : 'plaid')
      ),
    [
      banks,
      providerCatalog.defaultProvider,
      providerCatalog.resolveConnectProvider,
      providerCatalog.selectedProvider,
    ]
  );
  const providerLabel = primaryProvider === 'teller' ? 'Teller' : 'Plaid';

  const providersForSync = useMemo(() => {
    const providers = new Set<SyncProvider>([primaryProvider]);
    for (const bank of banks) {
      providers.add(bank.provider);
    }
    return providers;
  }, [banks, primaryProvider]);

  const plaidConnections = usePlaidConnections({
    enabled: providersForSync.has('plaid'),
  });
  const tellerStatusQuery = useQuery({
    queryKey: ['teller', 'connections'],
    queryFn: () => TellerService.getStatus(),
    enabled: providersForSync.has('teller'),
    staleTime: 5 * 60 * 1000,
  });

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

  const connectionFlow = useFinancialConnection({
    provider: primaryProvider,
    onError: (message) => onError?.(message),
    isOnline,
  });

  const [toast, setToast] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const flowError = banks.length > 0 ? connectionFlow.error : null;
  const invalidateBankCache = useCallback(
    async (provider: SyncProvider) => {
      await invalidateStaleCacheQueries(queryClient, [provider]);
    },
    [queryClient]
  );
  const invalidateBankCaches = useCallback(
    async (providers: SyncProvider[]) => {
      await invalidateStaleCacheQueries(queryClient, providers);
    },
    [queryClient]
  );

  const syncBank = useCallback(
    async (bankId: string) => {
      if (!isOnline) {
        return;
      }

      const bank = banks.find((entry) => entry.id === bankId);
      if (!bank?.connectionId) {
        return;
      }

      try {
        if (bank.provider === 'teller') {
          await TellerService.syncTransactions(bank.connectionId);
        } else {
          await PlaidService.syncTransactions(bank.connectionId);
        }
        await invalidateBankCache(bank.provider);
        setToast(`Sync started for ${bank.name}`);
      } catch (error) {
        console.warn('Failed to sync bank', error);
        onError?.('Failed to sync bank');
      }
    },
    [banks, invalidateBankCache, isOnline, onError]
  );

  const syncAll = useCallback(async () => {
    if (!isOnline) {
      return;
    }

    setSyncingAll(true);
    try {
      const providers = new Set<SyncProvider>();
      for (const bank of banks) {
        if (!bank.connectionId) continue;
        providers.add(bank.provider);
        if (bank.provider === 'teller') {
          await TellerService.syncTransactions(bank.connectionId);
        } else {
          await PlaidService.syncTransactions(bank.connectionId);
        }
      }
      await invalidateBankCaches(Array.from(providers));
      setToast('Sync started for all banks');
    } catch (error) {
      console.warn('Failed to sync all banks', error);
      onError?.('Failed to sync all banks');
    } finally {
      setSyncingAll(false);
    }
  }, [banks, invalidateBankCaches, isOnline, onError]);

  const disconnect = useCallback(
    async (bankId: string) => {
      const bank = banks.find((entry) => entry.id === bankId);
      if (!bank?.connectionId) {
        return;
      }

      try {
        if (bank.provider === 'teller') {
          await TellerService.disconnect(bank.connectionId);
        } else {
          await PlaidService.disconnect(bank.connectionId);
        }
        await invalidateBankCache(bank.provider);
        setToast(`${bank.name} disconnected successfully`);
      } catch (error) {
        console.warn('Failed to disconnect bank', error);
        onError?.('Failed to disconnect bank');
      }
    },
    [banks, invalidateBankCache, onError]
  );

  const handleImportSuccess = useCallback((count: number, mask: string) => {
    setToast(`Imported ${count} transactions for ••${mask}`);
  }, []);

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
          : 'Awaiting first sync';
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
          onClick={() => void connectionFlow.initiateConnection()}
          disabled={connectDisabled}
          title={!isOnline ? 'Unavailable while offline' : undefined}
          leadingImageSrc={primaryProvider === 'teller' ? '/teller.webp' : '/plaid.webp'}
        >
          {primaryProvider === 'teller' ? 'Teller' : 'Add account'}
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
      flowError={flowError}
      summary={summary}
      syncingAll={syncingAll}
      lastSyncValue={lastSyncValue}
      lastSyncDetail={lastSyncDetail}
    />
  );

  return (
    <div data-testid="accounts-page">
      {connectionFlow.connectionMount}
      <PageLayout
        badge={`${providerLabel} Accounts`}
        title="Link accounts and keep balances current"
        subtitle="View cached balances and sync when you need fresh data."
        actions={actions}
        stats={statsGrid}
      >
        <ConnectionsList
          banks={banksWithSync}
          onConnect={() => void connectionFlow.initiateConnection()}
          onSync={syncBank}
          onDisconnect={disconnect}
          isOnline={isOnline}
          providerName={providerLabel === 'Teller' ? 'Teller accounts' : 'Plaid accounts'}
          connectLabel={primaryProvider === 'teller' ? 'Teller' : 'Connect with Plaid'}
          connectLogoSrc={primaryProvider === 'teller' ? '/teller.webp' : '/plaid.webp'}
          onImportSuccess={handleImportSuccess}
        />

        {toast ? <Toast message={toast} onClose={() => setToast(null)} /> : null}
      </PageLayout>
    </div>
  );
};

export default AccountsPage;
