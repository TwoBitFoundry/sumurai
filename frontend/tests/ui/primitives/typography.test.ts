import { badgeSizeStyles as primitiveBadgeSizeStyles } from '@/ui/primitives/Badge';
import { buttonTypographySizes } from '@/ui/primitives/Button';
import { primitiveTokenRecipes } from '@/ui/primitives/tokenRecipes';
import { designTokens } from '@/ui/tokens';

describe('primitive typography recipes', () => {
  it('maps page layout copy to semantic typography recipes', () => {
    expect(designTokens.components.pageLayout.badge).toContain(designTokens.typography.badge);
    expect(designTokens.components.pageLayout.title).toContain(designTokens.typography.pageTitle);
    expect(designTokens.components.pageLayout.subtitle).toContain(designTokens.typography.body);
    expect(designTokens.components.pageLayout.errorText).toContain(
      designTokens.typography.captionStrong
    );
  });

  it('uses semantic typography for empty state copy', () => {
    expect(designTokens.components.emptyState.title).toContain(designTokens.typography.cardTitle);
    expect(designTokens.components.emptyState.description).toContain(designTokens.typography.body);
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
  });

  it('drops the old subheading typography from button base recipes', () => {
    expect(primitiveTokenRecipes.button.base.join(' ')).not.toContain('font-subheading');
    expect(primitiveTokenRecipes.button.base.join(' ')).not.toContain('uppercase');
  });
});
