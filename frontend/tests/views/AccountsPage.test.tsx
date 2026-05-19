import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import type { UsePlaidLinkFlowResult } from '@/features/plaid/hooks/usePlaidLinkFlow';
import { usePlaidLinkFlow } from '@/features/plaid/hooks/usePlaidLinkFlow';
import { useAccountFilter } from '@/hooks/useAccountFilter';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import type { PlaidConnection } from '@/hooks/usePlaidConnections';
import { type UseTellerLinkFlowResult, useTellerLinkFlow } from '@/hooks/useTellerLinkFlow';
import { useTellerProviderInfo } from '@/hooks/useTellerProviderInfo';
import AccountsPage from '@/views/AccountsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function renderAccountsPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <AccountsPage />
    </QueryClientProvider>
  );
}

function makePlaidLinkFlowMock(
  overrides: Partial<UsePlaidLinkFlowResult> = {}
): UsePlaidLinkFlowResult {
  const base: UsePlaidLinkFlowResult = {
    connections: [],
    loading: false,
    error: null,
    toast: null,
    setToast: jest.fn(),
    connect: jest.fn(),
    syncOne: jest.fn(),
    syncAll: jest.fn(),
    disconnect: jest.fn(),
    syncingAll: false,
    plaidLinkMount: null,
  };
  return { ...base, ...overrides };
}

function makeTellerLinkFlowMock(
  overrides: Partial<UseTellerLinkFlowResult> = {}
): UseTellerLinkFlowResult {
  const base: UseTellerLinkFlowResult = {
    connections: [],
    loading: false,
    error: null,
    toast: null,
    setToast: jest.fn(),
    connect: jest.fn(),
    syncOne: jest.fn(),
    syncAll: jest.fn(),
    disconnect: jest.fn(),
    syncingAll: false,
    tellerConnectMount: null,
  };
  return { ...base, ...overrides };
}

function minimalConnection(
  partial: Pick<PlaidConnection, 'connectionId'> & Partial<Omit<PlaidConnection, 'connectionId'>>
): PlaidConnection {
  const id = partial.id ?? partial.connectionId;
  return {
    id,
    connectionId: partial.connectionId,
    institutionName: partial.institutionName ?? 'Demo Bank',
    lastSyncAt: partial.lastSyncAt ?? null,
    transactionCount: partial.transactionCount ?? 0,
    accountCount: partial.accountCount ?? 0,
    syncInProgress: partial.syncInProgress ?? false,
    isConnected: partial.isConnected ?? true,
    accounts: partial.accounts ?? [],
  };
}

jest.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: jest.fn(),
}));

jest.mock('@/hooks/useTellerProviderInfo', () => ({
  useTellerProviderInfo: jest.fn(),
}));

jest.mock('@/hooks/useAccountFilter', () => ({
  useAccountFilter: jest.fn(),
}));

jest.mock('@/features/plaid/hooks/usePlaidLinkFlow', () => ({
  usePlaidLinkFlow: jest.fn(),
}));

jest.mock('@/hooks/useTellerLinkFlow', () => ({
  useTellerLinkFlow: jest.fn(),
}));

