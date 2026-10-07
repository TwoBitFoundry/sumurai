import { render, screen } from '@testing-library/react';
import { TransactionsTable } from '@/features/transactions/components/TransactionsTable';
import type { Transaction } from '@/types/api';

const baseTransaction = {
  id: 'txn-1',
  date: '2024-01-15',
  name: 'Test Transaction',
  merchant: 'Test Transaction',
  category: { primary: 'OTHER' },
  account_name: 'Checking',
  account_type: 'depository',
  provider: 'teller',
} satisfies Omit<Transaction, 'amount'>;

const renderTable = (items: Transaction[]) =>
  render(
    <TransactionsTable
      items={items}
      total={items.length}
      currentPage={1}
      totalPages={1}
      onPrev={jest.fn()}
      onNext={jest.fn()}
      duplicateCandidateIds={[]}
      onMarkDuplicate={jest.fn()}
      userCategories={[]}
      onCategorySelect={jest.fn()}
      onCategoryReset={jest.fn()}
      onCategoryCreate={jest.fn()}
      onCategoryRule={jest.fn()}
      onCategoryDelete={jest.fn()}
    />
  );

describe('TransactionsTable', () => {
  it('shows deposits as positive green amounts', () => {
    renderTable([{ ...baseTransaction, id: 'deposit', amount: -1500 }]);

    const amount = screen.getByText('$1,500.00');
    expect(amount).toHaveClass('text-green-600');
    expect(amount).not.toHaveClass('text-red-600');
  });

  it('shows credit card purchases as negative red amounts', () => {
    renderTable([{ ...baseTransaction, id: 'purchase', account_type: 'credit', amount: -147.34 }]);

    const amount = screen.getByText('-$147.34');
    expect(amount).toHaveClass('text-red-600');
    expect(amount).not.toHaveClass('text-green-600');
  });

  it('normalizes string amounts from the backend before display math', () => {
    renderTable([
      {
        ...baseTransaction,
        id: 'string-credit-purchase',
        account_type: 'credit',
        amount: '-35.00' as unknown as number,
      },
    ]);

    const amount = screen.getByText('-$35.00');
    expect(amount).toHaveClass('text-red-600');
  });

  it('shows credit card refunds as positive green amounts', () => {
    renderTable([{ ...baseTransaction, id: 'refund', account_type: 'credit', amount: 37.9 }]);

    const amount = screen.getByText('$37.90');
    expect(amount).toHaveClass('text-green-600');
    expect(amount).not.toHaveClass('text-red-600');
  });

  it('shows normalized checking spending as negative red amounts', () => {
    renderTable([{ ...baseTransaction, id: 'checking-purchase', amount: 42.25 }]);

    const amount = screen.getByText('-$42.25');
    expect(amount).toHaveClass('text-red-600');
    expect(amount).not.toHaveClass('text-green-600');
  });

  it('renders date-only transaction dates without timezone drift', () => {
    renderTable([
      { ...baseTransaction, id: 'pending-card-purchase', date: '2026-05-02', amount: -35 },
    ]);

    expect(screen.getByText('5/2/2026')).toBeInTheDocument();
  });

  it('renders visual cue badge for pending transactions', () => {
    renderTable([
      {
        ...baseTransaction,
        id: 'txn-pending',
        name: 'Coffee Shop',
        amount: -4.5,
        pending: true,
      },
    ]);

    const badge = screen.getByTestId('pending-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent(/pending/i);
  });

  it('does not render pending visual cue badge for posted transactions', () => {
    renderTable([
      {
        ...baseTransaction,
        id: 'txn-posted',
        name: 'Coffee Shop',
        amount: -4.5,
        pending: false,
      },
    ]);

    expect(screen.queryByTestId('pending-badge')).not.toBeInTheDocument();
  });
});
