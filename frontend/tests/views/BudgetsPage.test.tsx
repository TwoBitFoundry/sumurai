import { render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { useBudgets } from '@/features/budgets/hooks/useBudgets';
import { setSessionBudgetsSectionExpanded } from '@/utils/sessionPreferences';
import BudgetsPage from '@/views/BudgetsPage';

jest.mock('@/features/budgets/hooks/useBudgets', () => ({
  useBudgets: jest.fn(),
}));

jest.mock('@/features/transactions/hooks/useCategories', () => ({
  useCategories: () => ({
    system: [],
    custom: [],
    all: [],
    accentIndexByName: new Map(),
    isLoading: false,
    error: null,
  }),
}));

jest.mock('@/layouts/PageLayout', () => ({
  PageLayout: ({ children, stats }: { children?: React.ReactNode; stats?: React.ReactNode }) => (
    <div data-testid="page-layout">
      <div data-testid="page-stats">{stats}</div>
      <div data-testid="page-children">{children}</div>
    </div>
  ),
}));

jest.mock('@/utils/sessionPreferences', () => {
  const actual = jest.requireActual(
    '@/utils/sessionPreferences'
  ) as typeof import('@/utils/sessionPreferences');
  return {
    ...actual,
  };
});

const monthControl = {
  month: new Date('2026-05-01'),
  monthLabel: 'May 2026',
  range: { start: '2026-05-01', end: '2026-05-31' },
  setMonth: jest.fn(),
  goToPreviousMonth: jest.fn(),
  goToNextMonth: jest.fn(),
  goToCurrentMonth: jest.fn(),
};

const makeSubscription = (merchant: string) => ({
  merchant,
  normalized_merchant: merchant.toLowerCase(),
  monthly_cost: '9.99',
  cadence: 'Monthly',
  last_charged: '2026-05-01',
  first_charged: '2026-05-01',
  occurrence_count: 3,
  account_ids: [],
});

const baseUseBudgetsMock = {
  isLoading: false,
  transactionsLoading: false,
  error: null,
  validationError: null,
  add: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  computedBudgets: [
    { id: 'b1', category: 'FOOD_AND_DRINK', amount: 200, spent: 80, percentage: 40 },
  ],
  transactions: [],
  subscriptions: [],
  filteredSubscriptions: [],
  filterKey: 'all',
  categoryOptions: [],
  availableCategoryOptions: [],
  usedCategories: new Set(),
  month: new Date('2026-05-01'),
  monthLabel: 'May 2026',
  range: { start: '2026-05-01', end: '2026-05-31' },
  setMonth: jest.fn(),
  goToPreviousMonth: jest.fn(),
  goToNextMonth: jest.fn(),
  goToCurrentMonth: jest.fn(),
  load: jest.fn(),
  categories: [],
  budgets: [],
};

describe('BudgetsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
    setSessionBudgetsSectionExpanded('subscriptions', true);
    setSessionBudgetsSectionExpanded('budgets', true);
    jest.mocked(useBudgets).mockReturnValue(baseUseBudgetsMock as any);
  });

  it('renders four insight cards replacing the old hero cards', () => {
    render(<BudgetsPage monthControl={monthControl} />);

    expect(screen.getByText('Runway Pace')).toBeInTheDocument();
    expect(screen.getByText('Free Spend')).toBeInTheDocument();
    expect(screen.getByText('Sub Costs')).toBeInTheDocument();

    expect(screen.queryByText('Days remaining')).not.toBeInTheDocument();
    expect(screen.queryByText('Subscription costs')).not.toBeInTheDocument();
    expect(screen.queryByText('Overages')).not.toBeInTheDocument();
  });

  it('shows subscription and budget glass cards with subscriptions first', async () => {
    jest.mocked(useBudgets).mockReturnValue({ ...baseUseBudgetsMock, computedBudgets: [] } as any);
    render(<BudgetsPage monthControl={monthControl} />);

    await waitFor(() => {
      expect(screen.getByTestId('budgets-empty-state')).toBeInTheDocument();
    });

    const cards = Array.from(screen.getByTestId('page-children').firstElementChild?.children ?? []);
    const subscriptionsCardIndex = cards.findIndex((card) =>
      card.querySelector('[data-testid="subscriptions-section"]')
    );
    const budgetsCardIndex = cards.findIndex((card) =>
      card.querySelector('[data-testid="budgets-empty-state"]')
    );

    expect(subscriptionsCardIndex).toBeGreaterThanOrEqual(0);
    expect(budgetsCardIndex).toBeGreaterThan(subscriptionsCardIndex);
  });

  it('keeps the insight grid in one column on mobile, two on tablet, and three on desktop', () => {
    render(<BudgetsPage monthControl={monthControl} />);

    const statsGrid = screen.getByTestId('budget-insights-grid');
    expect(statsGrid).toHaveClass('grid-cols-1');
    expect(statsGrid).toHaveClass('md:grid-cols-2');
    expect(statsGrid).toHaveClass('lg:grid-cols-3');
  });
});
