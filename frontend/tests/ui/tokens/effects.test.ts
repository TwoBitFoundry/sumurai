import generatedTokens from '@/ui/generated/tokens';
import { effect as uiEffectRecipes } from '@/ui/recipes';

const expectedRoles = [
  'glassDropShadow',
  'glassElevationShadow',
  'tabBarDropShadow',
  'bottomBarDropShadow',
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
    expect(uiEffectRecipes.glassDropShadow).toEqual([
      'drop-shadow-[0_8px_32px_color-mix(in_srgb,var(--color-effect-glass-shadow)_22%,transparent)]',
    ]);
    expect(uiEffectRecipes.glassElevationShadow).toEqual([
      'shadow-[0_8px_32px_color-mix(in_srgb,var(--color-effect-glass-shadow)_22%,transparent)]',
    ]);
    expect(uiEffectRecipes.successGlow).toEqual([
      'drop-shadow-[0_0_12px_var(--color-effect-success-glow)]',
    ]);
    expect(uiEffectRecipes.dangerGlow).toEqual([
      'drop-shadow-[0_0_12px_var(--color-effect-danger-glow)]',
    ]);
    expect(uiEffectRecipes.warningGlow).toEqual([
      'drop-shadow-[0_0_12px_var(--color-effect-warning-glow)]',
    ]);
    expect(uiEffectRecipes.accentHover).toEqual([
      'hover:drop-shadow-[0_10px_36px_color-mix(in_srgb,var(--color-effect-accent-hover)_32%,transparent)]',
    ]);
    expect(uiEffectRecipes.accentOutlineGlow).toEqual([
      'ring-2 ring-inset ring-[color:color-mix(in_srgb,var(--color-effect-accent-outline-glow)_60%,transparent)]',
    ]);
    expect(uiEffectRecipes.accentOutlineGlowCta).toEqual([
      'drop-shadow-[0_0_12px_var(--color-effect-accent-outline-glow)]',
    ]);
    expect(uiEffectRecipes.accentOutlineGlowHover).toEqual([
      'hover:ring-2 hover:ring-inset hover:ring-[color:color-mix(in_srgb,var(--color-effect-accent-outline-glow)_60%,transparent)]',
    ]);
  });
});
