import { AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { Toast } from '@/components/Toast';
import AccountsSummaryStats from '@/features/plaid/components/AccountsSummaryStats';
import ConnectButton from '@/features/plaid/components/ConnectButton';
import ConnectionsList from '@/features/plaid/components/ConnectionsList';
import ProviderSelectionPanel from '@/features/plaid/components/ProviderSelectionPanel';
import { PageLayout } from '@/layouts/PageLayout';
import { sampleBankConnections } from '@/storybook/fixtures/plaid';
import { cn } from '@/ui/primitives';
import { designTokens } from '@/ui/tokens';
import { budgetTokenRecipes } from '../../features/budgets/tokenRecipes';

export function AccountsProviderPickerSlice() {
  return (
    <ProviderSelectionPanel
      loading={false}
      error={null}
      selectedProvider={null}
      availableProviders={['plaid', 'teller']}
      selectingProvider={null}
      onSelectProvider={async () => {}}
    />
  );
}

export function AccountsProviderPickerLoadingSlice() {
  return (
    <ProviderSelectionPanel
      loading
      error={null}
      selectedProvider={null}
      availableProviders={['plaid', 'teller']}
      selectingProvider={null}
      onSelectProvider={async () => {}}
    />
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

  const syncButtonClasses = cn(budgetTokenRecipes.actions.accountsToolbar);

  const actions = (
    <>
      {!props.connectionsEmpty ? (
        <button type="button" className={syncButtonClasses}>
          <RefreshCw className={`h-4 w-4 ${props.syncingAll ? 'animate-spin' : ''}`} />
          {props.syncingAll ? 'Syncing...' : 'Sync all'}
        </button>
      ) : null}
      <ConnectButton onClick={() => {}} disabled={false}>
        Add account
      </ConnectButton>
    </>
  );

  const statsGrid = (
    <AccountsSummaryStats
      flowError={props.flowError ?? null}
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
        title="Link banks and keep balances current"
        subtitle="Securely connect institutions with Plaid. Your credentials never touch Sumurai and you can revoke access at any time."
        actions={actions}
        stats={statsGrid}
      >
        <ConnectionsList
          banks={banks}
          onConnect={() => {}}
          onSync={async () => {}}
          onDisconnect={async () => {}}
        />
        <AnimatePresence>
          {props.toastMessage ? <Toast message={props.toastMessage} onClose={() => {}} /> : null}
        </AnimatePresence>
      </PageLayout>
    </div>
  );
}
