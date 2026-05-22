import { render } from '@testing-library/react';
import type React from 'react';
import { useBudgets } from '@/features/budgets/hooks/useBudgets';
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
      availableCategoryOptions: [],
      usedCategories: new Set(),
      month: new Date('2026-05-01'),
      monthLabel: 'May 2026',
      goToPreviousMonth: jest.fn(),
      goToNextMonth: jest.fn(),
      goToCurrentMonth: jest.fn(),
    } as any);
  });

  it('keeps the budget stats grid in two columns on mobile', () => {
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
    const budgetListCard = container.querySelector(
      '[data-testid="page-children"] [class*="border-subtle"]'
    );

    expect(statsGrid).toHaveClass('grid-cols-2');
    expect(statsGrid).toHaveClass('lg:grid-cols-4');
    expect(budgetListCard).toBeTruthy();
  });

  it('keeps the budget insight rails edge to edge on desktop', () => {
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
    const footerScrolls = container.querySelectorAll(
      '[data-testid="hero-stat-card-footer-scroll"]'
    );

    expect(footerScrolls.length).toBeGreaterThan(0);
    footerScrolls.forEach((footerScroll) => {
      expect(footerScroll).toHaveClass('w-full');
      expect(footerScroll).not.toHaveClass('lg:max-w-[10rem]');
    });
  });
});
