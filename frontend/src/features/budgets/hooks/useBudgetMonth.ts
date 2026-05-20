/**
 * Tracks the active budget month selection.
 */

import { useCallback, useMemo, useState } from 'react';

export const LONGEST_BUDGET_MONTH_LABEL = 'September 9999';

export function normalizeBudgetMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function getBudgetMonthRange(date: Date): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

export function useBudgetMonth(initialMonth: Date = normalizeBudgetMonth(new Date())) {
  const [month, setMonthState] = useState(() => normalizeBudgetMonth(initialMonth));

  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }),
    []
  );

  const monthLabel = useMemo(() => monthFormatter.format(month), [month, monthFormatter]);
  const range = useMemo(() => getBudgetMonthRange(month), [month]);

  const setMonth = useCallback((value: Date) => {
    setMonthState(normalizeBudgetMonth(value));
  }, []);

  const goToPreviousMonth = useCallback(() => {
    setMonthState((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setMonthState((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const goToCurrentMonth = useCallback(() => {
    setMonthState(normalizeBudgetMonth(new Date()));
  }, []);

  return {
    month,
    monthLabel,
    range,
    setMonth,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
  };
}

export type BudgetMonthControl = ReturnType<typeof useBudgetMonth>;
