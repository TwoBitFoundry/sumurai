import generatedTokens from '@/ui/generated/tokens';
import { surface as uiSurfaceRecipes } from '@/ui/recipes';

const expectedRoles = [
  'appShell',
  'glassPanel',
  'solidPanel',
  'card',
  'elevatedCard',
  'hoverRow',
  'overlay',
  'insetWell',
  'mutedChip',
];

const expectedTokenKeys = [
  'surface-app-shell',
  'surface-app-shell-dark',
  'surface-glass-panel',
  'surface-glass-panel-dark',
  'surface-solid-panel',
  'surface-solid-panel-dark',
  'surface-card',
  'surface-card-dark',
  'surface-elevated-card',
  'surface-elevated-card-dark',
  'surface-data-row',
  'surface-data-row-dark',
  'surface-hover-row',
  'surface-hover-row-dark',
  'surface-input-control',
  'surface-input-control-dark',
  'surface-overlay',
  'surface-overlay-dark',
  'surface-inset-well',
  'surface-inset-well-dark',
  'surface-muted-chip',
  'surface-muted-chip-dark',
];

describe('design token surface recipes', () => {
  it('exposes the semantic surface roles', () => {
    expect(Object.keys(uiSurfaceRecipes)).toEqual(expect.arrayContaining(expectedRoles));
  });

  it('maps the semantic surface roles to generated token fields', () => {
    expect(Object.keys(generatedTokens.color)).toEqual(expect.arrayContaining(expectedTokenKeys));
  });

  it('keeps representative surface recipes pinned to generated CSS variables', () => {
    expect(uiSurfaceRecipes.appShell).toEqual([
      'bg-[var(--color-surface-app-shell)]',
      'dark:bg-[var(--color-surface-app-shell)]',
    ]);
    expect(uiSurfaceRecipes.glassPanel).toEqual([
      'bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_18%,transparent)]',
      'dark:bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_55%,transparent)]',
    ]);
    expect(uiSurfaceRecipes.card).toEqual([
      'bg-[color:color-mix(in_srgb,var(--color-surface-card)_70%,transparent)]',
      'dark:bg-[color:color-mix(in_srgb,var(--color-surface-card)_55%,transparent)]',
    ]);
    expect(uiSurfaceRecipes.overlay).toEqual([
      'bg-[color:color-mix(in_srgb,var(--color-surface-overlay)_20%,transparent)]',
      'dark:bg-[color:color-mix(in_srgb,var(--color-surface-overlay)_36%,transparent)]',
    ]);
    expect(uiSurfaceRecipes.mutedChip).toEqual([
      'bg-[var(--color-surface-muted-chip)]',
      'dark:bg-[var(--color-surface-muted-chip)]',
    ]);
    expect(generatedTokens.color['surface-card'].$value.hex).toBeDefined();
  });
});
