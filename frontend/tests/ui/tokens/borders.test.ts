import { designTokens } from '@/ui/tokens';
import generatedTokens from '@/ui/tokens/generated/tokens';

const expectedRoles = [
  'default',
  'subtle',
  'strong',
  'glass',
  'control',
  'divider',
  'focusActive',
  'hoverAccent',
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
    expect(Object.keys(designTokens.borders)).toEqual(expect.arrayContaining(expectedRoles));
  });

  it('maps the semantic border roles to generated token fields', () => {
    expect(Object.keys(generatedTokens.color)).toEqual(expect.arrayContaining(expectedTokenKeys));
  });

  it('keeps representative border recipes pinned to generated CSS variables', () => {
    expect(designTokens.borders.default).toEqual([
      'border-[var(--color-border-default)]',
      'dark:border-[var(--color-border-default-dark)]',
    ]);
    expect(designTokens.borders.glass).toEqual([
      'border-[var(--color-border-glass)]',
      'dark:border-[var(--color-border-glass-dark)]',
    ]);
    expect(designTokens.borders.danger).toEqual([
      'border-[var(--color-border-danger)]',
      'dark:border-[var(--color-border-danger-dark)]',
    ]);
    expect(generatedTokens.color['border-divider'].$value.hex).toBeDefined();
  });
});
