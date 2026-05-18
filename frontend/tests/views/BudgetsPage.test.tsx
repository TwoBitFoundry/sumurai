import { render } from '@testing-library/react';
import type React from 'react';
import { useBudgets } from '@/features/budgets/hooks/useBudgets';
import BudgetsPage from '@/views/BudgetsPage';

jest.mock('@/features/budgets/hooks/useBudgets', () => ({
  useBudgets: jest.fn(),
}));

jest.mock('@/layouts/PageLayout', () => ({
  PageLayout: ({ children, stats }: { children?: React.ReactNode; stats?: React.ReactNode }) => (
    <div data-testid="page-layout">
      <div data-testid="page-stats">{stats}</div>
      <div data-testid="page-children">{children}</div>
    </div>
  ),
}));

describe('BudgetsPage', () => {
  beforeEach(() => {
    jest.mocked(useBudgets).mockReturnValue({
      isLoading: false,
      transactionsLoading: false,
      error: null,
      validationError: null,
      add: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      computedBudgets: [],
      categoryOptions: [],
      usedCategories: new Set(),
      month: new Date('2026-05-01'),
      monthLabel: 'May 2026',
      goToPreviousMonth: jest.fn(),
      goToNextMonth: jest.fn(),
      goToCurrentMonth: jest.fn(),
    } as any);
  });

  it('moves the budget stats grid to the md tier', () => {
    const { container } = render(
      <BudgetsPage
        monthControl={{
          month: new Date('2026-05-01'),
          monthLabel: 'May 2026',
          range: { start: '2026-05-01', end: '2026-05-31' },
          setMonth: jest.fn(),
          goToPreviousMonth: jest.fn(),
          goToNextMonth: jest.fn(),
          goToCurrentMonth: jest.fn(),
        }}
      />
    );
    const statsGrid = container.querySelector(
      '[data-testid="page-layout"] .grid.gap-3'
    ) as HTMLElement | null;
    const budgetShell = container.querySelector('[data-testid="page-children"] > div');

    expect(statsGrid).toHaveClass('md:grid-cols-2');
    expect(statsGrid).not.toHaveClass('sm:grid-cols-2');
    expect(budgetShell).toHaveClass('p-4');
    expect(budgetShell).toHaveClass('pt-5');
    expect(budgetShell).toHaveClass('md:p-8');
    expect(budgetShell).toHaveClass('lg:p-8');
  });
});
