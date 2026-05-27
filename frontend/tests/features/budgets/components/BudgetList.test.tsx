import { render, screen } from '@testing-library/react';
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

  it('keeps budget actions in the header without a dedicated footer block', () => {
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
    const header = card?.querySelector('.relative.z-10.flex.items-start.justify-between.gap-3');
    const editButton = header?.querySelector('[aria-label="Edit budget"]');
    const deleteButton = header?.querySelector('[aria-label="Delete budget"]');

    expect(card?.textContent).toContain('Food & Drink');
    expect(card?.querySelector('.mt-4.space-y-2')).toBeNull();
    expect(editButton).toBeTruthy();
    expect(deleteButton).toBeTruthy();
  });

  it('shows spent before planned in the budget stat row', () => {
    render(
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

    const spentLabel = screen.getByText('Spent');
    const plannedLabel = screen.getByText('Planned');

    expect(
      spentLabel.compareDocumentPosition(plannedLabel) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(plannedLabel.parentElement).toHaveClass('text-right');
  });
});
