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
      sm: uiTypographyRecipes.captionStrong,
      md: uiTypographyRecipes.bodyStrong,
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
    expect(buttonRecipes.base.join(' ')).toContain('uppercase');
    expect(buttonRecipes.secondary.join(' ')).toContain(uiTextRecipes.muted);
    expect(buttonRecipes.danger.join(' ')).toContain('color-status-danger-text');
  });

  it('keeps title bar layout recipes free of baked-in text colors', () => {
    expect(menuDropdownRecipes.item.join(' ')).toContain(uiTextRecipes.muted);
    expect(appTitleBarRecipes.logo.container.join(' ')).toContain(uiTextRecipes.primary);
    expect(appTitleBarRecipes.pillTab.join(' ')).not.toContain(uiTextRecipes.muted);
    expect(appTitleBarRecipes.pillTab.join(' ')).not.toContain(uiTextRecipes.inverse);
    expect(appTitleBarRecipes.pillTab.join(' ')).toContain(
      'rounded-[length:var(--radius-standard)]'
    );
    expect(appTitleBarRecipes.titleBarGrid.join(' ')).toContain('grid-rows-1');
    expect(appTitleBarRecipes.titleBarGrid.join(' ')).not.toContain('grid-rows-[auto_auto]');
    expect(appTitleBarRecipes.titleBarGrid.join(' ')).not.toContain('gap-y-2');
    expect(appTitleBarRecipes.titleBarGrid.join(' ')).toContain('h-14');
    expect(appTitleBarRecipes.logo.image.join(' ')).toContain('h-12');
    expect(appTitleBarRecipes.logo.image.join(' ')).toContain('w-12');
    expect(appTitleBarRecipes.logo.image.join(' ')).not.toContain('lg:h-8');
    expect(appTitleBarRecipes.logo.wordmark.join(' ')).toContain('leading-none');
    expect(appTitleBarRecipes.pillTabSize.join(' ')).toContain('px-3.5');
    expect(appTitleBarRecipes.pillInset.join(' ')).toContain('md:p-3');
    expect(appTitleBarRecipes.contextPillInset.join(' ')).toContain('md:py-2');
    expect(appTitleBarRecipes.contextPillTab.join(' ')).toContain('rounded-lg');
    expect(appTitleBarRecipes.floatingChromeGutter.join(' ')).toContain('md:px-6');
    expect(appTitleBarRecipes.floatingChromeGutter.join(' ')).toContain(
      'max-w-[var(--spacing-content-max)]'
    );
    expect(appTitleBarRecipes.pillContainerSize.join(' ')).toContain('h-12');
    expect(uiTypographyRecipes.bodyStrong).toContain('font-body-strong');
  });

  it('reserves labeled-control spacing for label stacks that clear focus rings', () => {});
});
