import generatedTokens from '@/ui/generated/tokens';
import { status as uiStatusRecipes } from '@/ui/recipes';

const expectedRoles = ['info', 'success', 'warning', 'danger'];

const expectedTokenKeys = [
  'status-info-surface',
  'status-info-surface-dark',
  'status-info-border',
  'status-info-border-dark',
  'status-info-text',
  'status-info-text-dark',
  'status-info-strong-surface',
  'status-info-strong-surface-dark',
  'status-info-icon',
  'status-info-icon-dark',
  'status-success-surface',
  'status-success-surface-dark',
  'status-success-border',
  'status-success-border-dark',
  'status-success-text',
  'status-success-text-dark',
  'status-success-strong-surface',
  'status-success-strong-surface-dark',
  'status-success-icon',
  'status-success-icon-dark',
  'status-warning-surface',
  'status-warning-surface-dark',
  'status-warning-border',
  'status-warning-border-dark',
  'status-warning-text',
  'status-warning-text-dark',
  'status-warning-strong-surface',
  'status-warning-strong-surface-dark',
  'status-warning-icon',
  'status-warning-icon-dark',
  'status-danger-surface',
  'status-danger-surface-dark',
  'status-danger-border',
  'status-danger-border-dark',
  'status-danger-text',
  'status-danger-text-dark',
  'status-danger-strong-surface',
  'status-danger-strong-surface-dark',
  'status-danger-icon',
  'status-danger-icon-dark',
];

describe('design token status recipes', () => {
  it('exposes the semantic status tone roles', () => {
    expect(Object.keys(uiStatusRecipes)).toEqual(expect.arrayContaining(expectedRoles));
  });

  it('maps the semantic status tone roles to generated token fields', () => {
    expect(Object.keys(generatedTokens.color)).toEqual(expect.arrayContaining(expectedTokenKeys));
  });

  it('keeps representative status recipes pinned to generated CSS variables', () => {
    expect(uiStatusRecipes.info.surface).toEqual([
      'bg-[var(--color-status-info-surface)]',
      'dark:bg-[var(--color-status-info-surface)]',
    ]);
    expect(uiStatusRecipes.success.text).toEqual([
      'text-[var(--color-status-success-text)]',
      'dark:text-[var(--color-status-success-text)]',
    ]);
    expect(uiStatusRecipes.warning.icon).toEqual([
      'text-[var(--color-status-warning-icon)]',
      'dark:text-[var(--color-status-warning-icon)]',
    ]);
    expect(uiStatusRecipes.danger.border).toEqual([
      'border-[var(--color-status-danger-border)]',
      'dark:border-[var(--color-status-danger-border)]',
    ]);
    expect(uiStatusRecipes.danger.surface).toEqual([
      'bg-[color:color-mix(in_srgb,var(--color-status-danger-surface)_82%,transparent)]',
      'dark:bg-[color:color-mix(in_srgb,var(--color-status-danger-surface)_28%,transparent)]',
    ]);
  });
});
