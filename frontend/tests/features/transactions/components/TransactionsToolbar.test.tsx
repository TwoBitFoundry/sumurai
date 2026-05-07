import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ComponentProps } from 'react';
import TransactionsToolbar from '@/features/transactions/components/TransactionsToolbar';

function ToolbarHarness(
  props: Omit<ComponentProps<typeof TransactionsToolbar>, 'search' | 'onSearch'>
) {
  const [search, setSearch] = useState('');
  return <TransactionsToolbar {...props} search={search} onSearch={setSearch} />;
}

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

  it('forwards search input changes to onSearch', async () => {
    const user = userEvent.setup();
    render(
      <ToolbarHarness
        categories={[]}
        selectedCategory={null}
        onSelectCategory={jest.fn()}
      />
    );

    const field = screen.getByPlaceholderText('Search transactions...');
    await user.type(field, 'coffee');
    expect(field).toHaveValue('coffee');
  });

  it('invokes onSelectCategory when a category chip is chosen', async () => {
    const onSelectCategory = jest.fn();
    const user = userEvent.setup();
    render(
      <TransactionsToolbar
        search=""
        onSearch={jest.fn()}
        categories={['Food', 'Travel']}
        selectedCategory={null}
        onSelectCategory={onSelectCategory}
      />
    );

    await user.click(screen.getByRole('button', { name: /^travel$/i }));
    expect(onSelectCategory).toHaveBeenCalledWith('Travel');
  });
});
