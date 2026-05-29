import {
  authLayout,
  border,
  chrome,
  chromeBar,
  control,
  controlIconWell,
  effect,
  floatingChromeSearch,
  focus,
  font,
  modalDrawer,
  placeholder,
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
    expect(text.primary).toBe('text-slate-900 dark:text-slate-100');
    expect(placeholder.muted).toBe('placeholder:text-slate-400 dark:placeholder:text-slate-500');
    expect(semanticTextRecipes).toBe(text);
    expect(semanticPlaceholderTextRecipes).toBe(placeholder);
  });

  it('exposes the shared surface, border, effect, focus, font, and chrome recipes', () => {
    expect(surface.card).toEqual([
      'bg-[color:color-mix(in_srgb,var(--color-surface-card)_70%,transparent)]',
      'dark:bg-[color:color-mix(in_srgb,var(--color-surface-card)_55%,transparent)]',
    ]);
    expect(border.glass).toEqual([
      'border-[color:color-mix(in_srgb,var(--color-border-glass)_35%,transparent)]',
      'dark:border-[color:color-mix(in_srgb,var(--color-border-glass)_12%,transparent)]',
    ]);
    expect(effect.glassShadow).toEqual([
      'shadow-[0_32px_110px_-60px_var(--color-effect-glass-shadow)]',
      'dark:shadow-[0_36px_120px_-62px_var(--color-effect-glass-shadow)]',
    ]);
    expect(effect.pageShellInsetRing).toEqual([
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(15,23,42,0.18)]',
      'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(2,6,23,0.48)]',
    ]);
    expect(focus.visible).toContain('focus-visible:ring-sky-400');
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

  it('exposes the success and drawer modal recipes', () => {
    expect(successCta.gradient).toContain('from-[var(--color-brand-emerald)]');
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
  });

  it('exposes auth layout recipes for mobile, tablet, and desktop tiers', () => {
    expect(authLayout.shell).toEqual(expect.arrayContaining(['px-4', 'md:px-6', 'lg:max-w-lg']));
    expect(authLayout.brandAside[0]).toBe('hidden');
    expect(authLayout.brandAside).toContain('lg:flex');
    expect(authLayout.stackedActions).toContain('lg:items-center');
    expect(authLayout.primaryAction).toEqual(
      expect.arrayContaining(['w-full', 'md:w-full', 'lg:w-auto'])
    );
    expect(authLayout.footerLink).toEqual(expect.arrayContaining([font.body, text.body]));
  });

  it('exposes settings security layout recipes for mobile, tablet, and desktop tiers', () => {
    expect(settingsSecurityLayout.passkeyRow).toEqual(
      expect.arrayContaining(['flex-col', 'md:flex-row', 'lg:gap-4'])
    );
    expect(settingsSecurityLayout.addTrigger).toEqual(
      expect.arrayContaining(['w-full', 'md:w-auto', 'lg:w-auto'])
    );
    expect(settingsSecurityLayout.modalActions).toEqual(
      expect.arrayContaining(['flex-col', 'md:flex-row'])
    );
  });
});
