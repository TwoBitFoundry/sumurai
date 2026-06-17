import { render, screen } from '@testing-library/react';
import { TransactionsSearchBar } from '@/features/transactions/components/TransactionsSearchBar';

describe('TransactionsSearchBar', () => {
  it('caps width at all breakpoints for the contextual search field', () => {
    render(<TransactionsSearchBar search="" onSearch={jest.fn()} />);

    const bar = screen.getByTestId('transactions-search-bar');
    expect(bar.className).toContain('w-64');
    expect(bar.className).toContain('max-w-full');
    expect(bar.className).not.toContain('md:w-64');
  });
});
