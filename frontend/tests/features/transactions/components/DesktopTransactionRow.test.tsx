import { fireEvent, render, screen } from '@testing-library/react';
import DesktopTransactionRow from '@/features/transactions/components/DesktopTransactionRow';
import type { Transaction } from '@/types/api';

jest.mock('@/features/transactions/hooks/useCategories', () => ({
  useCategories: () => ({
    all: ['SHOPPING'],
    accentIndexByName: new Map<string, number>(),
  }),
}));

jest.mock('@/features/transactions/hooks/useUpdateTransactionCategory', () => ({
  useUpdateTransactionCategory: () => ({
    updateTransactionCategory: jest.fn(),
  }),
}));

jest.mock('@/features/transactions/components/CategoryPicker', () => ({
  __esModule: true,
  default: () => null,
}));

const transaction: Transaction = {
  id: 'tx-1',
  date: '2026-05-31',
  name: 'Transfer',
  amount: -200,
  category: { primary: 'TRANSFER_OUT' },
  account_id: 'account-savings',
  account_name: 'Sumurai Savings (2001)',
  account_mask: '2001',
};

describe('DesktopTransactionRow', () => {
  it('searches by merchant when the row is clicked', () => {
    const onMerchantSearch = jest.fn();

    render(
      <DesktopTransactionRow
        transaction={transaction}
        index={0}
        onMerchantSearch={onMerchantSearch}
      />
    );

    expect(screen.getByRole('row').className).toContain(
      'grid-cols-[minmax(0,9rem)_minmax(0,1fr)_minmax(0,8rem)'
    );
    fireEvent.click(screen.getByRole('row'));

    expect(onMerchantSearch).toHaveBeenCalledWith('Transfer');
  });

  it('does not search when the category control is clicked', () => {
    const onMerchantSearch = jest.fn();

    render(
      <DesktopTransactionRow
        transaction={transaction}
        index={0}
        onMerchantSearch={onMerchantSearch}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Edit category: Transfer Out/i }));

    expect(onMerchantSearch).not.toHaveBeenCalled();
  });

  it('filters by account when the account control is clicked', () => {
    const onAccountFilter = jest.fn();

    render(
      <DesktopTransactionRow
        transaction={transaction}
        index={0}
        onAccountFilter={onAccountFilter}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Sumurai Savings \(2001\) ••••2001/i }));

    expect(onAccountFilter).toHaveBeenCalledWith('account-savings');
  });

  it('does not filter by account when the row is clicked', () => {
    const onAccountFilter = jest.fn();

    render(
      <DesktopTransactionRow
        transaction={transaction}
        index={0}
        onMerchantSearch={jest.fn()}
        onAccountFilter={onAccountFilter}
      />
    );

    fireEvent.click(screen.getByRole('row'));

    expect(onAccountFilter).not.toHaveBeenCalled();
  });
});
