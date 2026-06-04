import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeProviderCatalogMock } from '@tests/utils/providerCatalogMocks';
import { useAccountFilter } from '@/hooks/useAccountFilter';
import { useExport } from '@/hooks/useExport';
import {
  type UseFinancialConnectionReturn,
  useFinancialConnection,
} from '@/hooks/useFinancialConnection';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { usePlaidConnections } from '@/hooks/usePlaidConnections';
import { useProviderCatalog } from '@/hooks/useProviderCatalog';
import { PlaidService } from '@/services/PlaidService';
import { TellerService } from '@/services/TellerService';
import type { ProviderCatalogue } from '@/types/providerCatalog';
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
    isReady: true,
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

jest.mock('@/hooks/useExport', () => ({
  useExport: jest.fn(),
}));

jest.mock('@/hooks/usePlaidConnections', () => ({
  usePlaidConnections: jest.fn(),
}));

jest.mock('@/services/PlaidService', () => ({
  PlaidService: {
    getAccounts: jest.fn(),
    getStatus: jest.fn(),
    syncTransactions: jest.fn(),
    disconnect: jest.fn(),
  },
}));

jest.mock('@/services/TellerService', () => ({
  TellerService: {
    getStatus: jest.fn().mockResolvedValue([]),
    syncTransactions: jest.fn(),
    disconnect: jest.fn(),
  },
}));

