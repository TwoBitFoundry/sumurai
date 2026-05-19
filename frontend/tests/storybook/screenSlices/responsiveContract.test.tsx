import { render } from '@testing-library/react';
import { BudgetsScreenSlice } from '@/storybook/screenSlices/BudgetsScreenSlice';
import { SettingsScreenSlice } from '@/storybook/screenSlices/SettingsScreenSlice';
import { TransactionsScreenSlice } from '@/storybook/screenSlices/TransactionsScreenSlice';

describe('storybook screen slices responsive contract', () => {
  it('keeps the transactions slice stats grid in two columns on mobile', () => {
    const { container } = render(<TransactionsScreenSlice state="loaded" />);
    const statsGrid = container.querySelector(
      '[data-testid="transactions-page"] .grid.gap-3'
    ) as HTMLElement | null;

    expect(statsGrid).toHaveClass('grid-cols-2');
    expect(statsGrid).toHaveClass('lg:grid-cols-4');
  });

  it('keeps the budgets slice stats grid in two columns on mobile', () => {
    const { container } = render(<BudgetsScreenSlice state="loaded" />);
    const statsGrid = container.querySelector(
      '[data-testid="budgets-page"] .grid.gap-3'
    ) as HTMLElement | null;

    expect(statsGrid).toHaveClass('grid-cols-2');
    expect(statsGrid).toHaveClass('lg:grid-cols-4');
  });

  it('keeps the settings slice aligned to the dashboard content width on the md tier', () => {
    const { container } = render(<SettingsScreenSlice scenario="default" />);
    const settingsShell = container.querySelector(
      '[data-testid="settings-screen-slice"]'
    ) as HTMLElement | null;

    expect(settingsShell).toHaveClass('w-full');
    expect(settingsShell).toHaveClass('md:px-8');
    expect(settingsShell).toHaveClass('lg:px-8');
    expect(settingsShell).not.toHaveClass('max-w-2xl');
  });
});
