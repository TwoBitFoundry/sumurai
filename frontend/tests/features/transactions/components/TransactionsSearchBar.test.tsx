import { render, screen } from '@testing-library/react';
import React from 'react';
import { TransactionsSearchBar } from '@/features/transactions/components/TransactionsSearchBar';
import { chromeBar, floatingChromeSearch } from '@/ui/recipes';

const defaultPaginationProps = {
  currentPage: 1,
  totalPages: 3,
  onPrev: jest.fn(),
  onNext: jest.fn(),
};

describe('TransactionsSearchBar', () => {
  it('uses the floating chrome search scale to align with the account filter pill', () => {
    render(<TransactionsSearchBar search="" onSearch={jest.fn()} {...defaultPaginationProps} />);

    const bar = screen.getByTestId('transactions-search-bar');
    const input = screen.getByPlaceholderText('Search transactions');

    expect(bar.querySelector('svg')?.getAttribute('class')).toContain(floatingChromeSearch.glyph);
    expect(input.className).toContain('h-[52px]');
    expect(input.className).toContain('md:h-12');
    expect(input.className).toContain(chromeBar.height);
    expect(input.className).toContain('!pl-11');
  });

  it('renders pagination controls to the right of search', () => {
    render(
      <TransactionsSearchBar search="coffee" onSearch={jest.fn()} {...defaultPaginationProps} />
    );

    expect(screen.getByTestId('transactions-search-pagination')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();
  });

  it('sizes pagination controls to match the floating chrome search field', () => {
    render(<TransactionsSearchBar search="" onSearch={jest.fn()} {...defaultPaginationProps} />);

    const input = screen.getByPlaceholderText('Search transactions');
    const previousPage = screen.getByRole('button', { name: 'Previous page' });

    expect(previousPage.className).toContain('h-[52px]');
    expect(previousPage.className).toContain('md:h-12');
    expect(previousPage.className).toContain('w-[52px]');
    expect(previousPage.className).toContain('md:w-12');
    expect(input.className).toContain(floatingChromeSearch.height);
  });

  it('uses the floating chrome glass surface on pagination controls', () => {
    render(<TransactionsSearchBar search="" onSearch={jest.fn()} {...defaultPaginationProps} />);

    const previousPage = screen.getByRole('button', { name: 'Previous page' });

    expect(previousPage.className).toContain('backdrop-blur-md');
    expect(previousPage.className).toContain('var(--color-surface-glass-panel)');
    expect(previousPage.className).not.toContain('var(--color-surface-card)');
  });
});
