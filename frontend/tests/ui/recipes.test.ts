import {
  border,
  buttonChromeInset,
  chrome,
  effect,
  focus,
  font,
  placeholder,
  semanticPlaceholderTextRecipes,
  semanticTextRecipes,
  status,
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
      'dark:bg-[color:color-mix(in_srgb,var(--color-surface-card-dark)_55%,transparent)]',
    ]);
    expect(border.glass).toEqual([
      'border-[color:color-mix(in_srgb,var(--color-border-glass)_35%,transparent)]',
      'dark:border-[color:color-mix(in_srgb,var(--color-border-glass-dark)_12%,transparent)]',
    ]);
    expect(effect.glassShadow).toEqual([
      'shadow-[0_32px_110px_-60px_var(--color-effect-glass-shadow)]',
      'dark:shadow-[0_36px_120px_-62px_var(--color-effect-glass-shadow-dark)]',
    ]);
    expect(focus.visible).toContain('focus-visible:ring-sky-400');
    expect(font.badge).toBe(
      'font-badge text-[0.75rem] font-bold uppercase leading-none tracking-[0.14em]'
    );
    expect(chrome.smInset).toContain('px-[length:var(--spacing-button-chrome-inset-sm-x)]');
    expect(buttonChromeInset).toBe(chrome);
  });

  it('exposes the shared status recipes', () => {
    expect(Object.keys(status)).toEqual(
      expect.arrayContaining(['info', 'success', 'warning', 'danger'])
    );
    expect(status.danger.border).toEqual([
      'border-[var(--color-status-danger-border)]',
      'dark:border-[var(--color-status-danger-border-dark)]',
    ]);
  });
});
