import { render, screen } from '@testing-library/react';
import type React from 'react';
import { useAccountsToastStack } from '@/features/accounts/hooks/useAccountsToastStack';
import { useAutoCategorization } from '@/features/auto-categorization/hooks/useAutoCategorization';
import { useCategories } from '@/features/transactions/hooks/useCategories';
import { useTransactionsContextualInsights } from '@/features/transactions/hooks/useTransactionsContextualInsights';
import { useAccountFilter } from '@/hooks/useAccountFilter';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import TransactionsPage from '@/views/TransactionsPage';

jest.mock('@/hooks/useAccountFilter', () => ({
  useAccountFilter: jest.fn(),
}));

jest.mock('@/features/transactions/hooks/useTransactionsContextualInsights', () => ({
  useTransactionsContextualInsights: jest.fn(),
}));

jest.mock('@/features/transactions/hooks/useCategories', () => ({
  useCategories: jest.fn(),
}));

jest.mock('@/features/auto-categorization/hooks/useAutoCategorization', () => ({
  useAutoCategorization: jest.fn(),
}));

jest.mock('@/features/accounts/hooks/useAccountsToastStack', () => ({
  useAccountsToastStack: jest.fn(),
}));

jest.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: jest.fn(),
}));

jest.mock('@/layouts/PageLayout', () => ({
  PageLayout: ({
    children,
    stats,
    actions,
  }: {
    children?: React.ReactNode;
    stats?: React.ReactNode;
    actions?: React.ReactNode;
  }) => (
    <div data-testid="page-layout">
      <div data-testid="page-actions">{actions}</div>
      <div data-testid="page-stats">{stats}</div>
      <div data-testid="page-children">{children}</div>
    </div>
  ),
}));

jest.mock('@/features/transactions/components/TransactionInsightsPanel', () => ({
  TransactionInsightsPanel: ({
    isLoading,
    displayState,
  }: {
    isLoading: boolean;
    displayState: string;
    insights: { state: string } | null;
    resetKey: string;
  }) => (
    <div
      data-testid="transaction-insights-panel"
      data-loading={String(isLoading)}
      data-state={displayState}
    />
  ),
}));

jest.mock('@/features/transactions/components/TransactionsToolbar', () => ({
  __esModule: true,
  default: () => <div data-testid="transactions-toolbar" />,
}));

jest.mock('@/features/transactions/components/VirtualizedTransactionList', () => ({
  __esModule: true,
  default: () => <div data-testid="virtualized-transaction-list" />,
}));

jest.mock('@/features/transactions/components/CategoryCatalogPicker', () => ({
  __esModule: true,
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="category-catalog-picker" /> : null,
}));

jest.mock('@/components/toastStack/ToastStack', () => ({
  ToastStack: ({
    transients,
    pinnedToast,
  }: {
    transients: Array<{ id: string; message: string }>;
    pinnedToast: { message: string } | null;
  }) => (
    <div
      data-testid="toast-stack"
      data-transients={transients.length}
      data-pinned={pinnedToast?.message ?? ''}
    />
  ),
}));

