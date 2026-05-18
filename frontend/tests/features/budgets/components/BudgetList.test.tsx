import { render } from '@testing-library/react';
import { BudgetList } from '@/features/budgets/components/BudgetList';

describe('BudgetList', () => {
  it('keeps the budget grid on the lg tier without wider desktop escalation', () => {
    const { container } = render(
      <BudgetList
        items={[
          {
            id: 'budget-1',
            category: 'food and drink',
            amount: 100,
            spent: 25,
            percentage: 25,
          },
        ]}
        editingId={null}
        onStartEdit={jest.fn()}
        onCancelEdit={jest.fn()}
        onSaveEdit={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    const list = container.querySelector('ul');

    expect(list).toHaveClass('md:grid-cols-2');
    expect(list).toHaveClass('lg:grid-cols-3');
    expect(list).not.toHaveClass('xl:grid-cols-3');
    expect(list).not.toHaveClass('2xl:grid-cols-4');
  });
});
