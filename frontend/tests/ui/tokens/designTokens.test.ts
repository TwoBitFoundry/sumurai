import generatedTokens from '@/ui/tokens/generated/tokens';
import { designTokens, getCategoryAccent, getThemeColors } from '@/ui/tokens';

describe('design tokens', () => {
  it('sources core raw values from the generated contract', () => {
    expect(designTokens.colors.brand.sky).toBe(generatedTokens.color['brand-sky'].$value.hex);
    expect(designTokens.colors.theme.dark.semantic.netWorth).toBe(
      generatedTokens.color['semantic-dark-net-worth'].$value.hex
    );
    expect(designTokens.colors.theme.light.chart.primary).toEqual([
      generatedTokens.color['chart-light-1'].$value.hex,
      generatedTokens.color['chart-light-2'].$value.hex,
      generatedTokens.color['chart-light-3'].$value.hex,
      generatedTokens.color['chart-light-4'].$value.hex,
      generatedTokens.color['chart-light-5'].$value.hex,
      generatedTokens.color['chart-light-6'].$value.hex,
    ]);
    expect(designTokens.typography.brand).toBe(generatedTokens.typography.brand.$value.fontFamily);
    expect(designTokens.radii.panel).toBe(`rounded-[${generatedTokens.rounded.panel.$value.value}rem]`);
    expect(designTokens.spacing.pageX).toContain('px-4');
  });

  it('keeps theme helpers aligned with the generated chart and semantic palettes', () => {
    expect(getThemeColors('light').chart.primary).toEqual([
      generatedTokens.color['chart-light-1'].$value.hex,
      generatedTokens.color['chart-light-2'].$value.hex,
      generatedTokens.color['chart-light-3'].$value.hex,
      generatedTokens.color['chart-light-4'].$value.hex,
      generatedTokens.color['chart-light-5'].$value.hex,
      generatedTokens.color['chart-light-6'].$value.hex,
    ]);
    expect(getThemeColors('dark').semantic.netWorth).toBe(
      generatedTokens.color['semantic-dark-net-worth'].$value.hex
    );
  });

  it('keeps category accent assignment stable', () => {
    const first = getCategoryAccent('Groceries');
    const second = getCategoryAccent('groceries');

    expect(first.key).toBe(second.key);
    expect(first.tag).toBe(second.tag);
    expect(first.ringHex).toBe(second.ringHex);
  });

  it('exposes stable public recipe roles for primitives and feature bundles', () => {
    expect(designTokens.components.button.primary.join(' ')).toContain('from-sky-500');
    expect(designTokens.components.glassCard.accent.join(' ')).toContain('dark:bg-[#111a2f]/75');
    expect(designTokens.components.onboarding.providerConnect.plaidEyebrowText.join(' ')).toContain(
      '#34d399'
    );
    expect(designTokens.components.budgetProgress.fill.within.join(' ')).toContain('from-sky-400');
    expect(designTokens.components.actions.paginationRound.join(' ')).toContain('rounded-full');
    expect(designTokens.components.pill.fadeLeft).toContain('#111a2f');
  });
});
