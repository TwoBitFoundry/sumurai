import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionsFilters } from '@/features/transactions/components/TransactionsFilters';

describe('TransactionsFilters', () => {
  it('renders category filters as filter chip buttons', async () => {
    const onSelectCategory = jest.fn();
    const user = userEvent.setup();

    render(
      <TransactionsFilters
        search=""
        onSearch={jest.fn()}
        categories={['food_and_drink', 'entertainment']}
        selectedCategory={null}
        onSelectCategory={onSelectCategory}
        showSearch={false}
      />
    );

    const foodButton = screen.getByRole('button', { name: 'Food And Drink' });
    expect(foodButton.className).toContain('rounded-full');
    expect(foodButton.className).toContain('cursor-pointer');
    expect(foodButton).toHaveAttribute('aria-pressed', 'false');

    await user.click(foodButton);
    expect(onSelectCategory).toHaveBeenCalledWith('food_and_drink');
  });

  it('marks the active category filter as pressed', () => {
    render(
      <TransactionsFilters
        search=""
        onSearch={jest.fn()}
        categories={['entertainment']}
        selectedCategory="entertainment"
        onSelectCategory={jest.fn()}
        showSearch={false}
      />
    );

    expect(screen.getByRole('button', { name: 'Entertainment' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});
