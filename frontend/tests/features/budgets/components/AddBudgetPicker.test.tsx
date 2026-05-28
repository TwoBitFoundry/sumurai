import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { AddBudgetPicker } from '@/features/budgets/components/AddBudgetPicker';

describe('AddBudgetPicker', () => {
  const anchorRef = createRef<HTMLButtonElement>();
  const accentIndexByName = new Map([
    ['FOOD_AND_DRINK', 0],
    ['Coffee', 1],
  ]);

  beforeEach(() => {
    const anchor = document.createElement('button');
    anchorRef.current = anchor;
  });

  it('renders only available categories as selectable pills', () => {
    render(
      <AddBudgetPicker
        open
        anchorRef={anchorRef}
        categories={['FOOD_AND_DRINK', 'Coffee']}
        accentIndexByName={accentIndexByName}
        value={{ category: '', amount: '' }}
        onChange={jest.fn()}
        onSave={jest.fn()}
        onRequestClose={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Food & Drink' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Coffee' })).toBeInTheDocument();
    expect(screen.queryByTestId('budget-category-select')).not.toBeInTheDocument();
  });

  it('saves when a category and amount are provided', async () => {
    const onSave = jest.fn();
    const onChange = jest.fn();

    render(
      <AddBudgetPicker
        open
        anchorRef={anchorRef}
        categories={['ENTERTAINMENT']}
        accentIndexByName={new Map([['ENTERTAINMENT', 0]])}
        value={{ category: 'ENTERTAINMENT', amount: '120' }}
        onChange={onChange}
        onSave={onSave}
        onRequestClose={jest.fn()}
      />
    );

    const form = screen.getByLabelText('Amount').closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
