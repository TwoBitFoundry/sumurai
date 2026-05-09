import { AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/ui/primitives';
import {
  font as primitiveTypographyRecipes,
  border as semanticBorders,
  effect as semanticEffects,
  surface as semanticSurfaces,
} from '@/ui/recipes';
import { designTokens } from '@/ui/tokens';
import { Toast } from '../components/Toast';
import AccountsSummaryStats from '../features/plaid/components/AccountsSummaryStats';
import ConnectButton from '../features/plaid/components/ConnectButton';
import ConnectionsList from '../features/plaid/components/ConnectionsList';
import ProviderSelectionPanel from '../features/plaid/components/ProviderSelectionPanel';
import { usePlaidLinkFlow } from '../features/plaid/hooks/usePlaidLinkFlow';
import { useTellerLinkFlow } from '../hooks/useTellerLinkFlow';
import { useTellerProviderInfo } from '../hooks/useTellerProviderInfo';
import { PageLayout } from '../layouts/PageLayout';
import type { FinancialProvider } from '../types/api';

const syncButtonClasses = cn(
  'inline-flex items-center gap-2 rounded-full px-5 py-2',
  ...semanticBorders.control,
  ...semanticSurfaces.card,
  primitiveTypographyRecipes.bodyStrong,
  designTokens.text.body,
  ...semanticEffects.glassShadow,
  'transition-all duration-200 hover:-translate-y-[1px]',
  ...semanticBorders.hoverAccent,
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus-active)] focus-visible:ring-offset-2 focus-visible:ring-offset-white',
  'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none',
  'dark:focus-visible:ring-offset-slate-900'
);

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

const AccountsPage = ({ onError }: AccountsPageProps) => {
  const providerInfo = useTellerProviderInfo();
  const selectedProvider = providerInfo.selectedProvider;
  const providerLoading = providerInfo.loading;
  const providerError = providerInfo.error;
  const [selectingProvider, setSelectingProvider] = useState<FinancialProvider | null>(null);

  useEffect(() => {
    if (providerError) {
      onError?.(providerError);
    } else if (!providerLoading && selectedProvider) {
      onError?.(null);
    }
  }, [onError, providerError, providerLoading, selectedProvider]);

  const plaidFlow = usePlaidLinkFlow({ onError, enabled: selectedProvider === 'plaid' });
  const tellerFlow = useTellerLinkFlow({
    applicationId: providerInfo.tellerApplicationId,
    environment: providerInfo.tellerEnvironment,
    onError,
    enabled: selectedProvider === 'teller',
  });

  const flow = selectedProvider === 'teller' ? tellerFlow : plaidFlow;

  const {
    connections,
    toast,
    setToast,
    connect,
    syncOne,
    syncAll,
    disconnect,
    syncingAll,
    loading: flowLoading,
    error: flowError,
  } = flow;

  const handleProviderSelect = useCallback(
    async (provider: FinancialProvider) => {
      setSelectingProvider(provider);
      try {
        await providerInfo.chooseProvider(provider);
      } catch (err) {
        console.warn('Failed to select provider', err);
        onError?.('Failed to select provider');
      } finally {
        setSelectingProvider(null);
      }
    },
    [onError, providerInfo]
  );

  const banks = useMemo(
    () =>
      (connections || []).map((conn) => ({
        id: conn.connectionId,
        name: conn.institutionName,
        short: conn.institutionName
          .split(' ')
          .map((word) => word[0])
          .join('')
          .slice(0, 2)
          .toUpperCase(),
        status: conn.isConnected ? ('connected' as const) : ('error' as const),
        lastSync: conn.lastSyncAt,
        accounts: conn.accounts,
      })),
    [connections]
  );

  const summary = useMemo(() => {
    let connectedInstitutions = 0;
    let totalAccounts = 0;
    let latestSyncIso: string | null = null;
    let latestSyncTime = 0;

    for (const bank of banks) {
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
      institutions: banks.length,
      connectedInstitutions,
      accounts: totalAccounts,
      latestSync: latestSyncIso,
    };
  }, [banks]);

  if (providerLoading || providerError || !selectedProvider) {
    return (
      <ProviderSelectionPanel
        loading={providerLoading}
        error={providerError}
        selectedProvider={selectedProvider}
        availableProviders={providerInfo.availableProviders}
        selectingProvider={selectingProvider}
        onSelectProvider={handleProviderSelect}
      />
    );
  }

  const providerLabel = selectedProvider === 'plaid' ? 'Plaid' : 'Teller';
  const providerDescription =
    selectedProvider === 'plaid'
      ? 'Securely connect institutions with Plaid. Your credentials never touch Sumurai and you can revoke access at any time.'
      : 'Launch Teller Connect to link accounts using your own Teller credentials. Connections stay in your control and can be revoked instantly.';

  const syncFooter =
    selectedProvider === 'plaid'
      ? 'Plaid keeps credentials read-only and disconnectable anytime.'
      : 'Teller connections respect your API keys and can be rotated from your Teller dashboard.';

  const connectDisabled =
    flowLoading ||
    selectingProvider !== null ||
    (selectedProvider === 'teller' && !providerInfo.tellerApplicationId);

  const lastSyncValue = syncingAll
    ? 'Syncing...'
    : flowLoading
      ? 'Loading...'
      : summary.latestSync
        ? formatRelativeTime(summary.latestSync)
        : 'Awaiting first sync';
  const lastSyncDetail = summary.latestSync
    ? `Refreshed ${formatAbsoluteTime(summary.latestSync)}`
    : syncFooter;

  const actions = (
    <>
      {summary.institutions > 0 && (
        <button
          type="button"
          onClick={syncAll}
          disabled={syncingAll || flowLoading}
          className={syncButtonClasses}
        >
          <RefreshCw className={`h-4 w-4 ${syncingAll ? 'animate-spin' : ''}`} />
          {syncingAll ? 'Syncing...' : 'Sync all'}
        </button>
      )}
      <ConnectButton onClick={connect} disabled={connectDisabled}>
        {selectedProvider === 'teller' ? 'Launch Teller Connect' : 'Add account'}
      </ConnectButton>
    </>
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
      <PageLayout
        badge={`${providerLabel} Accounts`}
        title="Link banks and keep balances current"
        subtitle={providerDescription}
        actions={actions}
        stats={statsGrid}
      >
        <ConnectionsList
          banks={banks}
          onConnect={connect}
          onSync={syncOne}
          onDisconnect={disconnect}
        />

        <AnimatePresence>
          {toast && <Toast message={toast} onClose={() => setToast(null)} />}
        </AnimatePresence>
      </PageLayout>
    </div>
  );
};

export default AccountsPage;
