import { badgeSizeStyles as primitiveBadgeSizeStyles } from '@/ui/primitives/Badge';
import { buttonTypographySizes } from '@/ui/primitives/Button';
import { primitiveTokenRecipes } from '@/ui/primitives/tokenRecipes';
import { designTokens } from '@/ui/tokens';

describe('primitive typography recipes', () => {
  it('maps page layout copy to semantic typography recipes', () => {
    expect(designTokens.components.pageLayout.badge).toContain(designTokens.typography.badge);
    expect(designTokens.components.pageLayout.title).toContain(designTokens.typography.pageTitle);
    expect(designTokens.components.pageLayout.subtitle).toContain(designTokens.typography.body);
    expect(designTokens.components.pageLayout.badge).toContain(designTokens.text.label);
    expect(designTokens.components.pageLayout.title).toContain(designTokens.text.primary);
    expect(designTokens.components.pageLayout.subtitle).toContain(designTokens.text.body);
    expect(designTokens.components.pageLayout.errorText).toContain(
      designTokens.typography.captionStrong
    );
    expect(designTokens.components.pageLayout.errorText).toContain(designTokens.text.danger);
  });

  it('uses semantic typography for empty state copy', () => {
    expect(designTokens.components.emptyState.title).toContain(designTokens.typography.cardTitle);
    expect(designTokens.components.emptyState.description).toContain(designTokens.typography.body);
    expect(designTokens.components.emptyState.title).toContain(designTokens.text.primary);
    expect(designTokens.components.emptyState.description).toContain(designTokens.text.body);
  });

  it('keeps button sizes on the semantic scale', () => {
    expect(buttonTypographySizes).toEqual({
      xs: designTokens.typography.label,
      sm: designTokens.typography.captionStrong,
      md: designTokens.typography.captionStrong,
      lg: designTokens.typography.bodyStrong,
    });
    expect(primitiveTokenRecipes.connectButton.base.join(' ')).toContain(
      designTokens.typography.captionStrong
    );
    expect(primitiveTokenRecipes.connectButton.base.join(' ')).not.toContain('text-sm');
  });

  it('keeps badge sizing focused on padding and radius', () => {
    expect(
      Object.values(primitiveBadgeSizeStyles).every((value) => !/text-|font-|tracking-/.test(value))
    ).toBe(true);
  });

  it('keeps pill and badge recipes on the shared badge scale', () => {
    expect(primitiveTokenRecipes.badge.base.join(' ')).toContain(designTokens.typography.badge);
    expect(primitiveTokenRecipes.pill.base).toContain(designTokens.typography.badge);
    expect(primitiveTokenRecipes.badge.default.join(' ')).toContain(designTokens.text.muted);
  });

  it('drops the old subheading typography from button base recipes', () => {
    expect(primitiveTokenRecipes.button.base.join(' ')).not.toContain('font-subheading');
    expect(primitiveTokenRecipes.button.base.join(' ')).not.toContain('uppercase');
    expect(primitiveTokenRecipes.button.secondary.join(' ')).toContain(designTokens.text.muted);
    expect(primitiveTokenRecipes.button.danger.join(' ')).toContain(designTokens.text.danger);
  });

  it('uses theme typography variables for title bar chrome expansion', () => {
    expect(designTokens.typography.titleBarChromeExpanded).toContain(
      'var(--tracking-title-bar-chrome-expanded)'
    );
    expect(designTokens.typography.titleBarChromeExpanded).toContain(
      'var(--text-title-bar-chrome-expanded)'
    );
    expect(designTokens.components.appTitleBar.logo.wordmark).toBe(
      designTokens.typography.pageTitleWordmark
    );
    expect(designTokens.typography.pageTitleWordmark).toContain('var(--font-page-title-wordmark)');
  });

  it('uses semantic text recipes for dropdown and title bar chrome', () => {
    expect(primitiveTokenRecipes.menuDropdown.item.join(' ')).toContain(designTokens.text.muted);
    expect(primitiveTokenRecipes.appTitleBar.logo.container.join(' ')).toContain(
      designTokens.text.primary
    );
    expect(primitiveTokenRecipes.appTitleBar.tabIdle).toContain(designTokens.text.muted);
  });

  it('exposes chart and confirmation typography without raw utility stacks', () => {
    expect(designTokens.typography.chartDonutCenterTotal).toContain('text-2xl');
    expect(designTokens.typography.chartDonutCenterTotal).toContain('font-bold');
    expect(designTokens.typography.chartDonutCenterTotal).toContain('tracking-tight');
    expect(designTokens.typography.confirmationCode).toBe('font-mono font-bold');
  });

  it('reserves labeled-control spacing for label stacks that clear focus rings', () => {
    expect(designTokens.spacing.labeledFieldGap).toBe('gap-3');
  });
});
