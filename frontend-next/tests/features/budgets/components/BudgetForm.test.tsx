import { render, fireEvent } from '@testing-library/react';
import { BudgetForm } from '@/features/budgets/components/BudgetForm';

describe('BudgetForm', () => {
  it('renders and calls onSave', () => {
    const onSave = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <BudgetForm
        categories={['groceries', 'entertainment']}
        usedCategories={new Set()}
        value={{ category: '', amount: '' }}
        onChange={() => {}}
        onCancel={() => {}}
        onSave={onSave}
      />
    );
    fireEvent.click(getByText('Save'));
    expect(onSave).toHaveBeenCalled();
  });
});
