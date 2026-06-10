import type { FixedExpenseSummary } from '@/types/api';

export function getFixedExpenseCategoryPrimary(
  category?: FixedExpenseSummary['category']
): 'RENT_AND_UTILITIES' | 'SUBSCRIPTION' {
  return category === 'bill' ? 'RENT_AND_UTILITIES' : 'SUBSCRIPTION';
}
