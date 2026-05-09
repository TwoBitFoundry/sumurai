import { pageLayoutRecipes } from '@/layouts/PageLayout';
import { appTitleBarRecipes } from '@/ui/primitives/AppTitleBar';
import { badgeRecipes, badgeSizeStyles as primitiveBadgeSizeStyles } from '@/ui/primitives/Badge';
import { buttonRecipes, buttonTypographySizes, connectButtonRecipes } from '@/ui/primitives/Button';
import { emptyStateRecipes } from '@/ui/primitives/EmptyState';
import { menuDropdownRecipes } from '@/ui/primitives/MenuDropdown';
import { pillRecipes } from '@/ui/primitives/Pill';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';

describe('primitive typography recipes', () => {
  it('maps page layout copy to semantic typography recipes', () => {
    expect(pageLayoutRecipes.badge).toContain(uiTypographyRecipes.badge);
    expect(pageLayoutRecipes.title).toContain(uiTypographyRecipes.pageTitle);
    expect(pageLayoutRecipes.subtitle).toContain(uiTypographyRecipes.body);
    expect(pageLayoutRecipes.badge).toContain(uiTextRecipes.label);
    expect(pageLayoutRecipes.title).toContain(uiTextRecipes.primary);
    expect(pageLayoutRecipes.subtitle).toContain(uiTextRecipes.body);
    expect(pageLayoutRecipes.errorText).toContain(uiTypographyRecipes.captionStrong);
    expect(pageLayoutRecipes.errorText).toContain(uiTextRecipes.danger);
  });

  it('uses semantic typography for empty state copy', () => {
    expect(emptyStateRecipes.title).toContain(uiTypographyRecipes.cardTitle);
    expect(emptyStateRecipes.description).toContain(uiTypographyRecipes.body);
    expect(emptyStateRecipes.title).toContain(uiTextRecipes.primary);
    expect(emptyStateRecipes.description).toContain(uiTextRecipes.body);
  });

  it('keeps button sizes on the semantic scale', () => {
    expect(buttonTypographySizes).toEqual({
      xs: uiTypographyRecipes.label,
      sm: uiTypographyRecipes.captionStrong,
      md: uiTypographyRecipes.captionStrong,
      lg: uiTypographyRecipes.bodyStrong,
    });
    expect(connectButtonRecipes.base.join(' ')).toContain(uiTypographyRecipes.captionStrong);
    expect(connectButtonRecipes.base.join(' ')).not.toContain('text-sm');
  });

  it('keeps badge sizing focused on padding and radius', () => {
    expect(
      Object.values(primitiveBadgeSizeStyles).every((value) => !/text-|font-|tracking-/.test(value))
    ).toBe(true);
  });

  it('keeps pill and badge recipes on the shared badge scale', () => {
    expect(badgeRecipes.base.join(' ')).toContain(uiTypographyRecipes.badge);
    expect(pillRecipes.base).toContain(uiTypographyRecipes.badge);
    expect(badgeRecipes.default.join(' ')).toContain(uiTextRecipes.muted);
  });

  it('drops the old subheading typography from button base recipes', () => {
    expect(buttonRecipes.base.join(' ')).not.toContain('font-subheading');
    expect(buttonRecipes.base.join(' ')).not.toContain('uppercase');
    expect(buttonRecipes.secondary.join(' ')).toContain(uiTextRecipes.muted);
    expect(buttonRecipes.danger.join(' ')).toContain(uiTextRecipes.danger);
  });

  it('uses semantic text recipes for dropdown and title bar chrome', () => {
    expect(menuDropdownRecipes.item.join(' ')).toContain(uiTextRecipes.muted);
    expect(appTitleBarRecipes.logo.container.join(' ')).toContain(uiTextRecipes.primary);
    expect(appTitleBarRecipes.tabIdle).toContain(uiTextRecipes.muted);
  });

  it('reserves labeled-control spacing for label stacks that clear focus rings', () => {});
});
