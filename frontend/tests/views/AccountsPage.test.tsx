import { render, screen, within } from '@testing-library/react';
import { usePlaidLinkFlow } from '@/features/plaid/hooks/usePlaidLinkFlow';
import { useAccountFilter } from '@/hooks/useAccountFilter';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useTellerLinkFlow } from '@/hooks/useTellerLinkFlow';
import { useTellerProviderInfo } from '@/hooks/useTellerProviderInfo';
import AccountsPage from '@/views/AccountsPage';

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
    jest.mocked(usePlaidLinkFlow).mockReturnValue({
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
    });
    jest.mocked(useTellerLinkFlow).mockReturnValue({
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
    });
  });

  it('keeps the Teller accounts page available while offline', () => {
    render(<AccountsPage />);

    expect(screen.getByTestId('accounts-page')).toBeInTheDocument();
    expect(screen.getByText('Link banks and keep balances current')).toBeVisible();
    expect(screen.getByText('Unavailable while offline')).toBeVisible();
    expect(screen.getAllByRole('button', { name: /launch teller connect/i })[0]).toBeDisabled();
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
    jest.mocked(useTellerLinkFlow).mockReturnValue({
      connections: [{ connectionId: 'conn_1', lastSyncAt: null }],
      loading: false,
      error: null,
      toast: null,
      setToast: jest.fn(),
      connect: jest.fn(),
      syncOne: jest.fn(),
      syncAll: jest.fn(),
      disconnect: jest.fn(),
      syncingAll: false,
    });

    render(<AccountsPage />);

    const heroSection = screen.getByRole('heading', { name: /link banks/i }).closest('section');
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

    jest.mocked(useTellerLinkFlow).mockReturnValueOnce({
      connections: [],
      loading: false,
      error: 'Failed to load connections',
      toast: null,
      setToast: jest.fn(),
      connect: jest.fn(),
      syncOne: jest.fn(),
      syncAll: jest.fn(),
      disconnect: jest.fn(),
      syncingAll: false,
    });

    render(<AccountsPage />);

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

    render(<AccountsPage />);

    expect(screen.getByText('55 items')).toBeVisible();
  });
});
