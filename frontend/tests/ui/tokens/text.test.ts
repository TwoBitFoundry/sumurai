import generatedTokens from '@/ui/generated/tokens';
import { placeholder as uiPlaceholderRecipes, text as uiTextRecipes } from '@/ui/recipes';

const expectedRoles = [
  'primary',
  'body',
  'muted',
  'subtle',
  'label',
  'inverse',
  'accent',
  'danger',
  'success',
  'warning',
  'info',
];

const expectedColorTokens = expectedRoles.map((role) => `text-${role}`);

describe('design token text recipes', () => {
  it('exposes the semantic text roles', () => {
    expect(Object.keys(uiTextRecipes)).toEqual(expect.arrayContaining(expectedRoles));
  });

  it('keeps the semantic text roles backed by generated color tokens', () => {
    expect(Object.keys(generatedTokens.color)).toEqual(expect.arrayContaining(expectedColorTokens));
  });

  it('maps representative text roles to paired light and dark classes', () => {
    expect(uiTextRecipes.primary).toBe('text-[var(--color-text-primary)]');
    expect(generatedTokens.color['text-primary'].$value.hex).toBe('#011e5b');
    expect(uiTextRecipes.body).toContain('var(--color-brand-navy)');
    expect(uiTextRecipes.body).toContain('var(--color-brand-fog)');
    expect(uiTextRecipes.danger).toBe('text-[var(--color-brand-crimson)] dark:text-red-300');
  });

  it('exposes placeholder text recipes aligned with muted intent', () => {
    expect(uiPlaceholderRecipes.muted).toContain('var(--color-brand-navy)');
    expect(uiPlaceholderRecipes.muted).toContain('var(--color-brand-fog)');
  });
});
