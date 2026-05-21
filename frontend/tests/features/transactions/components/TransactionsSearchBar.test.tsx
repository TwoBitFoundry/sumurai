import { render, screen } from '@testing-library/react';
import React from 'react';
import { TransactionsSearchBar } from '@/features/transactions/components/TransactionsSearchBar';
import { chromeBar, floatingChromeSearch } from '@/ui/recipes';

describe('TransactionsSearchBar', () => {
  it('uses the floating chrome search scale to align with the account filter pill', () => {
    render(<TransactionsSearchBar search="" onSearch={jest.fn()} />);

    const bar = screen.getByTestId('transactions-search-bar');
    const input = screen.getByPlaceholderText('Search transactions');

    expect(bar.querySelector('svg')?.getAttribute('class')).toContain(floatingChromeSearch.glyph);
    expect(input.className).toContain('h-[52px]');
    expect(input.className).toContain('md:h-12');
    expect(input.className).toContain(chromeBar.height);
    expect(input.className).toContain('!pl-11');
  });
});
