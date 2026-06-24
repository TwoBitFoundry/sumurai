import {
  alert,
  authLayout,
  border,
  budgetProgress,
  buttonCta,
  categoryPickerChip,
  categoryPill,
  chartFloatingGlass,
  chartTooltip,
  chrome,
  chromeBar,
  control,
  controlIconWell,
  dangerCta,
  dashboardCategoryCard,
  effect,
  floatingChromeGlass,
  floatingChromeSearch,
  focus,
  font,
  insightsPanel,
  modalDrawer,
  placeholder,
  providerNestedCard,
  providerSelectionCard,
  semanticPlaceholderTextRecipes,
  semanticTextRecipes,
  settingsSecurityLayout,
  status,
  successCta,
  surface,
  text,
} from '@/ui/recipes';

describe('shared UI recipes', () => {
  it('exposes the shared text and placeholder recipes', () => {
    expect(Object.keys(text)).toEqual(
      expect.arrayContaining([
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
      ])
    );
    expect(text.primary).toBe('text-[var(--color-text-primary)]');
    expect(placeholder.muted).toContain('var(--color-brand-fog)');
    expect(semanticTextRecipes).toBe(text);
    expect(semanticPlaceholderTextRecipes).toBe(placeholder);
  });

  it('exposes the shared surface, border, effect, focus, font, and chrome recipes', () => {
    expect(surface.card).toEqual([
      'bg-[color:color-mix(in_srgb,var(--color-surface-card)_55%,transparent)]',
      'dark:bg-[color:color-mix(in_srgb,var(--color-surface-card)_55%,transparent)]',
    ]);
    expect(surface.solidCard).toEqual([
      'bg-[var(--color-surface-card)]',
      'dark:bg-[var(--color-brand-navy)]',
    ]);
    expect(border.glass).toEqual([
      'border-[color:color-mix(in_srgb,var(--color-border-glass)_35%,transparent)]',
      'dark:border-[color:color-mix(in_srgb,var(--color-border-glass)_12%,transparent)]',
    ]);
    expect(effect.glassDropShadow).toEqual([
      'drop-shadow-[0_8px_32px_color-mix(in_srgb,var(--color-effect-glass-shadow)_22%,transparent)]',
    ]);
    expect(effect.tabBarDropShadow[0]).toContain('--color-effect-glass-shadow');
    expect(focus.visible).toContain('focus-visible:ring-[var(--color-brand-glacier)]');
    expect(font.label).toBe(
      'font-label text-[0.75rem] font-bold uppercase leading-none tracking-[0.14em]'
    );
    expect(font.badge).toBe(
      'font-label text-[0.75rem] font-bold uppercase leading-none tracking-[0.14em]'
    );
    expect(chrome.sm).toContain('px-[length:var(--spacing-button-chrome-inset-sm-x)]');
  });

  it('exposes the chrome bar exception recipes', () => {
    expect(chromeBar.height).toBe('h-12');
    expect(chromeBar.square).toBe('h-12 w-12');
    expect(chromeBar.glyph).toBe('h-6 w-6');
    expect(chromeBar.glyphWell).toEqual([
      'inline-flex',
      'h-6',
      'w-6',
      'shrink-0',
      'items-center',
      'justify-center',
    ]);
  });

  it('exposes the control icon well recipes', () => {
    expect(controlIconWell.sm).toContain(control.glyph.sm);
    expect(controlIconWell.md).toContain(control.glyph.md);
    expect(controlIconWell.lg).toContain(control.glyph.lg);
  });

  it('exposes category accent pill recipes with paired text and surfaces', () => {
    expect(categoryPill.text).toEqual([
      'text-[var(--category-accent)]',
      'dark:text-[var(--category-accent-bright)]',
    ]);
    expect(categoryPill.chipSurface.join(' ')).toContain(
      'color-mix(in_srgb,var(--category-accent)_22%,var(--color-surface-card))'
    );
    expect(categoryPill.chipSurface.join(' ')).toContain(
      'color-mix(in_srgb,var(--category-accent-bright)_28%,transparent)'
    );
    expect(categoryPill.chipSurfaceSelected.join(' ')).toContain(
      '!border-[var(--category-accent)]'
    );
  });

  it('exposes category picker chip button recipes shared with transaction filters', () => {
    expect(categoryPickerChip.button.join(' ')).toContain('rounded-full');
    expect(categoryPickerChip.button.join(' ')).toContain(font.badge);
    expect(categoryPickerChip.selected).toEqual(['ring-2', 'ring-inset']);
  });

  it('exposes brand red danger CTA recipes for destructive buttons', () => {
    expect(dangerCta.gradient).toEqual([
      'bg-[var(--color-brand-crimson)]',
      'dark:bg-[var(--color-brand-signal-red)]',
    ]);
    expect(dangerCta.hover.join(' ')).toContain('hover:-translate-y-0.5');
  });

  it('exposes flat sky CTA and progress fill recipes', () => {
    expect(buttonCta.gradient).toEqual(['bg-[var(--color-brand-azure)]']);
    expect(buttonCta.glow).toEqual([...effect.accentOutlineGlowCta]);
    expect(budgetProgress.shell).toEqual(['overflow-visible', 'py-2', '-my-2']);
    expect(budgetProgress.track.join(' ')).toContain('overflow-visible');
    expect(budgetProgress.track.join(' ')).not.toContain('overflow-hidden');
    expect(budgetProgress.fillWithin).toContain('bg-[var(--color-brand-azure)]');
    expect(budgetProgress.fillWithin).not.toContain('brand-navy');
    expect(budgetProgress.fillWithin).toEqual([
      'bg-[var(--color-brand-azure)]',
      ...effect.successGlow,
    ]);
    expect(budgetProgress.fillOver).toEqual([
      'bg-gradient-to-r',
      'from-[var(--color-brand-crimson)]',
      'via-[var(--color-brand-crimson)]',
      'to-[var(--color-text-danger)]',
      ...effect.dangerGlow,
    ]);
    expect(budgetProgress.fillWithin.join(' ')).not.toContain('0_0_20px');
    expect(budgetProgress.fillOver.join(' ')).not.toContain('0_0_20px');
    expect(effect.dangerGlow).toEqual(['drop-shadow-[0_0_12px_var(--color-effect-danger-glow)]']);
  });

  it('exposes the success and drawer modal recipes', () => {
    expect(successCta.gradient).toEqual(['bg-[var(--color-brand-teal)]']);
    expect(modalDrawer.formRow).toContain('items-end');
    expect(modalDrawer.contentMotion).toContain('modal-drawer-content');
    expect(modalDrawer.overlayMotion).toContain('modal-drawer-overlay');
  });

  it('exposes the floating chrome search recipes', () => {
    expect(floatingChromeSearch.height).toBe('h-[52px] md:h-12 lg:h-12');
    expect(floatingChromeSearch.glyph).toBe(chromeBar.glyph);
    expect(floatingChromeSearch.paddingX).toBe('px-4 md:px-3.5');
    expect(floatingChromeSearch.label).toBe(control.label.md);
  });

  it('exposes the shared control recipes', () => {
    expect(Object.keys(control)).toEqual(
      expect.arrayContaining(['height', 'square', 'glyph', 'paddingX', 'label'])
    );
    expect(control.height).toEqual({
      sm: 'h-9 md:h-8 lg:h-7',
      md: 'h-11 md:h-9 lg:h-8',
      lg: 'h-[52px] md:h-11 lg:h-10',
    });
    expect(control.square).toEqual({
      sm: 'h-9 w-9 md:h-8 md:w-8 lg:h-7 lg:w-7',
      md: 'h-11 w-11 md:h-9 md:w-9 lg:h-8 lg:w-8',
      lg: 'h-[52px] w-[52px] md:h-11 md:w-11 lg:h-10 lg:w-10',
    });
    expect(control.glyph).toEqual({
      sm: 'h-4 w-4 lg:h-3.5 lg:w-3.5',
      md: 'h-5 w-5 md:h-[18px] md:w-[18px] lg:h-4 lg:w-4',
      lg: 'h-6 w-6 md:h-[22px] md:w-[22px] lg:h-5 lg:w-5',
    });
    expect(control.paddingX).toEqual({
      sm: 'px-3 md:px-2.5 lg:px-2.5',
      md: 'px-4 md:px-3.5 lg:px-3',
      lg: 'px-5 md:px-[18px] lg:px-4',
    });
    expect(control.label).toEqual({
      sm: font.captionStrong,
      md: font.bodyStrong,
      lg: font.bodyStrong,
    });
  });

  it('exposes the shared status recipes', () => {
    expect(Object.keys(status)).toEqual(
      expect.arrayContaining(['info', 'success', 'warning', 'danger'])
    );
    expect(status.danger.border).toEqual([
      'border-[var(--color-status-danger-border)]',
      'dark:border-[var(--color-status-danger-border)]',
    ]);
    expect(status.danger.alertBorder).toEqual(['border-[var(--color-status-danger-border)]']);
  });

  it('exposes alert shell recipes with borderless dark mode', () => {
    expect(alert.shell.join(' ')).toContain('dark:border-0');
    expect(alert.shell.join(' ')).not.toContain('drop-shadow-');
    expect(alert.tone.solid).toContain('backdrop-blur-md');
    expect(alert.tone.solid).toContain('backdrop-saturate-[135%]');
  });

  it('exposes auth layout recipes for mobile, tablet, and desktop tiers', () => {
    expect(authLayout.shell).toEqual(expect.arrayContaining(['px-4', 'md:px-6', 'lg:max-w-lg']));
    expect(authLayout.brandBackdrop).toContain('items-end');
    expect(authLayout.brandBackdrop).toContain('justify-center');
    expect(authLayout.brandBackdropImage).toContain('h-full');
    expect(authLayout.brandBackdropImage).toContain('object-bottom');
    expect(authLayout.brandBackdropImage).not.toContain('lg:object-right-bottom');
    expect(authLayout.stackedActions).toContain('lg:items-center');
    expect(authLayout.primaryAction).toEqual(
      expect.arrayContaining(['w-full', 'md:w-full', 'lg:w-auto'])
    );
    expect(authLayout.footerLink).toEqual(expect.arrayContaining([font.body, text.body]));
  });

  it('keeps dashboard category card shells flat without elevation drop shadow', () => {
    for (const shell of [
      dashboardCategoryCard.shell,
      dashboardCategoryCard.shellActive,
      dashboardCategoryCard.shellInteractive,
    ]) {
      expect(shell).not.toEqual(expect.arrayContaining([...effect.glassDropShadow]));
      expect(shell).toEqual(expect.arrayContaining([...surface.solidCard]));
      expect(shell).not.toEqual(expect.arrayContaining([...surface.glassPanel]));
      expect(shell).not.toEqual(expect.arrayContaining([...effect.glassBackdrop]));
      expect(shell.some((token) => token.startsWith('drop-shadow-['))).toBe(false);
      expect(shell.some((token) => token.startsWith('shadow-['))).toBe(false);
    }
  });

  it('themes provider picker cards from generated surface tokens', () => {
    expect(providerSelectionCard.shell).toEqual(
      expect.arrayContaining([
        'border',
        ...border.glass,
        '!bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_40%,transparent)]',
        ...effect.glassBackdrop,
        ...effect.glassElevationShadow,
      ])
    );
    expect(providerNestedCard.shell).toEqual(
      expect.arrayContaining([...border.subtle, ...surface.dataRow])
    );
    expect(providerNestedCard.label).toBe(text.primary);
    expect(providerNestedCard.detail).toBe(text.body);
  });

  it('composes chart floating glass from glass design tokens', () => {
    expect(chartFloatingGlass.shell).toEqual(
      expect.arrayContaining([
        'border',
        ...surface.chartGlassHoverPanel,
        ...border.glass,
        ...effect.glassDropShadow,
      ])
    );
    expect(chartTooltip.shell).toEqual(
      expect.arrayContaining([...chartFloatingGlass.backdrop, ...chartFloatingGlass.shell])
    );
    expect(chartFloatingGlass.backdrop).toEqual(effect.glassBackdrop);
    expect(insightsPanel.glassShell.join(' ')).toContain('overflow-visible');
    expect(insightsPanel.glassShell.join(' ')).not.toContain('overflow-hidden');
  });
});
