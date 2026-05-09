import { designTokens } from '@/ui/tokens';
import generatedTokens from '@/ui/tokens/generated/tokens';

const expectedRoles = [
  'appShell',
  'glassPanel',
  'solidPanel',
  'card',
  'elevatedCard',
  'dataRow',
  'hoverRow',
  'inputControl',
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
    expect(Object.keys(designTokens.surfaces.semantic)).toEqual(
      expect.arrayContaining(expectedRoles)
    );
  });

  it('maps the semantic surface roles to generated token fields', () => {
    expect(Object.keys(generatedTokens.color)).toEqual(expect.arrayContaining(expectedTokenKeys));
  });

  it('keeps representative surface recipes pinned to generated CSS variables', () => {
    expect(designTokens.surfaces.semantic.appShell).toEqual([
      'bg-[var(--color-surface-app-shell)]',
      'dark:bg-[var(--color-surface-app-shell-dark)]',
    ]);
    expect(designTokens.surfaces.semantic.overlay).toEqual([
      'bg-[var(--color-surface-overlay)]',
      'dark:bg-[var(--color-surface-overlay-dark)]',
    ]);
    expect(designTokens.surfaces.semantic.mutedChip).toEqual([
      'bg-[var(--color-surface-muted-chip)]',
      'dark:bg-[var(--color-surface-muted-chip-dark)]',
    ]);
    expect(generatedTokens.color['surface-card'].$value.hex).toBeDefined();
  });
});
