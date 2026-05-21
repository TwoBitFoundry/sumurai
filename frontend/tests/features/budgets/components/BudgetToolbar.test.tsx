import { render, screen } from '@testing-library/react';
import { BudgetToolbar } from '@/features/budgets/components/BudgetToolbar';
import { control } from '@/ui/recipes';

describe('BudgetToolbar', () => {
  it('uses md control sizing for toolbar actions', () => {
    render(
      <BudgetToolbar loading={false} isAdding={false} showAddButton onAddBudget={jest.fn()} />
    );

    const addBudgetButton = screen.getByRole('button', { name: 'Add budget' });
    expect(addBudgetButton.className).toContain(control.height.md);
    expect(addBudgetButton.className).not.toContain(control.height.lg);
    expect(addBudgetButton.querySelector('svg')?.getAttribute('class')).toContain(control.glyph.md);
  });
});
