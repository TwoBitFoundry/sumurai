import { render } from '@testing-library/react';
import type React from 'react';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';
import TransactionsPage from '@/views/TransactionsPage';

jest.mock('@/features/transactions/hooks/useTransactions', () => ({
  useTransactions: jest.fn(),
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
});
