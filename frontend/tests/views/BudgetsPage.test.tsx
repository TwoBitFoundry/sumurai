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
});

const baseUseBudgetsMock = {
  isLoading: false,
  transactionsLoading: false,
  error: null,
  validationError: null,
  add: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  computedBudgets: [],
  subscriptions: [],
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
};

describe('BudgetsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
    setSessionBudgetsSectionExpanded('subscriptions', true);
    setSessionBudgetsSectionExpanded('budgets', true);
    jest.mocked(useBudgets).mockReturnValue(baseUseBudgetsMock as any);
  });

  it('renders hero row in Days remaining, subscription costs, Overages order', () => {
    jest.mocked(useBudgets).mockReturnValue({
      ...baseUseBudgetsMock,
      subscriptions: [makeSubscription('Spotify')],
    } as any);

    render(<BudgetsPage monthControl={monthControl} />);

    const titles = screen.getAllByText(/Days remaining|Subscription costs|Overages/);
    expect(titles.map((node) => node.textContent)).toEqual([
      'Days remaining',
      'Subscription costs',
      'Overages',
    ]);
    expect(screen.queryByText('Active budgets')).not.toBeInTheDocument();
    expect(screen.queryByText('Monitor')).not.toBeInTheDocument();
  });

  it('shows subscription and budget glass cards with subscriptions first', async () => {
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

  it('keeps the budget stats grid in two columns on mobile', () => {
    const { container } = render(<BudgetsPage monthControl={monthControl} />);
    const statsGrid = container.querySelector(
      '[data-testid="page-layout"] .grid.gap-3'
    ) as HTMLElement | null;

    expect(statsGrid).toHaveClass('grid-cols-2');
    expect(statsGrid).toHaveClass('lg:grid-cols-3');
  });
});
