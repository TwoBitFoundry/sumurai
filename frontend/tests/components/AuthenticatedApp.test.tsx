import { afterAll, beforeAll, jest } from '@jest/globals';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

beforeAll(() => {
  jest.useRealTimers();
});

afterAll(() => {
  jest.useRealTimers();
});

const DashboardPageMock = jest.fn(() => <div data-testid="dashboard-page">dashboard</div>);
const TransactionsPageMock = jest.fn(() => <div data-testid="transactions-page">transactions</div>);
const BudgetsPageMock = jest.fn(() => <div data-testid="budgets-page">budgets</div>);
const AccountsPageMock = jest.fn(({ onError }: { onError?: (value: string | null) => void }) => (
  <div data-testid="accounts-page">
    <button onClick={() => onError?.('accounts-error')} data-testid="trigger-accounts-error">
      trigger error
    </button>
    <button onClick={() => onError?.(null)} data-testid="clear-accounts-error">
      clear error
    </button>
  </div>
));

jest.mock('@/views/DashboardPage', () => ({
  __esModule: true,
  default: DashboardPageMock,
}));

jest.mock('@/views/TransactionsPage', () => ({
  __esModule: true,
  default: TransactionsPageMock,
}));

jest.mock('@/views/BudgetsPage', () => ({
  __esModule: true,
  default: BudgetsPageMock,
}));

jest.mock('@/views/AccountsPage', () => ({
  __esModule: true,
  default: AccountsPageMock,
}));

import { installFetchRoutes } from '@tests/utils/fetchRoutes';
import { createProviderConnection, createProviderStatus } from '@tests/utils/fixtures';
import { ThemeTestProvider } from '@tests/utils/ThemeTestProvider';
import { AuthenticatedApp } from '@/components/AuthenticatedApp';
import { AccountFilterProvider } from '@/hooks/useAccountFilter';

describe('AuthenticatedApp shell', () => {
  const onLogout = jest.fn();
  let fetchMock: ReturnType<typeof installFetchRoutes>;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    fetchMock = installFetchRoutes({
      'GET /api/plaid/accounts': [
        {
          id: 'account1',
          name: 'Test Checking',
          account_type: 'depository',
          balance_ledger: 1200,
          balance_available: 1180,
          balance_current: 1200,
          mask: '1111',
          plaid_connection_id: 'conn_1',
          institution_name: 'Test Bank',
          provider: 'plaid',
        },
        {
          id: 'account2',
          name: 'Test Savings',
          account_type: 'depository',
          balance_ledger: 5400,
          balance_available: 5400,
          balance_current: 5400,
          mask: '2222',
          plaid_connection_id: 'conn_1',
          institution_name: 'Test Bank',
          provider: 'plaid',
        },
      ],
      'GET /api/providers/accounts': [
        {
          id: 'account1',
          name: 'Test Checking',
          account_type: 'depository',
          balance_ledger: 1200,
          balance_available: 1180,
          balance_current: 1200,
          mask: '1111',
          connection_id: 'conn_1',
          institution_name: 'Test Bank',
          provider: 'plaid',
        },
        {
          id: 'account2',
          name: 'Test Savings',
          account_type: 'depository',
          balance_ledger: 5400,
          balance_available: 5400,
          balance_current: 5400,
          mask: '2222',
          connection_id: 'conn_1',
          institution_name: 'Test Bank',
          provider: 'plaid',
        },
      ],
      'GET /api/providers/info': {
        available_providers: ['plaid', 'teller'],
        default_provider: 'plaid',
        user_provider: 'plaid',
        teller_application_id: 'test-app-id',
        teller_env: 'sandbox',
      },
      'GET /api/providers/status': createProviderStatus({
        connections: [
          createProviderConnection({
            is_connected: true,
            institution_name: 'Test Bank',
            connection_id: 'conn_1',
          }),
        ],
      }),
    });
  });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
    localStorage.clear();
  });

  const renderApp = () =>
    render(
      <ThemeTestProvider>
        <AccountFilterProvider>
          <AuthenticatedApp onLogout={onLogout} />
        </AccountFilterProvider>
      </ThemeTestProvider>
    );

  it('renders dashboard by default', async () => {
    renderApp();
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('transactions-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('accounts-page')).not.toBeInTheDocument();
  });

  it('navigates between tabs and toggles budgets visibility without extra props', async () => {
    const user = userEvent.setup();
    renderApp();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /all accounts/i })).toBeInTheDocument();
    });

    expect(screen.queryByTestId('budgets-page')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^transactions$/i }));
    expect(await screen.findByTestId('transactions-page')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^budgets$/i }));
    expect(await screen.findByTestId('budgets-page')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^accounts$/i }));
    expect(await screen.findByTestId('accounts-page')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTestId('budgets-page')).not.toBeInTheDocument();
    });
  });

  it('renders accounts tab without errors', async () => {
    const user = userEvent.setup();
    renderApp();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /all accounts/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /^accounts$/i }));
    expect(await screen.findByTestId('accounts-page')).toBeInTheDocument();
  });

  it('supports theme toggle and logout', async () => {
    const user = userEvent.setup();
    renderApp();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /all accounts/i })).toBeInTheDocument();
    });

    const themeButton = screen.getByLabelText(/toggle theme/i);
    expect(themeButton).toBeInTheDocument();
    await user.click(themeButton);

    await user.click(screen.getByRole('button', { name: /logout/i }));
    expect(onLogout).toHaveBeenCalled();
  });

  it('includes HeaderAccountFilter in the header', async () => {
    renderApp();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /all accounts/i })).toBeInTheDocument();
    });
  });

  it('maintains responsive layout with HeaderAccountFilter', async () => {
    renderApp();
    const header = screen.getByRole('banner');
    expect(header).toBeInTheDocument();

    await waitFor(() => {
      const accountFilter = screen.getByRole('button', { name: /all accounts/i });
      expect(accountFilter).toBeInTheDocument();
    });

    const nav = screen.getByRole('navigation', { name: /primary/i });
    expect(nav).toBeInTheDocument();
  });
});
