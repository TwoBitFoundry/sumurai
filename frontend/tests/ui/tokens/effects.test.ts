import generatedTokens from '@/ui/generated/tokens';
import { effect as uiEffectRecipes } from '@/ui/recipes';

const expectedRoles = ['glassShadow', 'successGlow', 'dangerGlow', 'accentHover'];

const expectedTokenKeys = [
  'effect-glass-shadow',
  'effect-glass-shadow-dark',
  'effect-success-glow',
  'effect-success-glow-dark',
  'effect-warning-glow',
  'effect-warning-glow-dark',
  'effect-danger-glow',
  'effect-danger-glow-dark',
  'effect-accent-hover',
  'effect-accent-hover-dark',
];

describe('design token effect recipes', () => {
  it('exposes the semantic effect roles', () => {
    expect(Object.keys(uiEffectRecipes)).toEqual(expect.arrayContaining(expectedRoles));
  });

  it('maps the semantic effect roles to generated token fields', () => {
    expect(Object.keys(generatedTokens.color)).toEqual(expect.arrayContaining(expectedTokenKeys));
  });

  it('keeps representative effect recipes pinned to generated CSS variables', () => {
    expect(uiEffectRecipes.glassShadow).toEqual([
      'shadow-[0_32px_110px_-60px_var(--color-effect-glass-shadow)]',
      'dark:shadow-[0_36px_120px_-62px_var(--color-effect-glass-shadow)]',
    ]);
    expect(uiEffectRecipes.successGlow).toEqual([
      'shadow-[0_0_12px_var(--color-effect-success-glow)]',
      'dark:shadow-[0_0_12px_var(--color-effect-success-glow)]',
    ]);
    expect(uiEffectRecipes.dangerGlow).toEqual([
      'shadow-[0_0_12px_var(--color-effect-danger-glow)]',
      'dark:shadow-[0_0_12px_var(--color-effect-danger-glow)]',
    ]);
    expect(uiEffectRecipes.accentHover).toEqual([
      'hover:shadow-[0_18px_44px_-30px_var(--color-effect-accent-hover)]',
      'dark:hover:shadow-[0_20px_52px_-34px_var(--color-effect-accent-hover)]',
    ]);
  });
});
