import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { BudgetProgress } from '@/features/budgets/components/BudgetProgress';
import { TransactionsTable } from '@/features/transactions/components/TransactionsTable';
import type { Transaction } from '@/types/api';

jest.mock('@/features/transactions/components/InlineCategoryCell', () => ({
  __esModule: true,
  default: ({ transaction }: { transaction: Transaction }) =>
    createElement('span', { 'data-testid': 'inline-category-cell' }, transaction.category?.primary),
}));

const transaction = (amount: number): Transaction => ({
  id: `tx-${amount}`,
  date: '2025-01-15',
  name: 'Coffee',
  amount,
  category: { primary: 'Food' },
  account_name: 'Checking',
});

describe('dashboard surface components', () => {
  it('keeps the budget progress copy intact', () => {
    render(createElement(BudgetProgress, { amount: 500, spent: 220 }));

    expect(screen.getByText(/44% used/i)).toBeVisible();
    expect(screen.getByText(/\$280\.00 left/i)).toBeVisible();
  });

  it('keeps the transactions table navigation intact', () => {
    render(
      createElement(TransactionsTable, {
        items: [transaction(42), transaction(-42)],
        total: 2,
        currentPage: 1,
        totalPages: 1,
        pageSize: 2,
        onPrev: () => {},
        onNext: () => {},
      })
    );

    expect(screen.getByText(/showing 1-2 of 2/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
  });
});
