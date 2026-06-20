import { render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import * as accountsToastStackModule from '@/features/accounts/hooks/useAccountsToastStack';
import { useAutoCategorization } from '@/features/auto-categorization/hooks/useAutoCategorization';
import { useCategories } from '@/features/transactions/hooks/useCategories';
import { useTransactionsContextualInsights } from '@/features/transactions/hooks/useTransactionsContextualInsights';
import { useAccountFilter } from '@/hooks/useAccountFilter';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { ControlTooltipProvider } from '@/ui/primitives/ControlHoverLabel';
import TransactionsPage from '@/views/TransactionsPage';

function renderTransactionsPage(ui: React.ReactElement) {
  return render(<ControlTooltipProvider>{ui}</ControlTooltipProvider>);
}

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

jest.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: jest.fn(),
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

jest.mock('@/features/transactions/components/VirtualizedTransactionList', () => ({
  __esModule: true,
  default: () => <div data-testid="virtualized-transaction-list" />,
}));

jest.mock('@/features/transactions/components/CategoryCatalogPicker', () => ({
  __esModule: true,
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="category-catalog-picker" /> : null,
}));

describe('TransactionsPage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

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
    jest.spyOn(accountsToastStackModule, 'useAccountsToastStack').mockReturnValue({
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

  it('adds extra bottom spacing on mobile after the transaction section', () => {
    renderTransactionsPage(
      <TransactionsPage
        filterControl={{
          search: '',
          setSearch: jest.fn(),
          selectedCategory: null,
          setSelectedCategory: jest.fn(),
        }}
      />
    );

    const pageLayout = screen.getByTestId('page-layout-sticky-scope').parentElement;
    expect(pageLayout?.className).toContain('max-md:pb-6');
  });

  it('renders the insights panel in the stats slot', () => {
    renderTransactionsPage(
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
    expect(screen.getByTestId('page-layout-sticky-scope')).toContainElement(panel);
  });

  it('reports insights load failures through the toast stack instead of inline hero errors', () => {
    const pushToast = jest.fn();

    jest.spyOn(accountsToastStackModule, 'useAccountsToastStack').mockReturnValue({
      transients: [],
      pinnedToast: null,
      pushToast,
      dismissTransient: jest.fn(),
      dismissPinned: jest.fn(),
    } as any);
    jest.mocked(useTransactionsContextualInsights).mockReturnValue({
      insights: null,
      isLoading: false,
      displayState: 'a',
      error: 'Failed to load insights.',
      accountKey: '',
    } as any);

    renderTransactionsPage(
      <TransactionsPage
        filterControl={{
          search: '',
          setSearch: jest.fn(),
          selectedCategory: null,
          setSelectedCategory: jest.fn(),
        }}
      />
    );

    expect(pushToast).toHaveBeenCalledWith('Failed to load insights.', 'error');
    expect(screen.queryByText('Error: Failed to load insights.')).not.toBeInTheDocument();
  });

  it('renders categorize actions inline with the transactions section header', () => {
    renderTransactionsPage(
      <TransactionsPage
        filterControl={{
          search: '',
          setSearch: jest.fn(),
          selectedCategory: null,
          setSelectedCategory: jest.fn(),
        }}
      />
    );

    const hero = screen.getByRole('heading', {
      level: 1,
      name: /explore your ledger/i,
    });
    expect(
      within(hero.closest('section') ?? hero).queryByRole('button', { name: /categorize/i })
    ).not.toBeInTheDocument();

    const transactionsHeading = screen.getByRole('heading', { name: 'Transactions' });
    const sectionHeader = transactionsHeading.parentElement;
    expect(sectionHeader).toHaveTextContent('Categorize');
    expect(sectionHeader?.className).toContain('justify-between');
    expect(screen.getByRole('button', { name: 'Manage categories' })).toBeInTheDocument();
    const categorizeButton = screen.getByRole('button', { name: /categorize/i });
    expect(categorizeButton).toBeEnabled();
    expect(categorizeButton.className).toContain('max-md:aspect-square');
    expect(categorizeButton.querySelector('span.hidden.md\\:inline')).toHaveTextContent(
      'Categorize'
    );
  });

  it('passes loading state to the insights panel independently from the list', () => {
    jest.mocked(useTransactionsContextualInsights).mockReturnValue({
      insights: null,
      displayState: 'a',
      isLoading: true,
      error: null,
      accountKey: '',
    } as any);

    renderTransactionsPage(
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

  it('renders the shared toast stack for auto-categorization job state', async () => {
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
    jest.spyOn(accountsToastStackModule, 'useAccountsToastStack').mockReturnValue({
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

    renderTransactionsPage(
      <TransactionsPage
        filterControl={{
          search: '',
          setSearch: jest.fn(),
          selectedCategory: null,
          setSelectedCategory: jest.fn(),
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('toast-stack')).toBeInTheDocument();
    });
    expect(screen.getByText('Synced 2 transactions')).toBeInTheDocument();
    expect(screen.getByText('Categorizing transactions…')).toBeInTheDocument();
  });
});
