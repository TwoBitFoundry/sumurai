import { render, screen } from '@testing-library/react';
import { TransactionsTable } from '@/features/transactions/components/TransactionsTable';
import type { Transaction } from '@/types/api';
import { designTokens } from '@/ui/tokens';

const baseTx = (amount: number): Transaction => ({
  id: `id-${amount}`,
  date: '2025-01-15',
  name: 'Coffee',
  amount,
  category: { primary: 'Food' },
  account_name: 'Checking',
});

describe('TransactionsTable text tokens', () => {
  it('uses semantic danger and success roles for signed amounts', () => {
    render(
      <TransactionsTable
        items={[baseTx(42), baseTx(-42), baseTx(0)]}
        total={3}
        currentPage={1}
        totalPages={1}
        onPrev={() => {}}
        onNext={() => {}}
      />
    );

    const positive = screen.getByText('$42.00').closest('td');
    const negative = screen.getByText('-$42.00').closest('td');
    const zero = screen.getByText('$0.00').closest('td');

    expect(positive?.className).toContain(designTokens.text.danger);
    expect(negative?.className).toContain(designTokens.text.success);
    expect(zero?.className).toContain(designTokens.text.muted);
  });
});
