import generatedTokens from '@/ui/generated/tokens';
import { font as uiTypographyRecipes } from '@/ui/recipes';

const expectedRoles = [
  'display',
  'pageTitle',
  'sectionTitle',
  'cardTitle',
  'body',
  'bodyStrong',
  'caption',
  'captionStrong',
  'label',
  'badge',
];

const extractMinimumRemSize = (recipe: string): number | null => {
  const match = recipe.match(/text-\[(?:clamp\()?(?<value>\d+(?:\.\d+)?)rem/);
  return match?.groups?.value ? Number(match.groups.value) : null;
};

describe('design token typography recipes', () => {
  it('exposes the semantic typography roles', () => {
    expect(Object.keys(uiTypographyRecipes)).toEqual(expect.arrayContaining(expectedRoles));
  });

  it('preserves brand and sans font-family access', () => {
    expect(generatedTokens.typography['page-title'].$value.fontFamily).toBeDefined();
    expect(generatedTokens.typography.body.$value.fontFamily).toBeDefined();
  });

  it('keeps the display recipe clamped in the runtime layer', () => {
    expect(uiTypographyRecipes.display).toContain('text-[clamp(2.25rem,3vw,3rem)]');
    expect(uiTypographyRecipes.display).toContain('font-display');
  });

  it('keeps the body and caption recipes on the shared scale', () => {
    expect(uiTypographyRecipes.body).toContain('text-[1rem]');
    expect(uiTypographyRecipes.caption).toContain('text-[0.875rem]');
  });

  it('keeps label and badge tracking aligned', () => {
    expect(uiTypographyRecipes.label).toContain('tracking-[0.14em]');
    expect(uiTypographyRecipes.badge).toContain('tracking-[0.14em]');
  });

  it('keeps every semantic recipe at or above the caption floor', () => {
    const recipes = Object.values(uiTypographyRecipes);

    expect(
      recipes.every((recipe) => {
        const size = extractMinimumRemSize(recipe);
        return size === null || size >= 0.75;
      })
    ).toBe(true);
  });
});
