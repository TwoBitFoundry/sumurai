import { render } from '@testing-library/react';
import type React from 'react';
import { useCategories } from '@/features/transactions/hooks/useCategories';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';
import { useTransactionsInsights } from '@/features/transactions/hooks/useTransactionsInsights';
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

jest.mock('@/layouts/PageLayout', () => ({
  PageLayout: ({ children, stats }: { children?: React.ReactNode; stats?: React.ReactNode }) => (
    <div data-testid="page-layout">
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

describe('TransactionsPage', () => {
  beforeEach(() => {
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

    expect(getAllByText('Loading...')).toHaveLength(4);
  });
});
