import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { TransactionListPopover } from '@/features/transactions/components/TransactionListPopover';

jest.mock('@/features/transactions/components/VirtualizedTransactionList', () => ({
  __esModule: true,
  default: () => <div data-testid="virtualized-transaction-list" />,
}));

describe('TransactionListPopover', () => {
  const anchorRef = createRef<HTMLElement>();
  const originalInnerWidth = window.innerWidth;

  const setViewport = (width: number) => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: width,
    });
    window.dispatchEvent(new Event('resize'));
  };

  beforeEach(() => {
    setViewport(1280);
    const anchor = document.createElement('button');
    anchorRef.current = anchor;
  });

  afterAll(() => {
    setViewport(originalInnerWidth);
  });

  it('renders an anchored popover on desktop', () => {
    setViewport(1280);
    render(
      <TransactionListPopover
        open
        anchorRef={anchorRef}
        context={{ type: 'category', category: 'FOOD_AND_DRINK' }}
        onRequestClose={jest.fn()}
      />
    );
    expect(screen.getByTestId('transaction-list-popover-popover')).toBeInTheDocument();
    expect(screen.queryByTestId('transaction-list-popover-sheet')).not.toBeInTheDocument();
  });

  it('renders a bottom drawer on mobile', () => {
    setViewport(375);
    render(
      <TransactionListPopover
        open
        anchorRef={anchorRef}
        context={{ type: 'merchant', merchant: 'Starbucks' }}
        onRequestClose={jest.fn()}
      />
    );
    expect(screen.getByTestId('transaction-list-popover-sheet')).toBeInTheDocument();
    expect(screen.queryByTestId('transaction-list-popover-popover')).not.toBeInTheDocument();
  });

  it('renders an anchored popover on tablet', () => {
    setViewport(800);
    render(
      <TransactionListPopover
        open
        anchorRef={anchorRef}
        context={{
          type: 'budget',
          category: 'FOOD_AND_DRINK',
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        }}
        onRequestClose={jest.fn()}
      />
    );
    expect(screen.getByTestId('transaction-list-popover-popover')).toBeInTheDocument();
    expect(screen.queryByTestId('transaction-list-popover-sheet')).not.toBeInTheDocument();
  });

  it('shows the transactions title for a category context', () => {
    setViewport(1280);
    render(
      <TransactionListPopover
        open
        anchorRef={anchorRef}
        context={{ type: 'category', category: 'FOOD_AND_DRINK' }}
        onRequestClose={jest.fn()}
      />
    );
    expect(screen.getByText('Transactions')).toBeInTheDocument();
  });

  it('shows the transactions title for a merchant context', () => {
    setViewport(1280);
    render(
      <TransactionListPopover
        open
        anchorRef={anchorRef}
        context={{ type: 'merchant', merchant: 'Whole Foods' }}
        onRequestClose={jest.fn()}
      />
    );
    expect(screen.getByText('Transactions')).toBeInTheDocument();
  });
});