describe('TransactionsPage', () => {
  beforeEach(() => {
    jest.mocked(useAccountFilter).mockReturnValue({
      selectedAccountIds: [],
      allAccountIds: ['account-1'],
      setSelectedAccountIds: jest.fn(),
    } as any);
    jest.mocked(useOnlineStatus).mockReturnValue(true);
    jest.mocked(useAutoCategorization).mockReturnValue({
      job: null,
      isActive: false,
      isLoading: false,
      isPending: false,
      progressLabel: null,
      handleAction: jest.fn(),
    } as any);
    jest.mocked(useAccountsToastStack).mockReturnValue({
      transients: [],
      pinnedToast: null,
      pushToast: jest.fn(),
      dismissTransient: jest.fn(),
      dismissPinned: jest.fn(),
    } as any);
    jest.mocked(useCategories).mockReturnValue({
      system: ['FOOD_AND_DRINK'],
      custom: [{ id: 'custom-1', display_name: 'Coffee', lookup_key: 'coffee' }],
      all: ['Coffee', 'FOOD_AND_DRINK'],
      filterCategories: ['FOOD_AND_DRINK', 'Coffee'],
      accentIndexByName: new Map([
        ['Coffee', 0],
        ['FOOD_AND_DRINK', 1],
      ]),
      isLoading: false,
      error: null,
    } as any);
    jest.mocked(useTransactionsContextualInsights).mockReturnValue({
      insights: {
        state: 'a',
        card1: {
          value: 0,
          format: 'currency',
          secondary: 0,
          comparison: null,
          share: null,
          label: null,
        },
        card2: {
          value: null,
          format: 'currency',
          secondary: null,
          comparison: null,
          share: null,
          label: null,
        },
        card3: null,
      },
      isLoading: false,
      displayState: 'a',
      error: null,
      accountKey: '',
    } as any);
  });

  it('renders the insights panel in the stats slot', () => {
    render(
      <TransactionsPage
        filterControl={{
          search: '',
          setSearch: jest.fn(),
          selectedCategory: null,
          setSelectedCategory: jest.fn(),
        }}
      />
    );

    const panel = screen.getByTestId('transaction-insights-panel');
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute('data-state', 'a');
    expect(panel).toHaveAttribute('data-loading', 'false');
  });

  it('renders the auto-categorize action inline with the transactions title', () => {
    const { getByRole } = render(
      <TransactionsPage
        filterControl={{
          search: '',
          setSearch: jest.fn(),
          selectedCategory: null,
          setSelectedCategory: jest.fn(),
        }}
      />
    );

    expect(getByRole('button', { name: /categorize/i })).toBeEnabled();
  });

  it('passes loading state to the insights panel independently from the list', () => {
    jest.mocked(useTransactionsContextualInsights).mockReturnValue({
      insights: null,
      displayState: 'a',
      isLoading: true,
      error: null,
      accountKey: '',
    } as any);

    render(
      <TransactionsPage
        filterControl={{
          search: '',
          setSearch: jest.fn(),
          selectedCategory: null,
          setSelectedCategory: jest.fn(),
        }}
      />
    );

    expect(screen.getByTestId('transaction-insights-panel')).toHaveAttribute(
      'data-loading',
      'true'
    );
    expect(screen.getByTestId('virtualized-transaction-list')).toBeInTheDocument();
  });

  it('renders the shared toast stack for auto-categorization job state', () => {
    jest.mocked(useAutoCategorization).mockReturnValue({
      job: {
        job_id: '11111111-2222-3333-4444-555555555555',
        status: 'running',
        total: 8,
        processed: 2,
        updated: 1,
        skipped: 1,
        started_at: '2024-01-01T12:00:00Z',
        finished_at: null,
        error_message: null,
      },
      isActive: true,
      isLoading: false,
      isPending: false,
      progressLabel: '2 / 8 processed',
      handleAction: jest.fn(),
    } as any);
    jest.mocked(useAccountsToastStack).mockReturnValue({
      transients: [{ id: 'toast-1', message: 'Synced 2 transactions' }],
      pinnedToast: {
        message: 'Categorizing transactions…',
        autoDismiss: false,
        progress: { processed: 2, total: 8 },
      },
      pushToast: jest.fn(),
      dismissTransient: jest.fn(),
      dismissPinned: jest.fn(),
    } as any);

    render(
      <TransactionsPage
        filterControl={{
          search: '',
          setSearch: jest.fn(),
          selectedCategory: null,
          setSelectedCategory: jest.fn(),
        }}
      />
    );

    expect(screen.getByTestId('toast-stack')).toHaveAttribute('data-transients', '1');
    expect(screen.getByTestId('toast-stack')).toHaveAttribute(
      'data-pinned',
      'Categorizing transactions…'
    );
  });
});
