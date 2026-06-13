import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { useBudgets } from '@/features/budgets/hooks/useBudgets';
import {
  setSessionBudgetsSectionExpanded,
  setSessionCollapsibleExpanded,
} from '@/utils/sessionPreferences';
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
  fixedExpenses: [],
  filteredFixedExpenses: [],
  insightsFixedExpenses: [],
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
    setSessionBudgetsSectionExpanded('fixed-expenses', true);
    setSessionBudgetsSectionExpanded('budgets', true);
    setSessionCollapsibleExpanded('budget-insights', true);
    jest.mocked(useBudgets).mockReturnValue(baseUseBudgetsMock as any);
  });

  it('renders four insight cards replacing the old hero cards', () => {
    render(<BudgetsPage monthControl={monthControl} />);

    expect(screen.getByTestId('budget-insights-shell')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /budget insights/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByText('Runway')).toBeInTheDocument();
    expect(screen.getByText('Free Spend')).toBeInTheDocument();
    expect(screen.getByText('Fixed Costs')).toBeInTheDocument();

    expect(screen.queryByText('Days remaining')).not.toBeInTheDocument();
    expect(screen.queryByText('Subscription costs')).not.toBeInTheDocument();
    expect(screen.queryByText('Overages')).not.toBeInTheDocument();
  });

  it('shows budget and fixed expense glass cards with budgets first', async () => {
    jest.mocked(useBudgets).mockReturnValue({ ...baseUseBudgetsMock, computedBudgets: [] } as any);
    render(<BudgetsPage monthControl={monthControl} />);

    await waitFor(() => {
      expect(screen.getByTestId('budgets-empty-state')).toBeInTheDocument();
    });

    const cards = Array.from(screen.getByTestId('page-children').firstElementChild?.children ?? []);
    const fixedExpensesCardIndex = cards.findIndex((card) =>
      card.querySelector('[data-testid="fixed-expenses-section"]')
    );
    const budgetsCardIndex = cards.findIndex((card) =>
      card.querySelector('[data-testid="budgets-empty-state"]')
    );

    expect(budgetsCardIndex).toBeGreaterThanOrEqual(0);
    expect(fixedExpensesCardIndex).toBeGreaterThan(budgetsCardIndex);

    for (const card of cards) {
      expect(card.className).toContain('shadow-[0_8px_32px');
      expect(card.className).not.toContain('drop-shadow-[');
    }
  });

  it('keeps the insight shell visible in the page stats area', () => {
    render(<BudgetsPage monthControl={monthControl} />);

    expect(screen.getByTestId('budget-insights-shell')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /budget insights/i })).toBeInTheDocument();
  });

  it('moves save to the add button slot and hides edit while editing', async () => {
    const user = userEvent.setup();
    render(<BudgetsPage monthControl={monthControl} />);

    expect(screen.getByRole('button', { name: 'Edit budgets' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Budget' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save budgets' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit budgets' }));

    expect(screen.queryByRole('button', { name: 'Edit budgets' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Budget' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save budgets' })).toBeInTheDocument();
  });

  it('opens the add budget picker while the budgets section stays collapsed', async () => {
    setSessionCollapsibleExpanded('budgets', false);
    jest.mocked(useBudgets).mockReturnValue({
      ...baseUseBudgetsMock,
      availableCategoryOptions: ['ENTERTAINMENT', 'FOOD_AND_DRINK'],
    } as any);

    const user = userEvent.setup();
    render(<BudgetsPage monthControl={monthControl} />);

    expect(screen.getByRole('button', { name: 'Show budgets' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.queryByText('Spent')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Budget' }));

    await waitFor(() => {
      expect(screen.getByTestId('add-budget-picker-content')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Show budgets' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('expands the budgets section when edit is selected while collapsed', async () => {
    setSessionCollapsibleExpanded('budgets', false);
    const user = userEvent.setup();
    render(<BudgetsPage monthControl={monthControl} />);

    expect(screen.getByRole('button', { name: 'Show budgets' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );

    await user.click(screen.getByRole('button', { name: 'Edit budgets' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Hide budgets' })).toHaveAttribute(
        'aria-expanded',
        'true'
      );
    });
    expect(screen.getByTestId('budget-amount-input')).toBeInTheDocument();
  });
});
