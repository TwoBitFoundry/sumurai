import { render, screen } from '@testing-library/react';
import type React from 'react';
import { useAccountsToastStack } from '@/features/accounts/hooks/useAccountsToastStack';
import { useAutoCategorization } from '@/features/auto-categorization/hooks/useAutoCategorization';
import { useCategories } from '@/features/transactions/hooks/useCategories';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';
import { useTransactionsInsights } from '@/features/transactions/hooks/useTransactionsInsights';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import TransactionsPage from '@/views/TransactionsPage';

jest.mock('@/features/transactions/hooks/useTransactions', () => ({
  useTransactions: jest.fn(),
}));

jest.mock('@/features/transactions/hooks/useTransactionsInsights', () => ({
  useTransactionsInsights: jest.fn(),
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

jest.mock('@/features/transactions/components/TransactionsToolbar', () => ({
  __esModule: true,
  default: () => <div data-testid="transactions-toolbar" />,
}));

jest.mock('@/features/transactions/components/TransactionsTable', () => ({
  __esModule: true,
  default: () => <div data-testid="transactions-table" />,
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
      accentIndexByName: new Map([
        ['Coffee', 0],
        ['FOOD_AND_DRINK', 1],
      ]),
      isLoading: false,
      error: null,
    } as any);
    jest.mocked(useTransactions).mockReturnValue({
      isLoading: false,
      error: null,
      transactions: [],
      categories: [],
      search: '',
      setSearch: jest.fn(),
      selectedCategory: null,
      setSelectedCategory: jest.fn(),
      currentPage: 1,
      setCurrentPage: jest.fn(),
      pageItems: [],
      totalItems: 0,
      totalPages: 1,
    } as any);
    jest.mocked(useTransactionsInsights).mockReturnValue({
      insights: {
        total_count: 0,
        total_spent: 0,
        average_amount: 0,
        largest: null,
        recurring_count: 0,
        recurring_merchants: [],
        top_categories: [],
      },
      isLoading: false,
      loading: false,
      error: null,
    } as any);
  });

  it('keeps the transaction stats grid in two columns on mobile', () => {
    const { container } = render(
      <TransactionsPage
        filterControl={{
          search: '',
          setSearch: jest.fn(),
          selectedCategory: null,
          setSelectedCategory: jest.fn(),
        }}
      />
    );
    const statsGrid = container.querySelector(
      '[data-testid="page-layout"] .grid.gap-3'
    ) as HTMLElement | null;

    expect(statsGrid).toHaveClass('grid-cols-2');
    expect(statsGrid).toHaveClass('lg:grid-cols-4');
  });

  it('renders the auto-categorize action in the hero actions slot', () => {
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

    expect(getByRole('button', { name: /classify/i })).toBeEnabled();
  });

  it('shows the insights loading state independently from the table', () => {
    jest.mocked(useTransactionsInsights).mockReturnValue({
      insights: null,
      isLoading: true,
      loading: true,
      error: null,
    } as any);

    const { getAllByText } = render(
      <TransactionsPage
        filterControl={{
          search: '',
          setSearch: jest.fn(),
          selectedCategory: null,
          setSelectedCategory: jest.fn(),
        }}
      />
    );

    expect(getAllByText('Fetching...')).toHaveLength(4);
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
