import { render, screen } from '@testing-library/react';
import { TransactionsTable } from '@/features/transactions/components/TransactionsTable';
import type { Transaction } from '@/types/api';
import { text as uiTextRecipes } from '@/ui/recipes';

jest.mock('@/features/transactions/components/InlineCategoryCell', () => ({
  __esModule: true,
  default: ({ transaction }: { transaction: Transaction }) => (
    <span data-testid="inline-category-cell">{transaction.category?.primary}</span>
  ),
}));

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
        pageSize={3}
        onPrev={() => {}}
        onNext={() => {}}
      />
    );

    const positive = screen.getByText('$42.00').closest('td');
    const negative = screen.getByText('-$42.00').closest('td');
    const zero = screen.getByText('$0.00').closest('td');

    expect(positive?.className).toContain(uiTextRecipes.success);
    expect(negative?.className).toContain(uiTextRecipes.danger);
    expect(zero?.className).toContain(uiTextRecipes.muted);
  });

  it('pads the table with inert blank rows when the page is short', () => {
    const { container } = render(
      <TransactionsTable
        items={[baseTx(42), baseTx(-42)]}
        total={2}
        currentPage={1}
        totalPages={1}
        pageSize={4}
        onPrev={() => {}}
        onNext={() => {}}
      />
    );

    expect(container.querySelectorAll('tbody tr')).toHaveLength(4);
  });

  it('renders eight placeholder rows when no transactions match', () => {
    const { container } = render(
      <TransactionsTable
        items={[]}
        total={0}
        currentPage={1}
        totalPages={1}
        pageSize={8}
        onPrev={() => {}}
        onNext={() => {}}
      />
    );

    expect(container.querySelectorAll('tbody tr')).toHaveLength(8);
    expect(screen.getByText('No transactions found')).toBeInTheDocument();
  });

  it('keeps the category column on-screen by hiding the account column below md', () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1280,
    });
    window.dispatchEvent(new Event('resize'));

    render(
      <TransactionsTable
        items={[baseTx(42)]}
        total={1}
        currentPage={1}
        totalPages={1}
        pageSize={1}
        onPrev={() => {}}
        onNext={() => {}}
      />
    );

    expect(screen.getByText('Account').closest('th')?.className).toContain('hidden');
    expect(screen.getByText('Account').closest('th')?.className).toContain('md:table-cell');
    expect(screen.getByText('Category').closest('th')?.className).toContain('w-[30%]');
    expect(screen.getByText('Checking').closest('td')?.className).toContain('hidden');
    expect(screen.getByText('Checking').closest('td')?.className).toContain('md:table-cell');

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth,
    });
    window.dispatchEvent(new Event('resize'));
  });

  it.each([375, 900])('renders the compact list below the lg breakpoint (width %i)', (width) => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: width,
    });
    window.dispatchEvent(new Event('resize'));

    render(
      <TransactionsTable
        items={[baseTx(42)]}
        total={1}
        currentPage={1}
        totalPages={1}
        pageSize={1}
        onPrev={() => {}}
        onNext={() => {}}
      />
    );

    expect(screen.getByTestId('transactions-mobile-list')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth,
    });
    window.dispatchEvent(new Event('resize'));
  });

  it('renders the desktop table at lg and above', () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1280,
    });
    window.dispatchEvent(new Event('resize'));

    render(
      <TransactionsTable
        items={[baseTx(42)]}
        total={1}
        currentPage={1}
        totalPages={1}
        pageSize={1}
        onPrev={() => {}}
        onNext={() => {}}
      />
    );

    expect(screen.queryByTestId('transactions-mobile-list')).not.toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth,
    });
    window.dispatchEvent(new Event('resize'));
  });

  it('merchant cell title shows originalMerchantName when present', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    window.dispatchEvent(new Event('resize'));

    const txWithOriginal: Transaction = {
      ...baseTx(10),
      name: 'Costco',
      originalMerchantName: 'POS COSTCO WHSE #12 TULSA OK 537',
    };

    render(
      <TransactionsTable
        items={[txWithOriginal]}
        total={1}
        currentPage={1}
        totalPages={1}
        pageSize={1}
        onPrev={() => {}}
        onNext={() => {}}
      />
    );

    const merchantCell = screen.getByText('Costco').closest('td');
    expect(merchantCell).toHaveAttribute('title', 'POS COSTCO WHSE #12 TULSA OK 537');
  });

  it('merchant cell title falls back to name when originalMerchantName is absent', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    window.dispatchEvent(new Event('resize'));

    render(
      <TransactionsTable
        items={[baseTx(10)]}
        total={1}
        currentPage={1}
        totalPages={1}
        pageSize={1}
        onPrev={() => {}}
        onNext={() => {}}
      />
    );

    const merchantCell = screen.getByText('Coffee').closest('td');
    expect(merchantCell).toHaveAttribute('title', 'Coffee');
  });

  it('does not render the legacy merchant fallback when the canonical name is empty', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    window.dispatchEvent(new Event('resize'));

    render(
      <TransactionsTable
        items={[
          {
            ...baseTx(10),
            name: '',
            merchant: 'Legacy Merchant',
          },
        ]}
        total={1}
        currentPage={1}
        totalPages={1}
        pageSize={1}
        onPrev={() => {}}
        onNext={() => {}}
      />
    );

    expect(screen.queryByText('Legacy Merchant')).not.toBeInTheDocument();
    const merchantCell = screen.getByText('-').closest('td');
    expect(merchantCell).toHaveAttribute('title', '-');
  });
});
