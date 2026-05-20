/**
 * Debounces chart recalculation when inputs change quickly.
 */

import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

export const CHART_RECALC_DEBOUNCE_MS = 250;

export function useDebouncedChartRecalc<T>(value: T): T {
  return useDebouncedValue(value, CHART_RECALC_DEBOUNCE_MS);
}
