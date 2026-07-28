import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { BudgetToolbar } from '@/features/budgets/components/BudgetToolbar';
import { ControlTooltipProvider } from '@/ui/primitives/ControlHoverLabel';
import { control } from '@/ui/recipes';

describe('BudgetToolbar', () => {
  it('uses md control sizing for toolbar actions', () => {
    const addButtonRef = createRef<HTMLButtonElement>();

    render(
      <ControlTooltipProvider>
        <BudgetToolbar
          loading={false}
          isPickerOpen={false}
          addButtonRef={addButtonRef}
          onAddBudget={jest.fn()}
          isEditing={false}
          canEdit
          onStartEdit={jest.fn()}
          onSaveEdit={jest.fn()}
        />
      </ControlTooltipProvider>
    );

    const addBudgetButton = screen.getByRole('button', { name: 'Add budget' });
    expect(addBudgetButton.className).toContain(control.height.md);
    expect(addBudgetButton.className).not.toContain(control.height.lg);
    expect(addBudgetButton).toHaveAttribute('aria-expanded', 'false');
    expect(addBudgetButton.querySelector('svg')?.getAttribute('class')).toContain(control.glyph.md);
  });
});
