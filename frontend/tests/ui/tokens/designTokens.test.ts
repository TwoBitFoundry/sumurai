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

  it('exposes budget progress surface classes', () => {
    expect(designTokens.components.budgetProgress.fill.within).toContain('from-sky-400');
    expect(designTokens.components.budgetProgress.fill.over).toContain('from-rose-400');
    expect(designTokens.components.budgetProgress.track.join(' ')).toContain('rounded-full');
  });

  it('exposes account type dot colors and connect chrome tokens', () => {
    expect(designTokens.colors.accountTypeDot.checking).toBe('#38bdf8');
    expect(designTokens.components.connectButton.secondary.join(' ')).toContain('#e2e8f0');
    expect(designTokens.components.menuDropdown.content.join(' ')).toContain('rounded-2xl');
  });

  it('exposes deferred-screen surface and onboarding component bundles', () => {
    expect(designTokens.surfaces.glass.panelDark.join(' ')).toContain('#0f172a');
    expect(designTokens.surfaces.layered.dataRowDark70.join(' ')).toContain('#1e293b');
    expect(designTokens.components.budgetCard.shell.join(' ')).toContain('rounded-[1.75rem]');
    expect(designTokens.components.actions.budgetDeleteIcon.join(' ')).toContain('red-500/15');
    expect(designTokens.components.actions.accountsToolbar.join(' ')).toContain('rounded-full');
    expect(designTokens.components.onboarding.providerConnect.plaidEyebrowBg.join(' ')).toContain('#34d399');
    expect(designTokens.components.onboarding.stepCard.join(' ')).toContain('#0f172a');
    expect(designTokens.components.onboarding.hoverOverlay).toContain('group-hover:opacity-100');
    expect(designTokens.components.onboarding.previewFrame.join(' ')).toContain('aspect-[16/10]');
    expect(designTokens.palettes.feature.providerFeature.emerald.glow).toContain('16,185,129');
    expect(designTokens.palettes.feature.highlight.fuchsia.ring).toBe('ring-fuchsia-300/35');
  });

  it('exposes singleton layout effects and deduped gradient primitives', () => {
    expect(designTokens.effects.shell.centerGlow).toContain('conic-gradient');
    expect(designTokens.effects.titleBar.themeToggle).toContain('amber-500');
    expect(designTokens.effects.pillOverflow.fadeLeft).toContain('#111a2f');
    expect(designTokens.effects.emptyState.iconHoverGlowLight).toContain('hover:shadow');
    expect(designTokens.gradients.appShellLight).toContain('#dbeafe');
    expect(designTokens.components.gradientShell.aura[0]).toBe(designTokens.gradients.appShellLight);
  });
});
