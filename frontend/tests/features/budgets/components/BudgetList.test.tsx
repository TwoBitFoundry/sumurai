import { render, screen } from '@testing-library/react';
import { BudgetList } from '@/features/budgets/components/BudgetList';
import { radius as uiRadiusRecipes } from '@/ui/recipes';
import { heroAccents } from '@/ui/tokens';

jest.mock('@/features/transactions/hooks/useTransactionListLauncher', () => ({
  useTransactionListLauncher: () => ({
    openTransactionList: jest.fn(),
    close: jest.fn(),
  }),
}));

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
        isEditing={false}
        drafts={{}}
        onDraftChange={jest.fn()}
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
    const cardShell = container.querySelector('li > div');
    expect(cardShell?.className).toContain('bg-[var(--color-surface-card)]');
    expect(cardShell?.className).toContain('dark:bg-[var(--color-brand-navy)]');
    expect(cardShell?.className).not.toContain('bg-transparent');
    expect(cardShell?.className).not.toContain('backdrop-blur-md');
    expect(cardShell?.className).not.toMatch(/drop-shadow-\[/);
    expect(cardShell?.className).toContain('border-[var(--color-border-subtle)]');
    const insetRing = container.querySelector('.hero-stat-card__inset-ring');
    expect(insetRing).toHaveClass('group-hover:opacity-100');
    expect((insetRing as HTMLElement).style.boxShadow).toBe(
      `inset 0 0 0 2px ${heroAccents.azure.ringHex}`
    );
  });

  it('hides per-card actions in the view state', () => {
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
        isEditing={false}
        drafts={{}}
        onDraftChange={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    const card = container.querySelector('li');

    expect(card?.textContent).toContain('Food & Drink');
    expect(card?.querySelector('.mt-4.space-y-2')).toBeNull();
    expect(card?.querySelector('[aria-label="Edit budget"]')).toBeNull();
    expect(card?.querySelector('[aria-label="Delete budget"]')).toBeNull();
  });

  it('shows only the delete action in the edit state', () => {
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
        isEditing
        drafts={{}}
        onDraftChange={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    const card = container.querySelector('li');

    expect(card?.querySelector('[aria-label="Delete budget"]')).toBeTruthy();
    expect(card?.querySelector('[aria-label="Edit budget"]')).toBeNull();
    const amountInput = container.querySelector('[data-testid="budget-amount-input"]');
    expect(amountInput).toBeTruthy();
    expect(amountInput?.className).not.toContain('drop-shadow-');
  });

  it('shows spent before planned around the progress bar', () => {
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
        isEditing={false}
        drafts={{}}
        onDraftChange={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    const spentLabel = screen.getByText('Spent');
    const plannedLabel = screen.getByText('Planned');

    expect(
      spentLabel.compareDocumentPosition(plannedLabel) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(plannedLabel).toHaveClass('text-right');
    expect(screen.queryByText('25%')).not.toBeInTheDocument();
    expect(container.querySelector('[role="progressbar"]')).toBeTruthy();
    expect(screen.getByText('$100.00')).toHaveClass('text-right');
  });
});
