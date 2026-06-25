import { categoryAccents, rotatableCategoryAccents } from '@/ui/tokens';
import {
  buildCategoryAccentIndex,
  categoryLookupKey,
  formatCategoryName,
  formatCustomCategoryDisplay,
  getReservedCategoryAccent,
  getTagThemeForCategory,
  getTagThemeForCategoryAtIndex,
  isBudgetEligibleCategory,
  isBudgetIneligibleCategory,
  longestFormattedCategoryLabel,
  mergeTransactionFilterCategories,
  mobileCategoryChipWidthRem,
  SYSTEM_CATEGORY_SLUGS,
  sortCategoryNamesAlphabetically,
  validateCustomCategoryName,
} from '@/utils/categories';

describe('category accent index', () => {
  it('assigns colors by sorted filter roster index and repeats', () => {
    const names = sortCategoryNamesAlphabetically(['Coffee', 'Groceries', 'Pets']);
    const accentIndex = buildCategoryAccentIndex(names);

    expect(getTagThemeForCategoryAtIndex(0).key).toBe(rotatableCategoryAccents[0].key);
    expect(getTagThemeForCategoryAtIndex(rotatableCategoryAccents.length).key).toBe(
      rotatableCategoryAccents[0].key
    );
    expect(getTagThemeForCategory('Coffee', accentIndex).key).toBe(
      getTagThemeForCategoryAtIndex(0).key
    );
    expect(getTagThemeForCategory('Groceries', accentIndex).key).toBe(
      getTagThemeForCategoryAtIndex(1).key
    );
    expect(getTagThemeForCategory('Pets', accentIndex).key).toBe(
      getTagThemeForCategoryAtIndex(2).key
    );
  });

  it('resolves budget and display category aliases to the same accent as transaction slugs', () => {
    const names = sortCategoryNamesAlphabetically([
      'ENTERTAINMENT',
      'FOOD_AND_DRINK',
      'GENERAL_SERVICES',
      'SUBSCRIPTION',
    ]);
    const accentIndex = buildCategoryAccentIndex(names);

    const subscriptionTheme = getTagThemeForCategory('SUBSCRIPTION', accentIndex);
    expect(subscriptionTheme.key).toBe('indigo');
    expect(getTagThemeForCategory('Subscriptions', accentIndex).key).toBe(subscriptionTheme.key);
    expect(getTagThemeForCategory('subscription', accentIndex).key).toBe(subscriptionTheme.key);
    expect(getTagThemeForCategory('GENERAL_SERVICES', accentIndex).key).toBe('cyan');
    expect(getTagThemeForCategory('Services', accentIndex).key).toBe('cyan');
    expect(getTagThemeForCategory('food and drink', accentIndex).key).toBe('amber');
  });

  it('reserves green for income and red for transfer out outside the rotation', () => {
    const names = sortCategoryNamesAlphabetically([
      'ENTERTAINMENT',
      'FOOD_AND_DRINK',
      'INCOME',
      'TRANSFER_OUT',
    ]);
    const accentIndex = buildCategoryAccentIndex(names);

    expect(getReservedCategoryAccent('INCOME')?.key).toBe('emerald');
    expect(getReservedCategoryAccent('Income')?.key).toBe('emerald');
    expect(getReservedCategoryAccent('TRANSFER_OUT')?.key).toBe('rose');
    expect(getReservedCategoryAccent('Transfer Out')?.key).toBe('rose');
    expect(getTagThemeForCategory('INCOME', accentIndex).key).toBe('emerald');
    expect(getTagThemeForCategory('TRANSFER_OUT', accentIndex).key).toBe('rose');
    expect(accentIndex.has('INCOME')).toBe(false);
    expect(accentIndex.has('TRANSFER_OUT')).toBe(false);
    expect(getTagThemeForCategory('ENTERTAINMENT', accentIndex).key).toBe('violet');
    expect(getTagThemeForCategory('FOOD_AND_DRINK', accentIndex).key).toBe('amber');
    expect(getTagThemeForCategory('ENTERTAINMENT', accentIndex).key).not.toBe('emerald');
    expect(getTagThemeForCategory('FOOD_AND_DRINK', accentIndex).key).not.toBe('rose');
  });

  it('assigns semantically meaningful accents to system categories', () => {
    const expenseSlugs = SYSTEM_CATEGORY_SLUGS.filter(
      (slug) => slug !== 'INCOME' && slug !== 'TRANSFER_OUT'
    );
    const keys = expenseSlugs.map((slug) => getTagThemeForCategory(slug).key);

    expect(getTagThemeForCategory('BANK_FEES').key).toBe('slate');
    expect(getTagThemeForCategory('RENT_AND_UTILITIES').key).toBe('sky');
    expect(getTagThemeForCategory('FOOD_AND_DRINK').key).toBe('amber');
    expect(getTagThemeForCategory('ENTERTAINMENT').key).toBe('violet');
    expect(getTagThemeForCategory('GOVERNMENT_AND_NON_PROFIT').key).toBe('indigo');
    expect(getTagThemeForCategory('HOME_IMPROVEMENT').key).toBe('lime');
    expect(getTagThemeForCategory('LOAN_PAYMENTS').key).toBe('coral');
    expect(getTagThemeForCategory('MEDICAL').key).toBe('teal');
    expect(getTagThemeForCategory('PERSONAL_CARE').key).toBe('pink');
    expect(getTagThemeForCategory('GENERAL_SERVICES').key).toBe('cyan');
    expect(getTagThemeForCategory('SHOPPING').key).toBe('orange');
    expect(getTagThemeForCategory('SUBSCRIPTION').key).toBe('indigo');
    expect(getTagThemeForCategory('TRANSFER_IN').key).toBe('mint');
    expect(getTagThemeForCategory('TRANSPORTATION').key).toBe('cyan');
    expect(new Set(keys).size).toBeGreaterThanOrEqual(10);
  });

  it('uses bright readable tokens for dark-mode category pill text on deep accents', () => {
    const entertainmentTheme = getTagThemeForCategory('ENTERTAINMENT');
    const indigoTheme = getTagThemeForCategory('GOVERNMENT_AND_NON_PROFIT');

    expect(entertainmentTheme.cssVars['--category-accent-bright']).toBe('#c4b5fd');
    expect(indigoTheme.cssVars['--category-accent-bright']).toBe('#a5b4fc');
  });
});

