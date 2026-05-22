import { render } from '@testing-library/react';
import { BudgetList } from '@/features/budgets/components/BudgetList';
import { radius as uiRadiusRecipes } from '@/ui/recipes';

jest.mock('@/features/transactions/hooks/useCategories', () => ({
  useCategories: () => ({
    system: [],
    custom: [],
    all: [],
    accentIndexByName: new Map(),
    isLoading: false,
    error: null,
  }),
}));

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

    expect(list).toHaveClass('grid-cols-1');
    expect(list).toHaveClass('md:grid-cols-2');
    expect(list).toHaveClass('lg:grid-cols-3');
    expect(list).not.toHaveClass('xl:grid-cols-3');
    expect(list).not.toHaveClass('2xl:grid-cols-4');
    expect(card).toHaveClass(uiRadiusRecipes.standard);
  });

  it('places the divider and budget actions at the bottom of the card', () => {
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
    const footer = card?.querySelector('.mt-4.space-y-2');
    const divider = footer?.firstElementChild;
    const actionRow = footer?.lastElementChild;

    expect(card?.textContent).toContain('Food and drink');
    expect(footer).toHaveClass('mt-4');
    expect(footer).toHaveClass('space-y-2');
    expect(divider).toHaveClass('h-px');
    expect(actionRow?.querySelector('[aria-label="Edit budget"]')).toBeTruthy();
  });
});
