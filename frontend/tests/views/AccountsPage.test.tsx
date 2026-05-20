import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeProviderCatalogMock } from '@tests/utils/providerCatalogMocks';
import { useAccountFilter } from '@/hooks/useAccountFilter';
import {
  type UseFinancialConnectionReturn,
  useFinancialConnection,
} from '@/hooks/useFinancialConnection';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useProviderCatalog } from '@/hooks/useProviderCatalog';
import { isProviderConnectable } from '@/utils/providerCapabilities';
import AccountsPage from '@/views/AccountsPage';
import { ThemeTestProvider } from '../utils/ThemeTestProvider';

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
    <ThemeTestProvider>
      <QueryClientProvider client={queryClient}>
        <AccountsPage />
      </QueryClientProvider>
    </ThemeTestProvider>
  );
}

function makeFinancialConnectionMock(
  overrides: Partial<UseFinancialConnectionReturn> = {}
): UseFinancialConnectionReturn {
  return {
    isConnected: false,
    connectionInProgress: false,
    isSyncing: false,
    institutionName: null,
    error: null,
    initiateConnection: jest.fn(),
    retryConnection: jest.fn(),
    reset: jest.fn(),
    setError: jest.fn(),
    connectionMount: null,
    ...overrides,
  };
}

jest.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: jest.fn(),
}));

jest.mock('@/hooks/useProviderCatalog', () => ({
  useProviderCatalog: jest.fn(),
}));

jest.mock('@/hooks/useFinancialConnection', () => ({
  useFinancialConnection: jest.fn(),
}));

jest.mock('@/hooks/useAccountFilter', () => ({
  useAccountFilter: jest.fn(),
}));

jest.mock('@/features/import/components/ImportModal', () => ({
  ImportModal: ({
    account,
    isOpen,
    onClose,
    onImportSuccess,
  }: {
    account: { mask: string };
    isOpen: boolean;
    onClose: () => void;
    onImportSuccess?: (count: number, mask: string) => void;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label="Import transactions">
        <button
          type="button"
          onClick={() => {
            onImportSuccess?.(5, account.mask);
            onClose();
          }}
        >
          Finish mocked import
        </button>
      </div>
    ) : null,
}));

describe('AccountsPage', () => {
  beforeEach(() => {
    jest.mocked(useOnlineStatus).mockReturnValue(false);
    jest.mocked(useProviderCatalog).mockReturnValue(
      makeProviderCatalogMock({
        available_providers: ['plaid', 'teller'],
        default_provider: 'teller',
        user_provider: 'teller',
        teller_application_id: 'app_123',
      })
    );
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
    jest.mocked(useFinancialConnection).mockReturnValue(makeFinancialConnectionMock());
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

    jest.mocked(useFinancialConnection).mockReturnValueOnce(
      makeFinancialConnectionMock({
        error: 'Failed to load connections',
      })
    );

    renderAccountsPage();

    expect(screen.queryByTestId('accounts-flow-error')).not.toBeInTheDocument();
  });

  it('shows per-account transaction counts from the filter for Plaid', () => {
    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useProviderCatalog).mockReturnValue(
      makeProviderCatalogMock({
        available_providers: ['plaid', 'teller'],
        default_provider: 'plaid',
        user_provider: 'plaid',
      })
    );
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
    jest.mocked(useProviderCatalog).mockReturnValue(
      makeProviderCatalogMock({
        available_providers: ['plaid', 'teller'],
        default_provider: 'plaid',
        user_provider: 'plaid',
      })
    );

    renderAccountsPage();

    const plaidButton = screen.getByRole('button', { name: /^add account$/i });
    expect(plaidButton.querySelector('img')).toHaveAttribute('src', '/plaid.webp');
  });

  it('renders Teller current balances on the accounts page', () => {
    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useProviderCatalog).mockReturnValue(
      makeProviderCatalogMock({
        available_providers: ['plaid', 'teller'],
        default_provider: 'teller',
        user_provider: 'teller',
        teller_application_id: 'app_123',
      })
    );
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

  it('enables plaid connect when provider catalog is unavailable', () => {
    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useProviderCatalog).mockReturnValue(
      makeProviderCatalogMock(
        {
          available_providers: ['plaid', 'teller'],
          default_provider: 'plaid',
          user_provider: 'plaid',
        },
        {
          error: 'Unable to load provider configuration',
          availableProviders: [],
          selectedProvider: 'plaid',
          defaultProvider: 'plaid',
          userProvider: 'plaid',
          canConnectWith: (provider) => isProviderConnectable(provider, null),
          getConnectBlockedReason: () => null,
          resolveConnectProvider: (preferred) => preferred,
        }
      )
    );

    renderAccountsPage();

    expect(screen.getByRole('button', { name: /^add account$/i })).toBeEnabled();
  });

  it('falls back to plaid connect when teller is selected but not configured', () => {
    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useProviderCatalog).mockReturnValue(
      makeProviderCatalogMock({
        available_providers: ['plaid', 'teller'],
        default_provider: 'teller',
        user_provider: 'teller',
      })
    );

    renderAccountsPage();

    expect(screen.getByRole('button', { name: /^add account$/i })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /^teller$/i })).not.toBeInTheDocument();
  });

  it('shows an import success toast with the account mask', async () => {
    const user = userEvent.setup();

    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useProviderCatalog).mockReturnValue(
      makeProviderCatalogMock({
        available_providers: ['plaid', 'teller'],
        default_provider: 'plaid',
        user_provider: 'plaid',
      })
    );
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

    await user.click(screen.getByRole('button', { name: 'Import transactions' }));
    await user.click(screen.getByRole('button', { name: 'Finish mocked import' }));

    expect(screen.queryByRole('dialog', { name: 'Import transactions' })).not.toBeInTheDocument();
    expect(screen.getByText('Imported 5 transactions for ••1234')).toBeVisible();
  });
});
