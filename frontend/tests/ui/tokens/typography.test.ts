import generatedTokens from '@/ui/tokens/generated/tokens.dtcg.json';

const expectedRoles = [
  'brand',
  'display',
  'page-title',
  'section-title',
  'card-title',
  'body',
  'body-strong',
  'caption',
  'caption-strong',
  'sans',
  'subheading',
  'label',
  'pill',
  'badge',
  'budget-progress-caption',
  'budget-progress-caption-strong',
];

describe('generated typography tokens', () => {
  it('exposes the standardized typography roles and aliases', () => {
    expect(Object.keys(generatedTokens.typography)).toEqual(expect.arrayContaining(expectedRoles));
  });

  it('keeps the semantic body and caption sizes in the new scale', () => {
    expect(generatedTokens.typography.body.$value.fontSize).toEqual({
      value: 1,
      unit: 'rem',
    });
    expect(generatedTokens.typography.caption.$value.fontSize).toEqual({
      value: 0.875,
      unit: 'rem',
    });
  });

  it('keeps uppercase label and badge tracking aligned', () => {
    expect(generatedTokens.typography.label.$value.letterSpacing).toEqual({
      value: 0.14,
      unit: 'em',
    });
    expect(generatedTokens.typography.badge.$value.letterSpacing).toEqual({
      value: 0.14,
      unit: 'em',
    });
  });

  it('keeps every generated typography size at or above the caption floor', () => {
    const sizes = Object.values(generatedTokens.typography)
      .map((token: any) => token.$value?.fontSize)
      .filter(
        (fontSize: any) =>
          fontSize && typeof fontSize === 'object' && 'value' in fontSize && 'unit' in fontSize
      );

    expect(
      sizes.every((fontSize: { value: number; unit: string }) => {
        if (fontSize.unit !== 'rem') {
          return true;
        }

        return fontSize.value >= 0.75;
      })
    ).toBe(true);
  });
});
