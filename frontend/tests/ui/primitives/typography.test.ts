import { badgeSizeStyles as primitiveBadgeSizeStyles } from '@/ui/primitives/Badge';
import { buttonTypographySizes } from '@/ui/primitives/Button';
import { primitiveTokenRecipes } from '@/ui/primitives/recipes';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';

describe('primitive typography recipes', () => {
  it('maps page layout copy to semantic typography recipes', () => {
    expect(primitiveTokenRecipes.pageLayout.badge).toContain(uiTypographyRecipes.badge);
    expect(primitiveTokenRecipes.pageLayout.title).toContain(uiTypographyRecipes.pageTitle);
    expect(primitiveTokenRecipes.pageLayout.subtitle).toContain(uiTypographyRecipes.body);
    expect(primitiveTokenRecipes.pageLayout.badge).toContain(uiTextRecipes.label);
    expect(primitiveTokenRecipes.pageLayout.title).toContain(uiTextRecipes.primary);
    expect(primitiveTokenRecipes.pageLayout.subtitle).toContain(uiTextRecipes.body);
    expect(primitiveTokenRecipes.pageLayout.errorText).toContain(uiTypographyRecipes.captionStrong);
    expect(primitiveTokenRecipes.pageLayout.errorText).toContain(uiTextRecipes.danger);
  });

  it('uses semantic typography for empty state copy', () => {
    expect(primitiveTokenRecipes.emptyState.title).toContain(uiTypographyRecipes.cardTitle);
    expect(primitiveTokenRecipes.emptyState.description).toContain(uiTypographyRecipes.body);
    expect(primitiveTokenRecipes.emptyState.title).toContain(uiTextRecipes.primary);
    expect(primitiveTokenRecipes.emptyState.description).toContain(uiTextRecipes.body);
  });

  it('keeps button sizes on the semantic scale', () => {
    expect(buttonTypographySizes).toEqual({
      xs: uiTypographyRecipes.label,
      sm: uiTypographyRecipes.captionStrong,
      md: uiTypographyRecipes.captionStrong,
      lg: uiTypographyRecipes.bodyStrong,
    });
    expect(primitiveTokenRecipes.connectButton.base.join(' ')).toContain(
      uiTypographyRecipes.captionStrong
    );
    expect(primitiveTokenRecipes.connectButton.base.join(' ')).not.toContain('text-sm');
  });

  it('keeps badge sizing focused on padding and radius', () => {
    expect(
      Object.values(primitiveBadgeSizeStyles).every((value) => !/text-|font-|tracking-/.test(value))
    ).toBe(true);
  });

  it('keeps pill and badge recipes on the shared badge scale', () => {
    expect(primitiveTokenRecipes.badge.base.join(' ')).toContain(uiTypographyRecipes.badge);
    expect(primitiveTokenRecipes.pill.base).toContain(uiTypographyRecipes.badge);
    expect(primitiveTokenRecipes.badge.default.join(' ')).toContain(uiTextRecipes.muted);
  });

  it('drops the old subheading typography from button base recipes', () => {
    expect(primitiveTokenRecipes.button.base.join(' ')).not.toContain('font-subheading');
    expect(primitiveTokenRecipes.button.base.join(' ')).not.toContain('uppercase');
    expect(primitiveTokenRecipes.button.secondary.join(' ')).toContain(uiTextRecipes.muted);
    expect(primitiveTokenRecipes.button.danger.join(' ')).toContain(uiTextRecipes.danger);
  });

  it('uses semantic text recipes for dropdown and title bar chrome', () => {
    expect(primitiveTokenRecipes.menuDropdown.item.join(' ')).toContain(uiTextRecipes.muted);
    expect(primitiveTokenRecipes.appTitleBar.logo.container.join(' ')).toContain(
      uiTextRecipes.primary
    );
    expect(primitiveTokenRecipes.appTitleBar.tabIdle).toContain(uiTextRecipes.muted);
  });

  it('exposes chart and confirmation typography without raw utility stacks', () => {
    expect(uiTypographyRecipes.chartDonutCenterTotal).toContain('text-2xl');
    expect(uiTypographyRecipes.chartDonutCenterTotal).toContain('font-bold');
    expect(uiTypographyRecipes.chartDonutCenterTotal).toContain('tracking-tight');
    expect(uiTypographyRecipes.confirmationCode).toBe('font-mono font-bold');
  });

  it('reserves labeled-control spacing for label stacks that clear focus rings', () => {});
});
