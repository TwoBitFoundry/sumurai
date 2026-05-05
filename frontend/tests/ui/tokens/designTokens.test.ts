import { designTokens, getCategoryAccent, getThemeColors } from '@/ui/tokens';

describe('design tokens', () => {
  it('exposes stable typography, radius, spacing, shadow, and motion tokens', () => {
    expect(designTokens.typography.brand).toBe("'Cal Sans', system-ui, sans-serif");
    expect(designTokens.radii.panel).toBe('rounded-[2.25rem]');
    expect(designTokens.spacing.pageX).toBe('px-4 sm:px-6 lg:px-8');
    expect(designTokens.shadows.glass.dark).toContain('rgba(2,6,23,0.85)');
    expect(designTokens.motion.aura).toBe('animate-[rotateAura_95s_linear_infinite]');
  });

  it('exposes dark and light chart and semantic token sets', () => {
    expect(getThemeColors('light').chart.primary).toEqual([
      '#0ea5e9',
      '#10b981',
      '#f59e0b',
      '#ef4444',
      '#8b5cf6',
      '#059669',
    ]);
    expect(getThemeColors('dark').semantic.netWorth).toBe('#a78bfa');
  });

  it('keeps category accent assignment stable', () => {
    const first = getCategoryAccent('Groceries');
    const second = getCategoryAccent('groceries');

    expect(first.key).toBe(second.key);
    expect(first.tag).toBe(second.tag);
    expect(first.ringHex).toBe(second.ringHex);
  });
});
