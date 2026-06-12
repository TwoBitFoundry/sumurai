import {
  getFixedExpenseCategoryPrimary,
  isFixedExpenseCategoryPrimary,
} from '@/domain/fixedExpenseCategories';

describe('getFixedExpenseCategoryPrimary', () => {
  it('passes through fixed expense category primaries from the API', () => {
    expect(getFixedExpenseCategoryPrimary('LOAN_PAYMENTS')).toBe('LOAN_PAYMENTS');
    expect(getFixedExpenseCategoryPrimary('INSURANCE')).toBe('INSURANCE');
    expect(getFixedExpenseCategoryPrimary('RENT_AND_UTILITIES')).toBe('RENT_AND_UTILITIES');
  });

  it('maps legacy bill and subscription labels to category primaries', () => {
    expect(getFixedExpenseCategoryPrimary('bill')).toBe('RENT_AND_UTILITIES');
    expect(getFixedExpenseCategoryPrimary('subscription')).toBe('SUBSCRIPTION');
  });
});

describe('isFixedExpenseCategoryPrimary', () => {
  it('identifies fixed expense category primaries', () => {
    expect(isFixedExpenseCategoryPrimary('SUBSCRIPTION')).toBe(true);
    expect(isFixedExpenseCategoryPrimary('RENT_AND_UTILITIES')).toBe(true);
    expect(isFixedExpenseCategoryPrimary('bill')).toBe(true);
  });

  it('treats discretionary categories as free spending', () => {
    expect(isFixedExpenseCategoryPrimary('FOOD_AND_DRINK')).toBe(false);
    expect(isFixedExpenseCategoryPrimary('SHOPPING')).toBe(false);
  });
});