jest.mock('@/services/SimpleFinService', () => ({
  SimpleFinService: {
    getIgnoredInstitutions: jest.fn().mockResolvedValue([]),
    restoreInstitution: jest.fn(),
    syncBridge: jest.fn(),
  },
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

function makeTellerAccountFilter(overrides = {}) {
  return {
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
    ...overrides,
  };
}

async function expandInstitutionAccounts(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Show accounts' }));
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Hide accounts' })).toBeVisible();
  });
}

describe('AccountsPage', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    jest.mocked(useOnlineStatus).mockReturnValue(false);
    jest.mocked(useExport).mockReturnValue({
      isExporting: false,
      error: null,
      toast: null,
      exportAccounts: jest.fn(),
    });
    jest.mocked(usePlaidConnections).mockReturnValue({
      connections: [],
      loading: false,
      error: null,
      addConnection: jest.fn(),
      removeConnection: jest.fn(),
      updateConnectionSyncInfo: jest.fn(),
      setConnectionSyncInProgress: jest.fn(),
      refresh: jest.fn(),
      getConnection: jest.fn(),
    });
    jest.mocked(useProviderCatalog).mockReturnValue(
      makeProviderCatalogMock({
        available_providers: ['plaid', 'teller'],
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
    jest.mocked(useAccountFilter).mockReturnValue(makeTellerAccountFilter());
    renderAccountsPage();

    expect(screen.getByTestId('accounts-page')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: /bring all your ally institutions under one house, answering to you/i,
      })
    ).toBeVisible();
    expect(screen.getByText('Unavailable while offline')).toBeVisible();
    const tellerButton = screen.getAllByRole('button', {
      name: /^connect teller to an ally$/i,
    })[0];
    expect(tellerButton).toBeDisabled();
    expect(tellerButton.querySelector('img')).toHaveAttribute('src', '/teller.webp');
  });

  it('does not show the auto-categorize action on the accounts page', () => {
    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useAccountFilter).mockReturnValue(makeTellerAccountFilter());

    renderAccountsPage();

    expect(screen.queryByRole('button', { name: /auto-categorize/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /cancel categorization/i })
    ).not.toBeInTheDocument();
  });

  it('exports all institutions from the header menu', async () => {
    const user = userEvent.setup();
    const exportAccounts = jest.fn().mockResolvedValue(undefined);
    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useAccountFilter).mockReturnValue(makeTellerAccountFilter());
    jest.mocked(useExport).mockReturnValue({
      isExporting: false,
      error: null,
      toast: null,
      exportAccounts,
    });

    renderAccountsPage();

    const syncAllButton = screen.getByRole('button', { name: 'Sync all' });
    const exportAllButton = screen.getByRole('button', { name: 'Export All' });
    const connectButton = screen.getByRole('button', { name: /^connect teller to an ally$/i });

    expect(
      syncAllButton.compareDocumentPosition(exportAllButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      exportAllButton.compareDocumentPosition(connectButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    await user.click(exportAllButton);
    await user.click(screen.getByRole('button', { name: 'Export as CSV' }));

    expect(exportAccounts).toHaveBeenCalledWith('csv');
  });

  it('exports a single institution from the bank card menu', async () => {
    const user = userEvent.setup();
    const exportAccounts = jest.fn().mockResolvedValue(undefined);
    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useAccountFilter).mockReturnValue(makeTellerAccountFilter());
    jest.mocked(useExport).mockReturnValue({
      isExporting: false,
      error: null,
      toast: null,
      exportAccounts,
    });

    renderAccountsPage();
    await expandInstitutionAccounts(user);

    await user.click(screen.getByRole('button', { name: 'Export institution data' }));
    await user.click(screen.getByRole('button', { name: 'Export as OFX' }));

    expect(exportAccounts).toHaveBeenCalledWith('ofx', 'conn_1');
  });

  it('disables export controls while an export is in flight', () => {
    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useAccountFilter).mockReturnValue(makeTellerAccountFilter());
    jest.mocked(useExport).mockReturnValue({
      isExporting: true,
      error: null,
      toast: null,
      exportAccounts: jest.fn(),
    });

    renderAccountsPage();
    expect(screen.getByRole('button', { name: 'Exporting...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Export institution data' })).toBeDisabled();
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
      .getByRole('heading', {
        name: /bring all your ally institutions under one house, answering to you/i,
      })
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

    expect(screen.queryByText(/Failed to load connections/)).not.toBeInTheDocument();
  });

  it('shows per-account transaction counts from the filter for Plaid', async () => {
    const user = userEvent.setup();
    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useProviderCatalog).mockReturnValue(
      makeProviderCatalogMock({
        available_providers: ['plaid', 'teller'],
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
    await expandInstitutionAccounts(user);

    await waitFor(() => {
      expect(screen.getByText('55 items')).toBeVisible();
    });
  });

  it('renders the Plaid accounts button with the Plaid logo', () => {
    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useProviderCatalog).mockReturnValue(
      makeProviderCatalogMock({
        available_providers: ['plaid', 'teller'],
        user_provider: 'plaid',
      })
    );
    jest.mocked(useAccountFilter).mockReturnValue(
      makeTellerAccountFilter({
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
              transaction_count: 0,
            },
          ],
        },
      })
    );

    renderAccountsPage();

    const plaidButton = screen.getByRole('button', { name: /^connect plaid to an ally$/i });
    expect(plaidButton.querySelector('img')).toHaveAttribute('src', '/plaid.webp');
  });

  it('renders Teller current balances on the accounts page', async () => {
    const user = userEvent.setup();
    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useProviderCatalog).mockReturnValue(
      makeProviderCatalogMock({
        available_providers: ['plaid', 'teller'],
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
    await expandInstitutionAccounts(user);

    await waitFor(() => {
      expect(screen.getByText('$1,234.56')).toBeVisible();
    });
    expect(screen.queryByText('PLACEHOLDER')).not.toBeInTheDocument();
  });

  it('opens the SimpleFIN modal from the provider picker', async () => {
    const user = userEvent.setup();

    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useProviderCatalog).mockReturnValue(
      makeProviderCatalogMock({
        available_providers: ['plaid', 'simplefin'],
        user_provider: null,
      })
    );
    jest.mocked(useFinancialConnection).mockReturnValue(
      makeFinancialConnectionMock({
        initiateConnection: jest.fn(),
      })
    );

    renderAccountsPage();

    await user.click(screen.getAllByRole('button', { name: /^connect$/i })[1]);

    expect(
      screen.getByRole('dialog', { name: /connect your simplefin bridge/i })
    ).toBeInTheDocument();
  });

  it('clears the cached provider when the last bank is disconnected', async () => {
    const user = userEvent.setup();
    const setQueryDataSpy = jest.spyOn(queryClient, 'setQueryData');
    const refresh = jest.fn().mockResolvedValue(undefined);
    setQueryDataSpy.mockClear();

    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useProviderCatalog).mockReturnValue(
      makeProviderCatalogMock(
        {
          available_providers: ['plaid', 'teller'],
          user_provider: 'teller',
        },
        { refresh }
      )
    );
    jest.mocked(useAccountFilter).mockReturnValue(
      makeTellerAccountFilter({
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
      })
    );

    renderAccountsPage();

    await user.click(screen.getByRole('button', { name: 'Disconnect' }));
    await user.click(screen.getByRole('button', { name: /^disconnect$/i }));

    expect(setQueryDataSpy).toHaveBeenCalledWith(['provider', 'catalog'], expect.any(Function));
    const updater = setQueryDataSpy.mock.calls.find(
      ([key]) => Array.isArray(key) && key[0] === 'provider' && key[1] === 'catalog'
    )?.[1];
    expect(typeof updater).toBe('function');
    const updated = (updater as (prev?: ProviderCatalogue) => ProviderCatalogue | undefined)({
      available_providers: ['plaid', 'teller'],
      user_provider: 'teller',
    });
    expect(updated?.user_provider).toBeNull();
    expect(refresh).toHaveBeenCalled();

    setQueryDataSpy.mockRestore();
  });

  it('opens the SimpleFIN modal from the connect action once an institution is connected', async () => {
    const user = userEvent.setup();

    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useProviderCatalog).mockReturnValue(
      makeProviderCatalogMock({
        available_providers: ['plaid', 'simplefin'],
        user_provider: 'simplefin',
      })
    );
    jest.mocked(useAccountFilter).mockReturnValue({
      selectedAccountIds: ['acc_1'],
      allAccountIds: ['acc_1'],
      isAllAccountsSelected: true,
      accountsByBank: {
        'SimpleFIN Bank': [
          {
            id: 'acc_1',
            name: 'Checking',
            account_type: 'depository',
            balance_ledger: 100,
            balance_available: 100,
            mask: '1234',
            provider: 'simplefin',
            institution_name: 'SimpleFIN Bank',
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

    await user.click(screen.getByRole('button', { name: /^connect simplefin to an ally$/i }));

    expect(
      screen.getByRole('dialog', { name: /connect your simplefin bridge/i })
    ).toBeInTheDocument();
  });

  it('hides the SimpleFIN per-bank sync action while keeping sync all available', () => {
    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useProviderCatalog).mockReturnValue(
      makeProviderCatalogMock({
        available_providers: ['plaid', 'simplefin'],
        user_provider: 'simplefin',
      })
    );
    jest.mocked(useAccountFilter).mockReturnValue({
      selectedAccountIds: ['acc_1'],
      allAccountIds: ['acc_1'],
      isAllAccountsSelected: true,
      accountsByBank: {
        'SimpleFIN Bank': [
          {
            id: 'acc_1',
            name: 'Checking',
            account_type: 'depository',
            balance_ledger: 100,
            balance_available: 100,
            mask: '1234',
            provider: 'simplefin',
            institution_name: 'SimpleFIN Bank',
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

    expect(screen.queryByRole('button', { name: /sync now/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sync all/i })).toBeEnabled();
  });

  it('shows the checklist-style single sync card for one institution at a time', async () => {
    const user = userEvent.setup();

    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useProviderCatalog).mockReturnValue(
      makeProviderCatalogMock({
        available_providers: ['plaid'],
        user_provider: 'plaid',
      })
    );
    jest.mocked(useAccountFilter).mockReturnValue(
      makeTellerAccountFilter({
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
              transaction_count: 0,
            },
          ],
        },
      })
    );
    jest.mocked(PlaidService.syncTransactions).mockResolvedValue({
      transactions: [
        {
          id: 'tx_1',
          date: '2026-06-02',
          name: 'Coffee Shop',
          amount: 4.5,
          category: { primary: 'Food and Drink' },
          provider_account_id: 'acc_plaid_1',
        },
      ],
      metadata: {
        transaction_count: 1,
        account_count: 1,
        sync_timestamp: '2026-06-02T15:00:00Z',
        start_date: '2026-06-01',
        end_date: '2026-06-02',
        connection_updated: true,
      },
      simplefin_institution_results: [],
      bridge_warnings: [],
    });

    renderAccountsPage();

    await user.click(screen.getByRole('button', { name: 'Sync now' }));

    await waitFor(() => {
      expect(screen.getByTestId('sync-institution-toast')).toBeVisible();
    });
    const syncToast = screen.getByTestId('sync-institution-toast');
    expect(within(syncToast).getByRole('heading', { name: 'Sync institution' })).toBeVisible();
    expect(within(syncToast).getByText('Demo Bank')).toBeVisible();
    expect(within(syncToast).getByText('Synced 1 new transaction')).toBeVisible();
  });

  it('enables plaid connect when provider catalog is unavailable', () => {
    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useProviderCatalog).mockReturnValue(
      makeProviderCatalogMock(
        {
          available_providers: ['plaid', 'teller'],
          user_provider: 'plaid',
        },
        {
          error: 'Unable to load provider configuration',
          availableProviders: [],
          userProvider: 'plaid',
          canConnectWith: (provider) => isProviderConnectable(provider, null),
          getConnectBlockedReason: () => null,
          resolveConnectProvider: (preferred) => preferred,
        }
      )
    );
    jest.mocked(useAccountFilter).mockReturnValue(
      makeTellerAccountFilter({
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
              transaction_count: 0,
            },
          ],
        },
      })
    );

    renderAccountsPage();

    expect(screen.getByRole('button', { name: /^connect plaid to an ally$/i })).toBeEnabled();
  });

  it('falls back to plaid connect when teller is selected but not configured', () => {
    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useProviderCatalog).mockReturnValue(
      makeProviderCatalogMock({
        available_providers: ['plaid', 'teller'],
        user_provider: 'teller',
      })
    );
    jest.mocked(useAccountFilter).mockReturnValue(
      makeTellerAccountFilter({
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
              transaction_count: 0,
            },
          ],
        },
      })
    );

    renderAccountsPage();

    expect(screen.getByRole('button', { name: /^connect plaid to an ally$/i })).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: /^connect teller to an ally$/i })
    ).not.toBeInTheDocument();
  });

  describe('provider picker fallback', () => {
    it('shows the provider picker when user has no active provider', () => {
      jest.mocked(useOnlineStatus).mockReturnValue(true);
      jest.mocked(useProviderCatalog).mockReturnValue(
        makeProviderCatalogMock({
          available_providers: ['teller', 'simplefin', 'plaid'],
          user_provider: null,
        })
      );

      renderAccountsPage();

      expect(screen.getByTestId('provider-selection-panel')).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', {
          name: /bring all your ally institutions under one house, answering to you/i,
        })
      ).not.toBeInTheDocument();
    });

    it('shows the provider picker when user has a provider but no active connections', () => {
      jest.mocked(useOnlineStatus).mockReturnValue(true);
      jest.mocked(useProviderCatalog).mockReturnValue(
        makeProviderCatalogMock({
          available_providers: ['teller', 'simplefin', 'plaid'],
          user_provider: 'plaid',
          teller_application_id: 'app_123',
        })
      );
      jest.mocked(useFinancialConnection).mockImplementation(({ provider }) =>
        makeFinancialConnectionMock({
          isReady: true,
          connectionInProgress: false,
          provider,
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

      renderAccountsPage();

      expect(screen.getByTestId('provider-selection-panel')).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', {
          name: /bring all your ally institutions under one house, answering to you/i,
        })
      ).not.toBeInTheDocument();
      for (const button of screen.getAllByRole('button', { name: /^connect$/i })) {
        expect(button).toBeEnabled();
      }
    });

    it('does not show the picker when active connections exist', () => {
      jest.mocked(useOnlineStatus).mockReturnValue(true);
      jest.mocked(useProviderCatalog).mockReturnValue(
        makeProviderCatalogMock({
          available_providers: ['teller', 'simplefin', 'plaid'],
          user_provider: 'teller',
          teller_application_id: 'app_123',
        })
      );
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

      expect(screen.queryByTestId('provider-selection-panel')).not.toBeInTheDocument();
      expect(
        screen.getByRole('heading', {
          name: /bring all your ally institutions under one house, answering to you/i,
        })
      ).toBeInTheDocument();
    });

    it('starts Teller connect from the picker click instead of only selecting the provider', async () => {
      const user = userEvent.setup();
      const chooseProvider = jest.fn();
      const tellerInitiateConnection = jest.fn();

      jest.mocked(useOnlineStatus).mockReturnValue(true);
      jest.mocked(useProviderCatalog).mockReturnValue(
        makeProviderCatalogMock(
          {
            available_providers: ['teller', 'simplefin', 'plaid'],
            user_provider: null,
            teller_application_id: 'app_123',
          },
          {
            chooseProvider,
          }
        )
      );
      jest
        .mocked(useFinancialConnection)
        .mockImplementation(({ provider }: { provider: 'plaid' | 'teller' | 'simplefin' }) =>
          makeFinancialConnectionMock({
            initiateConnection: provider === 'teller' ? tellerInitiateConnection : jest.fn(),
          })
        );

      renderAccountsPage();

      await user.click(screen.getAllByRole('button', { name: 'Connect' })[0]);

      expect(tellerInitiateConnection).toHaveBeenCalledTimes(1);
      expect(chooseProvider).not.toHaveBeenCalled();
    });
  });

  it('shows an import success toast with the account mask', async () => {
    const user = userEvent.setup();

    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useProviderCatalog).mockReturnValue(
      makeProviderCatalogMock({
        available_providers: ['plaid', 'teller'],
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
    await expandInstitutionAccounts(user);

    await user.click(screen.getByRole('button', { name: 'Import transactions' }));
    await user.click(screen.getByRole('button', { name: 'Finish mocked import' }));

    expect(screen.queryByRole('dialog', { name: 'Import transactions' })).not.toBeInTheDocument();
    expect(screen.getByText('Imported 5 transactions for ••1234')).toBeVisible();
  });
});
