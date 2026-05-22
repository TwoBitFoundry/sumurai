import { categoryAccents } from '@/ui/tokens';
import {
  buildCategoryAccentIndex,
  categoryLookupKey,
  formatCustomCategoryDisplay,
  getTagThemeForCategory,
  getTagThemeForCategoryAtIndex,
  sortCategoryNamesAlphabetically,
  validateCustomCategoryName,
} from '@/utils/categories';

describe('category accent index', () => {
  it('assigns colors by sorted roster index and repeats', () => {
    const names = sortCategoryNamesAlphabetically(['transportation', 'Coffee', 'food_and_drink']);
    const accentIndex = buildCategoryAccentIndex(names);

    expect(getTagThemeForCategoryAtIndex(0).key).toBe(categoryAccents[0].key);
    expect(getTagThemeForCategoryAtIndex(categoryAccents.length).key).toBe(categoryAccents[0].key);
    expect(getTagThemeForCategory('Coffee', accentIndex).key).toBe(
      getTagThemeForCategoryAtIndex(0).key
    );
    expect(getTagThemeForCategory('food_and_drink', accentIndex).key).toBe(
      getTagThemeForCategoryAtIndex(1).key
    );
  });
});

describe('sortCategoryNamesAlphabetically', () => {
  it('sorts system and custom categories by display label', () => {
    expect(
      sortCategoryNamesAlphabetically([
        'transportation',
        'Coffee',
        'food_and_drink',
        'Avocado Toast',
        'entertainment',
      ])
    ).toEqual(['Avocado Toast', 'Coffee', 'entertainment', 'food_and_drink', 'transportation']);
  });
});

describe('categoryLookupKey', () => {
  it('lowercases and removes trailing s from each word', () => {
    expect(categoryLookupKey('Foods Runs')).toBe('food run');
  });

  it('collapses whitespace', () => {
    expect(categoryLookupKey('  food   runs  ')).toBe('food run');
  });

  it('handles single word without trailing s', () => {
    expect(categoryLookupKey('Food')).toBe('food');
  });

  it('handles single word with trailing s', () => {
    expect(categoryLookupKey('Foods')).toBe('food');
  });

  it('trims input', () => {
    expect(categoryLookupKey('   food   ')).toBe('food');
  });
});

describe('formatCustomCategoryDisplay', () => {
  it('title-cases each word', () => {
    expect(formatCustomCategoryDisplay('coffee runs')).toBe('Coffee Runs');
  });

  it('handles whitespace', () => {
    expect(formatCustomCategoryDisplay('  coffee   runs  ')).toBe('Coffee Runs');
  });

  it('handles single word', () => {
    expect(formatCustomCategoryDisplay('coffee')).toBe('Coffee');
  });

  it('lowercases words after first letter', () => {
    expect(formatCustomCategoryDisplay('COFFEE RUNS')).toBe('Coffee Runs');
  });
});

describe('validateCustomCategoryName', () => {
  const systemCategories = ['FOOD_AND_DRINK', 'ENTERTAINMENT', 'UTILITIES'];
  const customCategories = [{ id: '1', display_name: 'Coffee', lookup_key: 'coffee' }];
  const existing = { system: systemCategories, custom: customCategories };

  it('accepts valid name', () => {
    const result = validateCustomCategoryName('Groceries', existing);
    expect(result.ok).toBe(true);
    expect(result.display).toBe('Groceries');
  });

  it('rejects empty name', () => {
    const result = validateCustomCategoryName('', existing);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('empty');
  });

  it('rejects whitespace-only name', () => {
    const result = validateCustomCategoryName('   ', existing);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('empty');
  });

  it('rejects names with digits', () => {
    const result = validateCustomCategoryName('Coffee 1', existing);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('invalid_characters');
  });

  it('rejects names with symbols', () => {
    const result = validateCustomCategoryName('Co-ffee', existing);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('invalid_characters');
  });

  it('rejects names over 30 chars', () => {
    const result = validateCustomCategoryName('This is a very long category name', existing);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('too_long');
  });

  it('rejects names with more than 3 words', () => {
    const result = validateCustomCategoryName('One Two Three Four', existing);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('too_many_words');
  });

  it('rejects plural collision with custom category', () => {
    const result = validateCustomCategoryName('Coffees', existing);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('collides_custom');
  });

  it('rejects case-insensitive collision with system category', () => {
    const result = validateCustomCategoryName('Food and Drink', existing);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('collides_system');
  });

  it('accepts exactly 3 words', () => {
    const result = validateCustomCategoryName('One Two Three', existing);
    expect(result.ok).toBe(true);
  });

  it('accepts exactly 30 chars', () => {
    const result = validateCustomCategoryName('A'.repeat(30), existing);
    expect(result.ok).toBe(true);
  });

  it('formats display name with title case', () => {
    const result = validateCustomCategoryName('coffee RUNS', existing);
    expect(result.ok).toBe(true);
    expect(result.display).toBe('Coffee Runs');
  });
});
