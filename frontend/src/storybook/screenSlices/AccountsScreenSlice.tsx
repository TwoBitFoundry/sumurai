import { RefreshCw } from 'lucide-react';
import { Toast } from '@/components/Toast';
import AccountsSummaryStats from '@/features/plaid/components/AccountsSummaryStats';
import ConnectButton from '@/features/plaid/components/ConnectButton';
import ConnectionsList from '@/features/plaid/components/ConnectionsList';
import ProviderSelectionPanel from '@/features/plaid/components/ProviderSelectionPanel';
import { PageLayout } from '@/layouts/PageLayout';
import { sampleBankConnections } from '@/storybook/fixtures/plaid';
import { Button, cn } from '@/ui/primitives';
import { appTitleBarRecipes } from '@/ui/primitives/AppTitleBar';
import { font as uiTypographyRecipes } from '@/ui/recipes';

export function AccountsProviderPickerSlice() {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <ProviderSelectionPanel
        loading={false}
        error={null}
        availableProviders={['plaid', 'teller']}
        tellerApplicationId="story-teller-app"
        selectingProvider={null}
        onSelectProvider={async () => {}}
      />
    </div>
  );
}

export function AccountsProviderPickerLoadingSlice() {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <ProviderSelectionPanel
        loading
        error={null}
        availableProviders={['plaid', 'teller']}
        tellerApplicationId="story-teller-app"
        selectingProvider={null}
        onSelectProvider={async () => {}}
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
        title="Link accounts and keep balances current"
        subtitle="Securely connect institutions with Plaid. Your credentials never touch Sumurai and you can revoke access at any time."
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
