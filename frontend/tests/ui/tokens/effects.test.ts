import { designTokens } from '@/ui/tokens';
import generatedTokens from '@/ui/tokens/generated/tokens';

const expectedRoles = [
  'glassShadow',
  'successGlow',
  'warningGlow',
  'dangerGlow',
  'accentHover',
  'chartTooltipShadow',
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
  'effect-chart-tooltip-shadow',
  'effect-chart-tooltip-shadow-dark',
];

describe('design token effect recipes', () => {
  it('exposes the semantic effect roles', () => {
    expect(Object.keys(designTokens.effects.semantic)).toEqual(
      expect.arrayContaining(expectedRoles)
    );
  });

  it('maps the semantic effect roles to generated token fields', () => {
    expect(Object.keys(generatedTokens.color)).toEqual(expect.arrayContaining(expectedTokenKeys));
  });

  it('keeps representative effect recipes pinned to generated CSS variables', () => {
    expect(designTokens.effects.semantic.glassShadow).toEqual([
      'shadow-[0_32px_110px_-60px_var(--color-effect-glass-shadow)]',
      'dark:shadow-[0_36px_120px_-62px_var(--color-effect-glass-shadow-dark)]',
    ]);
    expect(designTokens.effects.semantic.successGlow).toEqual([
      'shadow-[0_0_12px_var(--color-effect-success-glow)]',
      'dark:shadow-[0_0_12px_var(--color-effect-success-glow-dark)]',
    ]);
    expect(designTokens.effects.semantic.dangerGlow).toEqual([
      'shadow-[0_0_12px_var(--color-effect-danger-glow)]',
      'dark:shadow-[0_0_12px_var(--color-effect-danger-glow-dark)]',
    ]);
    expect(designTokens.effects.semantic.accentHover).toEqual([
      'hover:shadow-[0_18px_44px_-30px_var(--color-effect-accent-hover)]',
      'dark:hover:shadow-[0_20px_52px_-34px_var(--color-effect-accent-hover-dark)]',
    ]);
  });
});
