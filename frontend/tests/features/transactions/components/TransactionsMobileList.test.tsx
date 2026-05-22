import { render, screen } from '@testing-library/react';
import { TransactionsMobileList } from '@/features/transactions/components/TransactionsMobileList';
import type { Transaction } from '@/types/api';

jest.mock('@/features/transactions/components/InlineCategoryCell', () => ({
  __esModule: true,
  default: ({ transaction }: { transaction: Transaction }) => (
    <span data-testid="inline-category-cell">{transaction.category?.primary}</span>
  ),
}));

const transaction: Transaction = {
  id: 'tx-1',
  date: '2026-05-21',
  name: 'Bank Of All',
  amount: 69.65,
  category: { primary: 'GENERAL_MERCHANDISE' },
  account_name: 'Platinum Card',
  account_mask: '6017',
};

describe('TransactionsMobileList', () => {
  it('renders a stacked compact row without a table', () => {
    render(
      <TransactionsMobileList
        items={[transaction]}
        currentPage={1}
        pageSize={8}
        animationKey="page-1"
      />
    );

    expect(screen.getByTestId('transactions-mobile-list')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Bank Of All')).toBeInTheDocument();
    expect(screen.getByText('$69.65')).toBeInTheDocument();
    expect(screen.getByTitle(/Platinum Card/)).toBeInTheDocument();
    expect(screen.getByText(/Platinum Card/)).toBeInTheDocument();
    expect(screen.getByText(/6017/)).toBeInTheDocument();
    expect(screen.getByTestId('inline-category-cell')).toBeInTheDocument();
  });

  it('applies ellipsis styling to long merchant names', () => {
    render(
      <TransactionsMobileList
        items={[
          {
            ...transaction,
            name: 'International Conglomerate Of Very Long Business Names LLC',
          },
        ]}
        currentPage={1}
        pageSize={8}
        animationKey="page-1"
      />
    );

    const merchant = screen.getByTitle(
      'International Conglomerate Of Very Long Business Names LLC'
    );
    expect(merchant.className).toContain('text-ellipsis');
    expect(merchant.className).toContain('overflow-hidden');
  });

  it('includes the year on the meta line for every transaction', () => {
    render(
      <TransactionsMobileList
        items={[transaction]}
        currentPage={1}
        pageSize={8}
        animationKey="page-1"
      />
    );

    expect(screen.getByTitle(/2026/)).toBeInTheDocument();
  });
});