describe('mergeTransactionFilterCategories', () => {
  it('includes custom categories that are not yet used on transactions', () => {
    expect(
      mergeTransactionFilterCategories(
        ['FOOD_AND_DRINK'],
        [{ id: '1', display_name: 'Weekend Brunch', lookup_key: 'weekend brunch' }]
      )
    ).toEqual(['FOOD_AND_DRINK', 'Weekend Brunch']);
  });

  it('dedupes custom categories already present in transaction categories', () => {
    expect(
      mergeTransactionFilterCategories(
        ['Coffee'],
        [{ id: '1', display_name: 'Coffee', lookup_key: 'coffee' }]
      )
    ).toEqual(['Coffee']);
  });

  it('removes custom-only categories when they are deleted from the catalog', () => {
    expect(
      mergeTransactionFilterCategories(
        [],
        [{ id: '1', display_name: 'Weekend Brunch', lookup_key: 'weekend brunch' }]
      )
    ).toEqual(['Weekend Brunch']);

    expect(mergeTransactionFilterCategories([], [])).toEqual([]);
  });
});

describe('longestFormattedCategoryLabel', () => {
  it('returns the longest system category display label', () => {
    expect(longestFormattedCategoryLabel()).toBe('Govt & Non Profit');
  });
});

describe('mobileCategoryChipWidthRem', () => {
  it('sizes the chip from the longest label without oversized ch padding', () => {
    const longestLabel = longestFormattedCategoryLabel();
    expect(mobileCategoryChipWidthRem(longestLabel)).toBe('11.06rem');
  });
});

describe('formatCategoryName', () => {
  it.each([
    ['FOOD_AND_DRINK', 'Food & Drink'],
    ['GENERAL_MERCHANDISE', 'Merchandise'],
    ['GENERAL_SERVICES', 'Services'],
    ['GOVERNMENT_AND_NON_PROFIT', 'Govt & Non Profit'],
    ['HOME_IMPROVEMENT', 'Home'],
    ['RENT_AND_UTILITIES', 'Bills'],
    ['TRANSPORTATION', 'Transport'],
  ])('formats %s as %s', (input, expected) => {
    expect(formatCategoryName(input)).toBe(expected);
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

  it('rejects collision with a system category display alias', () => {
    const result = validateCustomCategoryName('Bills', {
      system: ['RENT_AND_UTILITIES'],
      custom: [],
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('collides_system');
  });

  it('rejects plural collision with a system category display alias', () => {
    const result = validateCustomCategoryName('Merchandises', {
      system: ['GENERAL_MERCHANDISE'],
      custom: [],
    });
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

describe('budget category eligibility', () => {
  it('marks income and transfer categories as ineligible', () => {
    expect(isBudgetIneligibleCategory('INCOME')).toBe(true);
    expect(isBudgetIneligibleCategory('Income')).toBe(true);
    expect(isBudgetIneligibleCategory('TRANSFER_IN')).toBe(true);
    expect(isBudgetIneligibleCategory('Transfer In')).toBe(true);
    expect(isBudgetIneligibleCategory('TRANSFER_OUT')).toBe(true);
    expect(isBudgetIneligibleCategory('Transfer Out')).toBe(true);
    expect(isBudgetIneligibleCategory('TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS')).toBe(true);
  });

  it('allows expense categories for budgets', () => {
    expect(isBudgetEligibleCategory('ENTERTAINMENT')).toBe(true);
    expect(isBudgetEligibleCategory('FOOD_AND_DRINK')).toBe(true);
    expect(isBudgetEligibleCategory('Coffee')).toBe(true);
  });
});
