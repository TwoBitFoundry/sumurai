import generatedTokens from '@/ui/generated/tokens';
import { effect as uiEffectRecipes } from '@/ui/recipes';

const expectedRoles = [
  'glassShadow',
  'glassDropShadow',
  'successGlow',
  'dangerGlow',
  'warningGlow',
  'accentHover',
  'accentOutlineGlow',
  'accentOutlineGlowCta',
  'accentOutlineGlowHover',
];

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
  'effect-accent-outline-glow',
  'effect-accent-outline-glow-dark',
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
    ]);
    expect(uiEffectRecipes.glassDropShadow).toEqual([
      'drop-shadow-[0_10px_12px_rgba(15,23,42,0.35)]',
      'dark:drop-shadow-[0_10px_12px_rgba(148,163,184,0.28)]',
    ]);
    expect(uiEffectRecipes.successGlow).toEqual([
      'shadow-[0_0_12px_var(--color-effect-success-glow)]',
    ]);
    expect(uiEffectRecipes.dangerGlow).toEqual([
      'shadow-[0_0_12px_var(--color-effect-danger-glow)]',
    ]);
    expect(uiEffectRecipes.warningGlow).toEqual([
      'shadow-[0_0_12px_var(--color-effect-warning-glow)]',
    ]);
    expect(uiEffectRecipes.accentHover).toEqual([
      'hover:shadow-[0_18px_44px_-30px_var(--color-effect-accent-hover)]',
    ]);
    expect(uiEffectRecipes.accentOutlineGlow).toEqual([
      'shadow-[inset_0_0_0_2px_color-mix(in_srgb,var(--color-effect-accent-outline-glow)_60%,transparent)]',
    ]);
    expect(uiEffectRecipes.accentOutlineGlowCta).toEqual([
      'shadow-[0_0_12px_var(--color-effect-accent-outline-glow)]',
    ]);
    expect(uiEffectRecipes.accentOutlineGlowHover).toEqual([
      'hover:shadow-[inset_0_0_0_2px_color-mix(in_srgb,var(--color-effect-accent-outline-glow)_60%,transparent)]',
    ]);
  });
});
