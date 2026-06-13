import { deriveInsightStateFromFilters } from '@/features/transactions/domain/deriveInsightStateFromFilters';

describe('deriveInsightStateFromFilters', () => {
  it('returns all insights when no filters are active', () => {
    expect(
      deriveInsightStateFromFilters({
        singleAccountSelected: false,
        categoryActive: false,
        merchantActive: false,
      })
    ).toBe('a');
  });

  it('returns category insights when only category is active', () => {
    expect(
      deriveInsightStateFromFilters({
        singleAccountSelected: false,
        categoryActive: true,
        merchantActive: false,
      })
    ).toBe('b');
  });

  it('returns merchant insights when only merchant is active', () => {
    expect(
      deriveInsightStateFromFilters({
        singleAccountSelected: false,
        categoryActive: false,
        merchantActive: true,
      })
    ).toBe('c');
  });

  it('returns account insights when only a single account is active', () => {
    expect(
      deriveInsightStateFromFilters({
        singleAccountSelected: true,
        categoryActive: false,
        merchantActive: false,
      })
    ).toBe('d');
  });

  it('returns combined states for multiple active filters', () => {
    expect(
      deriveInsightStateFromFilters({
        singleAccountSelected: true,
        categoryActive: true,
        merchantActive: false,
      })
    ).toBe('e');
    expect(
      deriveInsightStateFromFilters({
        singleAccountSelected: true,
        categoryActive: false,
        merchantActive: true,
      })
    ).toBe('f');
    expect(
      deriveInsightStateFromFilters({
        singleAccountSelected: false,
        categoryActive: true,
        merchantActive: true,
      })
    ).toBe('g');
    expect(
      deriveInsightStateFromFilters({
        singleAccountSelected: true,
        categoryActive: true,
        merchantActive: true,
      })
    ).toBe('triple');
  });
});
