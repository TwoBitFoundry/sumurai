import generatedTokens from '@/ui/generated/tokens';
import { border as uiBorderRecipes } from '@/ui/recipes';

const expectedRoles = [
  'default',
  'subtle',
  'glass',
  'control',
  'divider',
  'hoverAccent',
  'focusActive',
  'danger',
];

const expectedTokenKeys = [
  'border-default',
  'border-default-dark',
  'border-subtle',
  'border-subtle-dark',
  'border-strong',
  'border-strong-dark',
  'border-glass',
  'border-glass-dark',
  'border-control',
  'border-control-dark',
  'border-divider',
  'border-divider-dark',
  'border-focus-active',
  'border-focus-active-dark',
  'border-hover-accent',
  'border-hover-accent-dark',
  'border-danger',
  'border-danger-dark',
];

describe('design token border recipes', () => {
  it('exposes the semantic border roles', () => {
    expect(Object.keys(uiBorderRecipes)).toEqual(expect.arrayContaining(expectedRoles));
  });

  it('maps the semantic border roles to generated token fields', () => {
    expect(Object.keys(generatedTokens.color)).toEqual(expect.arrayContaining(expectedTokenKeys));
  });

  it('keeps representative border recipes pinned to generated CSS variables', () => {
    expect(uiBorderRecipes.default).toEqual([
      'border-[var(--color-border-default)]',
      'dark:border-[var(--color-border-default)]',
    ]);
    expect(uiBorderRecipes.glass).toEqual([
      'border-[color:color-mix(in_srgb,var(--color-border-glass)_35%,transparent)]',
      'dark:border-[color:color-mix(in_srgb,var(--color-border-glass)_12%,transparent)]',
    ]);
    expect(uiBorderRecipes.danger).toEqual([
      'border-[var(--color-border-danger)]',
      'dark:border-[var(--color-border-danger)]',
    ]);
    expect(generatedTokens.color['border-divider'].$value.hex).toBeDefined();
  });
});
