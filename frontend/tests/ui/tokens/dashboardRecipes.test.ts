import { dashboardTokenRecipes } from '@/views/tokenRecipes';

describe('dashboard token recipes', () => {
  it('keeps the floating range selector on the shared glass outline recipe', () => {
    expect(dashboardTokenRecipes.floatingRangeShell).toEqual(
      expect.arrayContaining([
        'border-[color:color-mix(in_srgb,var(--color-border-glass)_35%,transparent)]',
        'dark:border-[color:color-mix(in_srgb,var(--color-border-glass-dark)_12%,transparent)]',
        'bg-[color:color-mix(in_srgb,var(--color-surface-card)_70%,transparent)]',
        'dark:bg-[color:color-mix(in_srgb,var(--color-surface-card-dark)_55%,transparent)]',
      ])
    );
    expect(dashboardTokenRecipes.floatingRangeShell).not.toEqual(
      expect.arrayContaining([
        'ring-[var(--color-border-divider)]',
        'dark:ring-[var(--color-border-divider-dark)]',
      ])
    );
  });

  it('keeps the transaction table footer on the shared glass recipe', () => {
    expect(dashboardTokenRecipes.tableFooter).toEqual(
      expect.arrayContaining([
        'border-[color:color-mix(in_srgb,var(--color-border-glass)_35%,transparent)]',
        'dark:border-[color:color-mix(in_srgb,var(--color-border-glass-dark)_12%,transparent)]',
        'bg-[color:color-mix(in_srgb,var(--color-surface-card)_70%,transparent)]',
        'dark:bg-[color:color-mix(in_srgb,var(--color-surface-card-dark)_55%,transparent)]',
        'backdrop-blur-md',
      ])
    );
    expect(dashboardTokenRecipes.tableFooter).not.toEqual(
      expect.arrayContaining([
        'bg-[var(--color-surface-muted-chip)]',
        'dark:bg-[var(--color-surface-muted-chip-dark)]',
      ])
    );
  });
});
