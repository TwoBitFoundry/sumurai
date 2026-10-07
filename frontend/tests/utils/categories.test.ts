import {
  formatCategoryName,
  getTagThemeForCategory,
  isSpendingExcludedCategory,
  resolveMajorCategory,
} from '@/utils/categories';

describe('categories utils', () => {
  it('formats category names from snake_case', () => {
    expect(formatCategoryName('fast_food')).toBe('Fast Food');
    expect(formatCategoryName('TRANSPORT')).toBe('Transport');
    expect(formatCategoryName('Credit Card Bills')).toBe('Credit Card Bills');
    expect(formatCategoryName('Credit card bills')).toBe('Credit Card Bills');
    expect(formatCategoryName(undefined)).toBe('Shopping');
    expect(formatCategoryName(null as any)).toBe('Shopping');
    expect(formatCategoryName('other')).toBe('Shopping');
    expect(formatCategoryName('GENERAL_MERCHANDISE')).toBe('Shopping');
    expect(formatCategoryName('General Merchandise')).toBe('Shopping');
  });

  it('resolves General Merchandise, Other, and unknown to Shopping', () => {
    expect(resolveMajorCategory('GENERAL_MERCHANDISE')).toBe('Shopping');
    expect(resolveMajorCategory('General Merchandise')).toBe('Shopping');
    expect(resolveMajorCategory('other')).toBe('Shopping');
    expect(resolveMajorCategory('Other')).toBe('Shopping');
    expect(resolveMajorCategory('uncategorized')).toBe('Shopping');
    expect(resolveMajorCategory(undefined)).toBe('Shopping');
    expect(resolveMajorCategory('')).toBe('Shopping');
    expect(resolveMajorCategory('unknown')).toBe('Shopping');
    expect(resolveMajorCategory('Unknown')).toBe('Shopping');
    expect(resolveMajorCategory('Home Supplies')).toBe('Home Improvement');
    expect(resolveMajorCategory('Household Supplies')).toBe('Home Improvement');
  });

  it('maps same name to stable theme', () => {
    const a = getTagThemeForCategory('Groceries');
    const b = getTagThemeForCategory('groceries');
    expect(a.key).toBeDefined();
    expect(a.tag).toBeDefined();
    expect(a.ring).toBeDefined();
    expect(a.ringHex).toBeDefined();
    expect(a.key).toEqual(b.key);
    expect(a.tag).toEqual(b.tag);
    expect(a.ringHex).toEqual(b.ringHex);
  });

  it('identifies transfer-like categories that should not count as spending', () => {
    expect(isSpendingExcludedCategory('Credit Card Bills')).toBe(true);
    expect(isSpendingExcludedCategory('Credit Card Bill')).toBe(true);
    expect(isSpendingExcludedCategory('CREDIT_CARD_PAYMENT')).toBe(true);
    expect(isSpendingExcludedCategory('Credit Card Payments')).toBe(true);
    expect(isSpendingExcludedCategory('TRANSFER_OUT')).toBe(true);
    expect(isSpendingExcludedCategory('INCOME')).toBe(true);
    expect(isSpendingExcludedCategory('LOAN_PAYMENTS_CREDIT_CARD_PAYMENT')).toBe(true);
    expect(isSpendingExcludedCategory('Groceries')).toBe(false);
  });
});
