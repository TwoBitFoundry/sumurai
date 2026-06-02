import { RefreshCw } from 'lucide-react';
import { Toast } from '@/components/Toast';
import AccountsSummaryStats from '@/features/plaid/components/AccountsSummaryStats';
import ConnectButton from '@/features/plaid/components/ConnectButton';
import ConnectionsList from '@/features/plaid/components/ConnectionsList';
import ProviderSelectionPanel from '@/features/plaid/components/ProviderSelectionPanel';
import { PageLayout } from '@/layouts/PageLayout';
import { sampleBankConnections } from '@/storybook/fixtures/plaid';
import { storyProviderPickerPanelProps } from '@/storybook/fixtures/providerPicker';
import type { FinancialProvider } from '@/types/api';
import { Button, cn } from '@/ui/primitives';
import { appTitleBarRecipes } from '@/ui/primitives/AppTitleBar';
import { font as uiTypographyRecipes } from '@/ui/recipes';

type ProviderPickerSliceProps = {
  loading?: boolean;
  error?: string | null;
  connectingProvider?: FinancialProvider | null;
  onSelectProvider?: (provider: FinancialProvider) => void | Promise<void>;
};

export function AccountsProviderPickerSlice({
  loading = false,
  error = null,
  connectingProvider = null,
  onSelectProvider = async () => {},
}: ProviderPickerSliceProps = {}) {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <ProviderSelectionPanel
        {...storyProviderPickerPanelProps}
        loading={loading}
        error={error}
        connectingProvider={connectingProvider}
        onSelectProvider={onSelectProvider}
      />
    </div>
  );
}

export function AccountsConnectedScreenSlice(props: {
  flowError?: string | null;
  toastMessage?: string | null;
  connectionsEmpty?: boolean;
  syncingAll?: boolean;
}) {
  const banks = props.connectionsEmpty ? [] : sampleBankConnections;
  const summary = {
    institutions: props.connectionsEmpty ? 0 : 2,
    connectedInstitutions: props.connectionsEmpty ? 0 : 2,
    accounts: props.connectionsEmpty ? 0 : 5,
    latestSync: props.connectionsEmpty ? null : '2026-05-01T12:00:00.000Z',
  };

  const actions = (
    <>
      {!props.connectionsEmpty ? (
        <Button
          type="button"
          variant="ghost"
          size="md"
          className={cn(
            appTitleBarRecipes.settingsIdle,
            'normal-case',
            uiTypographyRecipes.bodyStrong,
            'px-5'
          )}
        >
          <RefreshCw className={cn(props.syncingAll && 'animate-spin')} />
          {props.syncingAll ? 'Syncing...' : 'Sync all'}
        </Button>
      ) : null}
      <ConnectButton onClick={() => {}} disabled={false}>
        Add account
      </ConnectButton>
    </>
  );

  const statsGrid = (
    <AccountsSummaryStats
      summary={summary}
      syncingAll={props.syncingAll ?? false}
      lastSyncValue={props.syncingAll ? 'Syncing...' : '12m ago'}
      lastSyncDetail={props.syncingAll ? 'Sync in progress' : 'Balances refreshed from Story Bank'}
    />
  );

  return (
    <div data-testid="accounts-page">
      <PageLayout
        badge="Plaid Accounts"
        title="Sworn accounts & allies"
        subtitle="Bind your financial houses. Link institutions and keep every balance true."
        actions={actions}
        stats={statsGrid}
      >
        <ConnectionsList
          banks={banks}
          onConnect={() => {}}
          onSync={async () => {}}
          onDisconnect={async () => {}}
          isOnline
        />
        {props.toastMessage ? <Toast message={props.toastMessage} onClose={() => {}} /> : null}
      </PageLayout>
    </div>
  );
}
