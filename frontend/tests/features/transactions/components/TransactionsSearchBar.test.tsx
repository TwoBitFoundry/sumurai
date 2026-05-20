import { render, screen } from '@testing-library/react';
import React from 'react';
import { TransactionsSearchBar } from '@/features/transactions/components/TransactionsSearchBar';

describe('TransactionsSearchBar', () => {
  it('keeps the search glyph compact', () => {
    render(<TransactionsSearchBar search="" onSearch={jest.fn()} />);

    const bar = screen.getByTestId('transactions-search-bar');
    expect(bar.querySelector('svg')?.getAttribute('class')).toContain('h-4');
    expect(bar.querySelector('svg')?.getAttribute('class')).toContain('w-4');
    expect(screen.getByPlaceholderText('Search transactions').className).toContain('!pl-11');
  });
});