describe('AccountsPage', () => {
  beforeEach(() => {
    jest.mocked(useOnlineStatus).mockReturnValue(false);
    jest.mocked(useTellerProviderInfo).mockReturnValue({
      loading: false,
      error: null,
      availableProviders: ['plaid', 'teller'],
      selectedProvider: 'teller',
      defaultProvider: 'teller',
      userProvider: 'teller',
      tellerApplicationId: 'app_123',
      tellerEnvironment: 'development',
      refresh: jest.fn(),
      chooseProvider: jest.fn(),
    });
    jest.mocked(useAccountFilter).mockReturnValue({
      selectedAccountIds: [],
      allAccountIds: [],
      isAllAccountsSelected: false,
      accountsByBank: {},
      loading: false,
      setSelectedAccountIds: jest.fn(),
      toggleBank: jest.fn(),
      toggleAccount: jest.fn(),
      removeAccountsByIds: jest.fn(),
    });
    jest.mocked(usePlaidLinkFlow).mockReturnValue(makePlaidLinkFlowMock());
    jest.mocked(useTellerLinkFlow).mockReturnValue(makeTellerLinkFlowMock());
  });

  it('keeps the Teller accounts page available while offline', () => {
    renderAccountsPage();

    expect(screen.getByTestId('accounts-page')).toBeInTheDocument();
    expect(screen.getByText('Link accounts and keep balances current')).toBeVisible();
    expect(screen.getByText('Unavailable while offline')).toBeVisible();
    const tellerButton = screen.getAllByRole('button', { name: /^teller$/i })[0];
    expect(tellerButton).toBeDisabled();
    expect(tellerButton.querySelector('img')).toHaveAttribute('src', '/teller.webp');
  });

  it('shows Offline on sync when offline with linked institutions', () => {
    jest.mocked(useAccountFilter).mockReturnValue({
      selectedAccountIds: ['acc_1'],
      allAccountIds: ['acc_1'],
      isAllAccountsSelected: true,
      accountsByBank: {
        'Demo Bank': [
          {
            id: 'acc_1',
            name: 'Checking',
            account_type: 'depository',
            balance_ledger: 100,
            balance_available: 100,
            mask: '1234',
            provider: 'teller',
            institution_name: 'Demo Bank',
            connection_id: 'conn_1',
            transaction_count: 0,
          },
        ],
      },
      loading: false,
      setSelectedAccountIds: jest.fn(),
      toggleBank: jest.fn(),
      toggleAccount: jest.fn(),
      removeAccountsByIds: jest.fn(),
    });
    jest.mocked(useTellerLinkFlow).mockReturnValue(
      makeTellerLinkFlowMock({
        connections: [minimalConnection({ connectionId: 'conn_1', lastSyncAt: null })],
      })
    );

    renderAccountsPage();

    const heroSection = screen
      .getByRole('heading', { name: /link accounts and keep balances current/i })
      .closest('section');
    expect(heroSection).toBeTruthy();
    expect(
      within(heroSection as HTMLElement).getByRole('button', { name: /^offline$/i })
    ).toBeDisabled();
    expect(screen.getByText('Unavailable while offline')).toBeVisible();
  });

  it('does not show a load error when no accounts are connected', () => {
    jest.mocked(useAccountFilter).mockReturnValueOnce({
      selectedAccountIds: [],
      allAccountIds: [],
      isAllAccountsSelected: false,
      accountsByBank: {},
      loading: false,
      setSelectedAccountIds: jest.fn(),
      toggleBank: jest.fn(),
      toggleAccount: jest.fn(),
      removeAccountsByIds: jest.fn(),
    });

    jest.mocked(useTellerLinkFlow).mockReturnValueOnce(
      makeTellerLinkFlowMock({
        error: 'Failed to load connections',
      })
    );

    renderAccountsPage();

    expect(screen.queryByTestId('accounts-flow-error')).not.toBeInTheDocument();
  });

  it('shows per-account transaction counts from the filter for Plaid', () => {
    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useTellerProviderInfo).mockReturnValue({
      loading: false,
      error: null,
      availableProviders: ['plaid', 'teller'],
      selectedProvider: 'plaid',
      defaultProvider: 'plaid',
      userProvider: 'plaid',
      tellerApplicationId: null,
      tellerEnvironment: 'development',
      refresh: jest.fn(),
      chooseProvider: jest.fn(),
    });
    jest.mocked(useAccountFilter).mockReturnValue({
      selectedAccountIds: ['acc_plaid_1'],
      allAccountIds: ['acc_plaid_1'],
      isAllAccountsSelected: true,
      accountsByBank: {
        'Demo Bank': [
          {
            id: 'acc_plaid_1',
            name: 'Checking',
            account_type: 'depository',
            balance_ledger: 100,
            balance_available: 100,
            mask: '1234',
            provider: 'plaid',
            institution_name: 'Demo Bank',
            connection_id: 'conn_plaid',
            transaction_count: 55,
          },
        ],
      },
      loading: false,
      setSelectedAccountIds: jest.fn(),
      toggleBank: jest.fn(),
      toggleAccount: jest.fn(),
      removeAccountsByIds: jest.fn(),
    });

    renderAccountsPage();

    expect(screen.getByText('55 items')).toBeVisible();
  });

  it('renders the Plaid accounts button with the Plaid logo', () => {
    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useTellerProviderInfo).mockReturnValue({
      loading: false,
      error: null,
      availableProviders: ['plaid', 'teller'],
      selectedProvider: 'plaid',
      defaultProvider: 'plaid',
      userProvider: 'plaid',
      tellerApplicationId: null,
      tellerEnvironment: 'development',
      refresh: jest.fn(),
      chooseProvider: jest.fn(),
    });

    renderAccountsPage();

    const plaidButton = screen.getByRole('button', { name: /^add account$/i });
    expect(plaidButton.querySelector('img')).toHaveAttribute('src', '/plaid.webp');
  });

  it('renders Teller current balances on the accounts page', () => {
    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useTellerProviderInfo).mockReturnValue({
      loading: false,
      error: null,
      availableProviders: ['plaid', 'teller'],
      selectedProvider: 'teller',
      defaultProvider: 'teller',
      userProvider: 'teller',
      tellerApplicationId: 'app_123',
      tellerEnvironment: 'development',
      refresh: jest.fn(),
      chooseProvider: jest.fn(),
    });
    jest.mocked(useAccountFilter).mockReturnValue({
      selectedAccountIds: ['acc_teller_1'],
      allAccountIds: ['acc_teller_1'],
      isAllAccountsSelected: true,
      accountsByBank: {
        'Demo Bank': [
          {
            id: 'acc_teller_1',
            name: 'Checking',
            account_type: 'depository',
            balance_current: 1234.56,
            balance_ledger: null,
            balance_available: null,
            mask: '1234',
            provider: 'teller',
            institution_name: 'Demo Bank',
            connection_id: 'conn_teller',
            transaction_count: 7,
          },
        ],
      },
      loading: false,
      setSelectedAccountIds: jest.fn(),
      toggleBank: jest.fn(),
      toggleAccount: jest.fn(),
      removeAccountsByIds: jest.fn(),
    });

    renderAccountsPage();

    expect(screen.getByText('$1,234.56')).toBeVisible();
    expect(screen.queryByText('PLACEHOLDER')).not.toBeInTheDocument();
  });
});
