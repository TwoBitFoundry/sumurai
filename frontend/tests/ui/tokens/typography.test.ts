import { designTokens } from '@/ui/tokens';
import generatedTokens from '@/ui/tokens/generated/tokens';

const expectedRoles = [
  'brand',
  'sans',
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
  'subheading',
  'pill',
  'budgetProgressCaption',
  'budgetProgressCaptionStrong',
];

const extractMinimumRemSize = (recipe: string): number | null => {
  const match = recipe.match(/text-\[(?:clamp\()?(?<value>\d+(?:\.\d+)?)rem/);
  return match?.groups?.value ? Number(match.groups.value) : null;
};

describe('design token typography recipes', () => {
  it('exposes the semantic typography roles', () => {
    expect(Object.keys(designTokens.typography)).toEqual(expect.arrayContaining(expectedRoles));
  });

  it('preserves brand and sans font-family access', () => {
    expect(designTokens.typography.brand).toBe(
      generatedTokens.typography['page-title'].$value.fontFamily
    );
    expect(designTokens.typography.sans).toBe(generatedTokens.typography.body.$value.fontFamily);
  });

  it('keeps the display recipe clamped in the runtime layer', () => {
    expect(designTokens.typography.display).toContain('text-[clamp(2.25rem,3vw,3rem)]');
    expect(designTokens.typography.display).toContain('font-display');
  });

  it('keeps the body and caption recipes on the shared scale', () => {
    expect(designTokens.typography.body).toContain('text-[1rem]');
    expect(designTokens.typography.caption).toContain('text-[0.875rem]');
  });

  it('keeps label and badge tracking aligned', () => {
    expect(designTokens.typography.label).toContain('tracking-[0.14em]');
    expect(designTokens.typography.badge).toContain('tracking-[0.14em]');
  });

  it('keeps every semantic recipe at or above the caption floor', () => {
    const recipes = Object.entries(designTokens.typography)
      .filter(([key, value]) => key !== 'brand' && key !== 'sans' && typeof value === 'string')
      .map(([, value]) => value as string);

    expect(
      recipes.every((recipe) => {
        const size = extractMinimumRemSize(recipe);
        return size === null || size >= 0.75;
      })
    ).toBe(true);
  });
});
