import { render } from '@testing-library/react';
import { BudgetsScreenSlice } from '@/storybook/screenSlices/BudgetsScreenSlice';
import { SettingsScreenSlice } from '@/storybook/screenSlices/SettingsScreenSlice';
import { TransactionsScreenSlice } from '@/storybook/screenSlices/TransactionsScreenSlice';

describe('storybook screen slices responsive contract', () => {
  it('keeps the transactions slice stats grid on the md tier', () => {
    const { container } = render(<TransactionsScreenSlice state="loaded" />);
    const statsGrid = container.querySelector(
      '[data-testid="transactions-page"] .grid.gap-3'
    ) as HTMLElement | null;

    expect(statsGrid).toHaveClass('md:grid-cols-2');
    expect(statsGrid).not.toHaveClass('sm:grid-cols-2');
  });

  it('keeps the budgets slice stats grid on the md tier', () => {
    const { container } = render(<BudgetsScreenSlice state="loaded" />);
    const statsGrid = container.querySelector(
      '[data-testid="budgets-page"] .grid.gap-3'
    ) as HTMLElement | null;

    expect(statsGrid).toHaveClass('md:grid-cols-2');
    expect(statsGrid).not.toHaveClass('sm:grid-cols-2');
  });

  it('keeps the settings slice header row on the md tier', () => {
    const { container } = render(<SettingsScreenSlice scenario="default" />);
    const appearanceRow = container.querySelector('div.flex.flex-col.gap-3') as HTMLElement | null;

    expect(appearanceRow).toHaveClass('md:flex-row');
    expect(appearanceRow).toHaveClass('md:items-center');
    expect(appearanceRow).toHaveClass('md:justify-between');
    expect(appearanceRow).not.toHaveClass('sm:flex-row', 'sm:items-center', 'sm:justify-between');
  });
});
