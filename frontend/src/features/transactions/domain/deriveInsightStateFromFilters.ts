import type { InsightState } from '@/types/api';

export interface InsightFilterContext {
  singleAccountSelected: boolean;
  categoryActive: boolean;
  merchantActive: boolean;
}

export function deriveInsightStateFromFilters(filters: InsightFilterContext): InsightState {
  const { singleAccountSelected, categoryActive, merchantActive } = filters;

  if (singleAccountSelected && categoryActive && merchantActive) {
    return 'triple';
  }
  if (singleAccountSelected && categoryActive) {
    return 'e';
  }
  if (singleAccountSelected && merchantActive) {
    return 'f';
  }
  if (categoryActive && merchantActive) {
    return 'g';
  }
  if (singleAccountSelected) {
    return 'd';
  }
  if (categoryActive) {
    return 'b';
  }
  if (merchantActive) {
    return 'c';
  }
  return 'a';
}
