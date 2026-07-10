import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/features/transactions/hooks/useTransactionListLauncher', () => ({
  useTransactionListLauncher: () => ({
    openTransactionList: jest.fn(),
    close: jest.fn(),
  }),
}));

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
import { ApiError, NotFoundError } from '@/services/ApiClient';
import { DiyService } from '@/services/DiyService';
import { PlaidService } from '@/services/PlaidService';
import { TellerService } from '@/services/TellerService';
import type { ProviderCatalogue } from '@/types/providerCatalog';
import * as events from '@/utils/events';
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

function renderAccountsPage({ demoModeActive = false }: { demoModeActive?: boolean } = {}) {
  return render(
    <ThemeTestProvider>
      <QueryClientProvider client={queryClient}>
        <AccountsPage demoModeActive={demoModeActive} />
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

jest.mock('@/components/onboarding/OnboardingProviderConnectModal', () => ({
  OnboardingProviderConnectModal: ({
    provider,
    isOpen,
    onClose,
    onConnected,
  }: {
    provider: 'plaid' | 'teller' | 'simplefin' | null;
    isOpen: boolean;
    onClose: () => void;
    onConnected: (provider: 'plaid' | 'teller' | 'simplefin') => Promise<void> | void;
  }) =>
    isOpen && provider ? (
      <div role="dialog" aria-label={`connect your ${provider} bridge`}>
        <button type="button" onClick={() => void onConnected(provider)}>
          Complete connect
        </button>
        <button type="button" onClick={onClose}>
          Close modal
        </button>
      </div>
    ) : null,
}));

jest.mock('@/features/plaid/components/ProviderSelectionPanel', () => ({
  ProviderSelectionPanel: ({
    availableProviders,
    footerContent,
    onClose,
    onSelectProvider,
    visibleProviders,
  }: {
    availableProviders: Array<'plaid' | 'teller' | 'simplefin' | 'diy'>;
    footerContent?: unknown;
    onClose?: () => void;
    onSelectProvider: (provider: 'plaid' | 'teller' | 'simplefin' | 'diy') => void;
    visibleProviders?: Array<'plaid' | 'teller' | 'simplefin' | 'diy'>;
  }) => {
    const providers = visibleProviders ?? (['diy', 'simplefin', 'plaid'] as const);
    return (
      <div data-testid="provider-selection-panel">
        {onClose ? (
          <button type="button" aria-label="Close provider picker" onClick={onClose}>
            Close picker
          </button>
        ) : null}
        {providers.map((provider) => (
          <button
            key={provider}
            type="button"
            disabled={
              provider !== 'diy' &&
              provider !== 'simplefin' &&
              !availableProviders.includes(provider)
            }
            onClick={() => onSelectProvider(provider)}
          >
            Connect
          </button>
        ))}
        {footerContent}
      </div>
    );
  },
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

jest.mock('@/services/DiyService', () => ({
  DiyService: {
    createInstitution: jest.fn(),
    createAccount: jest.fn(),
    disconnectInstitution: jest.fn(),
  },
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

jest.mock('@/features/diy/DiyInstitutionModal', () => ({
  DiyInstitutionModal: ({
    isOpen,
    connectionId,
    institutionName,
    onClose,
    onComplete,
  }: {
    isOpen: boolean;
    connectionId?: string | null;
    institutionName?: string | null;
    onClose: () => void;
    onComplete: (connectionId: string) => Promise<void> | void;
  }) =>
    isOpen ? (
      <div data-testid="diy-institution-modal">
        <div>{connectionId ?? 'new-diy-connection'}</div>
        <div>{institutionName ?? 'new institution'}</div>
        <button type="button" onClick={onClose}>
          Close DIY modal
        </button>
        <button type="button" onClick={() => void onComplete(connectionId ?? 'conn-diy')}>
          Complete DIY
        </button>
      </div>
    ) : null,
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
        name: /unite your accounts/i,
      })
    ).toBeVisible();
    expect(screen.getByText('Unavailable while offline')).toBeVisible();
    const tellerButton = screen.getAllByRole('button', {
      name: /^link account$/i,
    })[0];
    expect(tellerButton).toBeDisabled();
    expect(tellerButton.querySelector('svg.lucide-link')).toBeTruthy();
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
    const connectButton = screen.getByRole('button', { name: /^link account$/i });

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
    expect(screen.getByRole('button', { name: 'Exporting all institutions' })).toBeDisabled();
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
        name: /unite your accounts/i,
      })
      .closest('section');
    expect(heroSection).toBeTruthy();
    expect(
      within(heroSection as HTMLElement).getByRole('button', { name: 'Sync all' })
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
      expect(screen.getByText('tx').parentElement).toHaveTextContent('55tx');
    });
  });

  it('renders the Link Account button with the link glyph', () => {
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

    const plaidButton = screen.getByRole('button', { name: /^link account$/i });
    expect(plaidButton.querySelector('svg.lucide-link')).toBeTruthy();
  });

  it('renders Teller current balances on the accounts page', async () => {
    const user = userEvent.setup();
    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useProviderCatalog).mockReturnValue(
      makeProviderCatalogMock({
        available_providers: ['plaid', 'teller'],
        user_provider: 'teller',
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

    await user.click(screen.getByRole('button', { name: /^link account$/i }));
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

  it('disconnects a diy institution through the diy disconnect endpoint', async () => {
    const user = userEvent.setup();
    const removeAccountsByIds = jest.fn();
    jest.mocked(DiyService.disconnectInstitution).mockResolvedValue({
      success: true,
      message: 'Disconnected',
      data_cleared: {
        transactions: 1,
        accounts: 1,
        cache_keys: [],
      },
    });

    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useProviderCatalog).mockReturnValue(
      makeProviderCatalogMock({
        available_providers: ['plaid', 'teller', 'diy'],
        user_provider: 'diy',
      })
    );
    jest.mocked(useAccountFilter).mockReturnValue(
      makeTellerAccountFilter({
        removeAccountsByIds,
        accountsByBank: {
          'My Cash': [
            {
              id: 'acc_diy_1',
              name: 'Checking',
              account_type: 'depository',
              balance_ledger: 100,
              balance_available: 100,
              mask: '1234',
              provider: 'diy',
              institution_name: 'My Cash',
              connection_id: 'conn_diy_1',
              transaction_count: 0,
            },
          ],
        },
      })
    );

    renderAccountsPage();

    await user.click(screen.getByRole('button', { name: 'Disconnect' }));
    await user.click(screen.getByRole('button', { name: /^disconnect$/i }));

    expect(DiyService.disconnectInstitution).toHaveBeenCalledWith('conn_diy_1');
    expect(PlaidService.disconnect).not.toHaveBeenCalled();
    expect(TellerService.disconnect).not.toHaveBeenCalled();
    expect(removeAccountsByIds).toHaveBeenCalledWith(['acc_diy_1']);
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

    await user.click(screen.getByRole('button', { name: /^link account$/i }));

    expect(screen.getByTestId('provider-selection-panel')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Connect' })[1]);

    expect(
      screen.getByRole('dialog', { name: /connect your simplefin bridge/i })
    ).toBeInTheDocument();
  });

  it('opens the DIY institution modal from the provider picker when no institutions exist', async () => {
    const user = userEvent.setup();

    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useProviderCatalog).mockReturnValue(
      makeProviderCatalogMock({
        available_providers: ['plaid', 'teller', 'diy'],
        user_provider: null,
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

    expect(screen.queryByTestId('provider-selection-panel')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^link account$/i }));

    expect(screen.getByTestId('provider-selection-panel')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Connect' })[0]);

    const modal = screen.getByTestId('diy-institution-modal');
    expect(modal).toBeInTheDocument();
    expect(screen.getByTestId('provider-selection-panel')).toBeInTheDocument();
    expect(within(modal).getByText('new institution')).toBeVisible();
  });

  it('shows a demo exit warning before creating a new institution from the provider picker', async () => {
    const user = userEvent.setup();

    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useProviderCatalog).mockReturnValue(
      makeProviderCatalogMock({
        available_providers: ['plaid', 'teller', 'diy'],
        user_provider: null,
      })
    );

    renderAccountsPage({ demoModeActive: true });

    await user.click(screen.getByRole('button', { name: /^link account$/i }));
    await user.click(screen.getAllByRole('button', { name: 'Connect' })[0]);

    expect(screen.getByTestId('demo-exit-warning-modal')).toBeInTheDocument();
    expect(screen.queryByTestId('diy-institution-modal')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByTestId('diy-institution-modal')).toBeInTheDocument();
  });

  it('opens the DIY institution modal from a DIY bank row add-account action without a demo exit warning', async () => {
    const user = userEvent.setup();

    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useProviderCatalog).mockReturnValue(
      makeProviderCatalogMock({
        available_providers: ['plaid', 'teller', 'diy'],
        user_provider: 'diy',
      })
    );
    jest.mocked(useAccountFilter).mockReturnValue(
      makeTellerAccountFilter({
        accountsByBank: {
          'DIY Bank': [
            {
              id: 'acc_diy_1',
              name: 'Checking',
              account_type: 'depository',
              balance_ledger: 100,
              balance_available: 100,
              mask: '1234',
              provider: 'diy',
              institution_name: 'DIY Bank',
              connection_id: 'conn_diy_1',
              transaction_count: 0,
            },
          ],
        },
      })
    );

    renderAccountsPage({ demoModeActive: true });

    await user.click(screen.getByRole('button', { name: 'Add account' }));

    expect(screen.queryByTestId('demo-exit-warning-modal')).not.toBeInTheDocument();
    const modal = screen.getByTestId('diy-institution-modal');
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText('DIY Bank')).toBeVisible();
    expect(within(modal).getByText('conn_diy_1')).toBeVisible();
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

  it('keeps the bank status as error when sync fails with app auth error', async () => {
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
    jest
      .mocked(PlaidService.syncTransactions)
      .mockRejectedValueOnce(new ApiError(403, 'Auth required', 'FORBIDDEN'));

    renderAccountsPage();

    await user.click(screen.getByRole('button', { name: 'Sync now' }));

    await waitFor(() => {
      expect(screen.getByRole('status', { name: 'Error' })).toBeVisible();
    });
    expect(screen.queryByRole('status', { name: 'Re-auth needed' })).not.toBeInTheDocument();
  });

  it('updates the bank status to re-auth needed when sync fails with missing provider credentials', async () => {
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
    jest
      .mocked(PlaidService.syncTransactions)
      .mockRejectedValueOnce(
        new NotFoundError(
          'This institution is linked in Sumurai but provider credentials are missing. Reconnect your financial provider from Accounts.',
          'PROVIDER_CREDENTIALS_MISSING'
        )
      );

    renderAccountsPage();

    await user.click(screen.getByRole('button', { name: 'Sync now' }));

    await waitFor(() => {
      expect(screen.getByRole('status', { name: 'Re-auth needed' })).toBeVisible();
    });
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

    expect(screen.getByRole('button', { name: /^link account$/i })).toBeEnabled();
  });

  it('keeps link account available when legacy teller user_provider remains', () => {
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

    expect(screen.getByRole('button', { name: /^link account$/i })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: /^link account$/i }).querySelector('svg.lucide-link')
    ).toBeTruthy();
  });

  describe('diy default state', () => {
    it('shows DIY default state when user has no active provider and no institutions', () => {
      jest.mocked(useOnlineStatus).mockReturnValue(true);
      jest.mocked(useProviderCatalog).mockReturnValue(
        makeProviderCatalogMock({
          available_providers: ['teller', 'simplefin', 'plaid'],
          user_provider: null,
        })
      );

      renderAccountsPage();

      expect(screen.queryByTestId('provider-selection-panel')).not.toBeInTheDocument();
      expect(
        screen.getByRole('heading', {
          name: /unite your accounts/i,
        })
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^link account$/i })).toBeInTheDocument();
    });

    it('shows connect actions in the provider picker after clicking Link Account when no institutions exist', async () => {
      const user = userEvent.setup();

      jest.mocked(useOnlineStatus).mockReturnValue(true);
      jest.mocked(useProviderCatalog).mockReturnValue(
        makeProviderCatalogMock({
          available_providers: ['teller', 'simplefin', 'plaid'],
          user_provider: null,
        })
      );

      renderAccountsPage();

      await user.click(screen.getByRole('button', { name: /^link account$/i }));

      expect(screen.getByTestId('provider-selection-panel')).toBeInTheDocument();
      const connectButtons = screen.getAllByRole('button', { name: /^connect$/i });
      expect(connectButtons).toHaveLength(3);
      expect(connectButtons.every((button) => button.disabled === false)).toBe(true);
    });

    it('keeps the provider picker open if the simplefin modal is closed before selection completes', async () => {
      const user = userEvent.setup();

      jest.mocked(useOnlineStatus).mockReturnValue(true);
      jest.mocked(useProviderCatalog).mockReturnValue(
        makeProviderCatalogMock({
          available_providers: ['teller', 'simplefin', 'plaid'],
          user_provider: null,
        })
      );

      renderAccountsPage();

      await user.click(screen.getByRole('button', { name: /^link account$/i }));
      await user.click(screen.getAllByRole('button', { name: /^connect$/i })[1]);

      expect(
        screen.getByRole('dialog', { name: /connect your simplefin bridge/i })
      ).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /close modal/i }));

      expect(screen.queryByRole('dialog', { name: /connect your simplefin bridge/i })).toBeNull();
      expect(screen.getByTestId('provider-selection-panel')).toBeInTheDocument();
    });

    it('shows DIY default state when the last aggregator is disconnected', () => {
      jest.mocked(useOnlineStatus).mockReturnValue(true);
      jest.mocked(useProviderCatalog).mockReturnValue(
        makeProviderCatalogMock({
          available_providers: ['teller', 'simplefin', 'plaid'],
          user_provider: 'plaid',
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

      expect(screen.queryByTestId('provider-selection-panel')).not.toBeInTheDocument();
      expect(
        screen.getByRole('heading', {
          name: /unite your accounts/i,
        })
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^link account$/i })).toBeInTheDocument();
    });

    it('does not show the picker when active connections exist', () => {
      jest.mocked(useOnlineStatus).mockReturnValue(true);
      jest.mocked(useProviderCatalog).mockReturnValue(
        makeProviderCatalogMock({
          available_providers: ['teller', 'simplefin', 'plaid'],
          user_provider: 'teller',
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
          name: /unite your accounts/i,
        })
      ).toBeInTheDocument();
    });

    it('opens a restricted provider picker from link account when an aggregator is active', async () => {
      const user = userEvent.setup();

      jest.mocked(useOnlineStatus).mockReturnValue(true);
      jest.mocked(useProviderCatalog).mockReturnValue(
        makeProviderCatalogMock({
          available_providers: ['teller', 'simplefin', 'plaid', 'diy'],
          user_provider: 'teller',
        })
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

      expect(screen.queryByTestId('provider-selection-panel')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /^link account$/i }));

      expect(screen.getByTestId('provider-selection-panel')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /^connect$/i })).toHaveLength(1);
    });

    it('shows all providers in demo mode even when an aggregator is active', async () => {
      const user = userEvent.setup();

      jest.mocked(useOnlineStatus).mockReturnValue(true);
      jest.mocked(useProviderCatalog).mockReturnValue(
        makeProviderCatalogMock({
          available_providers: ['teller', 'simplefin', 'plaid', 'diy'],
          user_provider: 'teller',
        })
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

      renderAccountsPage({ demoModeActive: true });

      await user.click(screen.getByRole('button', { name: /^link account$/i }));

      expect(screen.getByTestId('provider-selection-panel')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /^connect$/i })).toHaveLength(3);
    });

    it('does not offer Teller in the accounts provider picker', async () => {
      const user = userEvent.setup();
      const chooseProvider = jest.fn();

      jest.mocked(useOnlineStatus).mockReturnValue(true);
      jest.mocked(useProviderCatalog).mockReturnValue(
        makeProviderCatalogMock(
          {
            available_providers: ['simplefin', 'plaid'],
            user_provider: null,
          },
          {
            chooseProvider,
          }
        )
      );

      renderAccountsPage();

      await user.click(screen.getByRole('button', { name: /^link account$/i }));

      expect(screen.getByTestId('provider-selection-panel')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Connect' })).toHaveLength(3);
      expect(chooseProvider).not.toHaveBeenCalled();
    });

    it('opens the diy institution modal when diy is selected from the provider picker', async () => {
      const user = userEvent.setup();

      jest.mocked(useOnlineStatus).mockReturnValue(true);
      jest.mocked(useProviderCatalog).mockReturnValue(
        makeProviderCatalogMock({
          available_providers: ['teller', 'simplefin', 'plaid', 'diy'],
          user_provider: null,
        })
      );

      renderAccountsPage();

      await user.click(screen.getByRole('button', { name: /^link account$/i }));
      await user.click(screen.getAllByRole('button', { name: 'Connect' })[0]);

      expect(screen.getByTestId('diy-institution-modal')).toBeInTheDocument();
      expect(screen.getByTestId('provider-selection-panel')).toBeInTheDocument();
    });

    it('keeps the provider picker open if the DIY modal is closed before an account is added', async () => {
      const user = userEvent.setup();

      jest.mocked(useOnlineStatus).mockReturnValue(true);
      jest.mocked(useProviderCatalog).mockReturnValue(
        makeProviderCatalogMock({
          available_providers: ['plaid', 'teller', 'diy'],
          user_provider: null,
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

      await user.click(screen.getByRole('button', { name: /^link account$/i }));
      await user.click(screen.getAllByRole('button', { name: 'Connect' })[0]);

      expect(screen.getByTestId('diy-institution-modal')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Close DIY modal' }));

      expect(screen.queryByTestId('diy-institution-modal')).not.toBeInTheDocument();
      expect(screen.getByTestId('provider-selection-panel')).toBeInTheDocument();
    });

    it('closes the provider picker after DIY account setup completes', async () => {
      const user = userEvent.setup();
      const chooseProvider = jest.fn().mockResolvedValue(undefined);
      const dispatchFinancialAppRefresh = jest.spyOn(events, 'dispatchFinancialAppRefresh');

      jest.mocked(useOnlineStatus).mockReturnValue(true);
      jest.mocked(useProviderCatalog).mockReturnValue(
        makeProviderCatalogMock(
          {
            available_providers: ['plaid', 'teller', 'diy'],
            user_provider: null,
          },
          { chooseProvider }
        )
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

      await user.click(screen.getByRole('button', { name: /^link account$/i }));
      await user.click(screen.getAllByRole('button', { name: 'Connect' })[0]);

      expect(screen.getByTestId('provider-selection-panel')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Complete DIY' }));

      await waitFor(() => {
        expect(chooseProvider).toHaveBeenCalledWith('diy');
        expect(dispatchFinancialAppRefresh).toHaveBeenCalledWith({
          tab: 'accounts',
          refreshSession: true,
        });
        expect(screen.queryByTestId('provider-selection-panel')).not.toBeInTheDocument();
      });

      dispatchFinancialAppRefresh.mockRestore();
    });

    it('preserves the active aggregator after adding a DIY account from an existing DIY bank', async () => {
      const user = userEvent.setup();
      const chooseProvider = jest.fn().mockResolvedValue(undefined);

      jest.mocked(useOnlineStatus).mockReturnValue(true);
      jest.mocked(useProviderCatalog).mockReturnValue(
        makeProviderCatalogMock(
          {
            available_providers: ['plaid', 'teller', 'diy'],
            user_provider: 'plaid',
          },
          { chooseProvider }
        )
      );
      jest.mocked(useAccountFilter).mockReturnValue(
        makeTellerAccountFilter({
          accountsByBank: {
            'DIY Bank': [
              {
                id: 'acc_diy_1',
                name: 'Checking',
                account_type: 'depository',
                balance_ledger: 100,
                balance_available: 100,
                mask: '1234',
                provider: 'diy',
                institution_name: 'DIY Bank',
                connection_id: 'conn_diy_1',
                transaction_count: 0,
              },
            ],
            'Plaid Bank': [
              {
                id: 'acc_plaid_1',
                name: 'Savings',
                account_type: 'depository',
                balance_ledger: 200,
                balance_available: 200,
                mask: '5678',
                provider: 'plaid',
                institution_name: 'Plaid Bank',
                connection_id: 'conn_plaid_1',
                transaction_count: 0,
              },
            ],
          },
        })
      );

      renderAccountsPage();

      await user.click(screen.getAllByRole('button', { name: 'Add account' })[0]);

      expect(screen.getByTestId('diy-institution-modal')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Complete DIY' }));

      await waitFor(() => {
        expect(chooseProvider).not.toHaveBeenCalled();
        expect(screen.queryByTestId('diy-institution-modal')).not.toBeInTheDocument();
      });
    });

    it('shows the Teller sunset sync error without marking re-auth needed', async () => {
      const user = userEvent.setup();

      jest.mocked(useOnlineStatus).mockReturnValue(true);
      jest.mocked(useProviderCatalog).mockReturnValue(
        makeProviderCatalogMock({
          available_providers: ['plaid', 'simplefin'],
          user_provider: 'teller',
        })
      );
      jest.mocked(useAccountFilter).mockReturnValue(makeTellerAccountFilter());
      jest
        .mocked(TellerService.syncTransactions)
        .mockRejectedValueOnce(
          new ApiError(
            400,
            'Teller is no longer supported because the provider no longer offers API access.',
            'TELLER_NO_LONGER_SUPPORTED'
          )
        );

      renderAccountsPage();

      await user.click(screen.getByRole('button', { name: 'Sync now' }));

      await waitFor(() => {
        expect(screen.getByRole('status', { name: 'Error' })).toBeVisible();
      });
      expect(screen.queryByRole('status', { name: 'Re-auth needed' })).not.toBeInTheDocument();
      expect(
        screen.getByText(
          /Teller is no longer supported because the provider no longer offers API access/i
        )
      ).toBeVisible();
    });

    it('keeps the provider picker open if plaid connect exits before completing', async () => {
      const user = userEvent.setup();
      const plaidPickerFlow = { connectionInProgress: false, isConnected: false };

      jest.mocked(useOnlineStatus).mockReturnValue(true);
      jest.mocked(useProviderCatalog).mockReturnValue(
        makeProviderCatalogMock({
          available_providers: ['teller', 'simplefin', 'plaid'],
          user_provider: null,
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
      jest
        .mocked(useFinancialConnection)
        .mockImplementation(
          ({
            provider,
            mountKey,
          }: {
            provider: 'plaid' | 'teller' | 'simplefin';
            mountKey?: string;
          }) => {
            if (mountKey === 'accounts-picker-plaid') {
              return makeFinancialConnectionMock({
                connectionInProgress: plaidPickerFlow.connectionInProgress,
                isConnected: plaidPickerFlow.isConnected,
                initiateConnection: jest.fn(async () => {
                  plaidPickerFlow.connectionInProgress = true;
                }),
              });
            }

            return makeFinancialConnectionMock({ provider });
          }
        );

      const view = renderAccountsPage();

      await user.click(screen.getByRole('button', { name: /^link account$/i }));
      await user.click(screen.getAllByRole('button', { name: 'Connect' })[3]);

      plaidPickerFlow.connectionInProgress = true;
      view.rerender(
        <ThemeTestProvider>
          <QueryClientProvider client={queryClient}>
            <AccountsPage />
          </QueryClientProvider>
        </ThemeTestProvider>
      );

      plaidPickerFlow.connectionInProgress = false;
      view.rerender(
        <ThemeTestProvider>
          <QueryClientProvider client={queryClient}>
            <AccountsPage />
          </QueryClientProvider>
        </ThemeTestProvider>
      );

      expect(screen.getByTestId('provider-selection-panel')).toBeInTheDocument();
    });

    it('opens the provider picker from link account when only diy institutions exist', async () => {
      const user = userEvent.setup();

      jest.mocked(useOnlineStatus).mockReturnValue(true);
      jest.mocked(useProviderCatalog).mockReturnValue(
        makeProviderCatalogMock({
          available_providers: ['plaid', 'teller', 'diy'],
          user_provider: 'diy',
        })
      );
      jest.mocked(useAccountFilter).mockReturnValue(
        makeTellerAccountFilter({
          accountsByBank: {
            'DIY Bank': [
              {
                id: 'acc_diy_1',
                name: 'Checking',
                account_type: 'depository',
                balance_ledger: 100,
                balance_available: 100,
                mask: '1234',
                provider: 'diy',
                institution_name: 'DIY Bank',
                connection_id: 'conn_diy_1',
                transaction_count: 0,
              },
            ],
          },
        })
      );

      renderAccountsPage();

      await user.click(screen.getByRole('button', { name: /^link account$/i }));

      expect(screen.getByTestId('provider-selection-panel')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'DIY Bank' })).not.toBeInTheDocument();
      expect(screen.queryByTestId('diy-institution-modal')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Close provider picker' }));

      expect(screen.queryByTestId('provider-selection-panel')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'DIY Bank' })).toBeInTheDocument();
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
