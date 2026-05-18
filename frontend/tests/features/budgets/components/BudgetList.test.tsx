import { render } from '@testing-library/react';
import { BudgetList } from '@/features/budgets/components/BudgetList';
import { radius as uiRadiusRecipes } from '@/ui/recipes';

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
    const card = container.querySelector('li');

    expect(list).toHaveClass('md:grid-cols-2');
    expect(list).toHaveClass('lg:grid-cols-3');
    expect(list).not.toHaveClass('xl:grid-cols-3');
    expect(list).not.toHaveClass('2xl:grid-cols-4');
    expect(list).toHaveClass('mt-4');
    expect(card).toHaveClass(uiRadiusRecipes.standard);
  });

  it('places budget actions above the category pill', () => {
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

    const card = container.querySelector('li');
    const headerStack = card?.querySelector('div.space-y-2');
    const actionRow = headerStack?.firstElementChild;
    const divider = headerStack?.children[1];
    const metricsStack = card?.querySelector('div.mt-2');

    expect(headerStack).toBeTruthy();
    expect(actionRow?.querySelector('[aria-label="Edit budget"]')).toBeTruthy();
    expect(divider).toHaveClass('h-px');
    expect(headerStack?.lastElementChild).toHaveTextContent('Food and drink');
    expect(headerStack).toHaveClass('space-y-2');
    expect(metricsStack).not.toHaveClass('md:mt-4');
  });
});
