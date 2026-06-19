import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  it('searches by merchant when the merchant cell is clicked', () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Search transactions for Transfer' }));

    expect(onMerchantSearch).toHaveBeenCalledWith('Transfer');
  });

  it('searches by merchant when empty merchant cell space is clicked', () => {
    const onMerchantSearch = jest.fn();

    render(
      <DesktopTransactionRow
        transaction={{
          ...transaction,
          name: "Lowe's",
          originalMerchantName: 'LOWES #1234',
        }}
        index={0}
        onMerchantSearch={onMerchantSearch}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Search transactions for Lowe's/i }));

    expect(onMerchantSearch).toHaveBeenCalledWith("Lowe's");
  });

  it('shows raw merchant from the merchant name without searching', async () => {
    const user = userEvent.setup();
    const onMerchantSearch = jest.fn();

    render(
      <DesktopTransactionRow
        transaction={{
          ...transaction,
          name: "Lowe's",
          originalMerchantName: 'LOWES #1234',
        }}
        index={0}
        onMerchantSearch={onMerchantSearch}
      />
    );

    await user.click(screen.getByRole('button', { name: /Show raw merchant for Lowe's/i }));

    expect(onMerchantSearch).not.toHaveBeenCalled();
    expect(screen.getByText('Raw merchant')).toBeInTheDocument();
    expect(screen.getByText('LOWES #1234')).toBeInTheDocument();
  });

  it('does not search when another row cell is clicked', () => {
    const onMerchantSearch = jest.fn();

    render(
      <DesktopTransactionRow
        transaction={transaction}
        index={0}
        onMerchantSearch={onMerchantSearch}
      />
    );

    fireEvent.click(screen.getByText('5/31/2026'));

    expect(onMerchantSearch).not.toHaveBeenCalled();
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

  it('does not filter by account when the merchant cell is clicked', () => {
    const onAccountFilter = jest.fn();

    render(
      <DesktopTransactionRow
        transaction={transaction}
        index={0}
        onMerchantSearch={jest.fn()}
        onAccountFilter={onAccountFilter}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Search transactions for Transfer' }));

    expect(onAccountFilter).not.toHaveBeenCalled();
  });
});
