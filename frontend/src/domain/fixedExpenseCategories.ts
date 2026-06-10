import type { FixedExpenseSummary } from '@/types/api';

const FIXED_EXPENSE_CATEGORY_PRIMARIES = new Set([
  'SUBSCRIPTION',
  'RENT_AND_UTILITIES',
  'LOAN_PAYMENTS',
  'INSURANCE',
]);

export function getFixedExpenseCategoryPrimary(category?: FixedExpenseSummary['category']): string {
  if (!category) {
    return 'SUBSCRIPTION';
  }

  const normalized = category.trim().replace(/\s+/g, '_').toUpperCase();
  if (normalized === 'BILL') {
    return 'RENT_AND_UTILITIES';
  }

  if (FIXED_EXPENSE_CATEGORY_PRIMARIES.has(normalized)) {
    return normalized;
  }

  return 'SUBSCRIPTION';
}
