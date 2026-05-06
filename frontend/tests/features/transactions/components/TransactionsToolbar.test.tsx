import { render, screen } from '@testing-library/react';
import TransactionsToolbar from '@/features/transactions/components/TransactionsToolbar';

describe('TransactionsToolbar', () => {
  it('renders filter chrome for search and category selection', () => {
    render(
      <TransactionsToolbar
        search=""
        onSearch={jest.fn()}
        categories={['Food', 'Travel']}
        selectedCategory={null}
        onSelectCategory={jest.fn()}
      />
    );

    expect(screen.getByTestId('transactions-toolbar')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search transactions...')).toBeInTheDocument();
    expect(screen.getByText('Filter')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /food/i })).toBeInTheDocument();
  });
});
