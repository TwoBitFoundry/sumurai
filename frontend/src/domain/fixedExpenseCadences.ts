import { listScheduledChargeDatesInMonth } from '@/domain/FixedExpenseCalculator';
import type { HeroAccent } from '@/ui/tokens';

export const FIXED_EXPENSE_CADENCE_LABELS = {
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Yearly',
} as const;

export type FixedExpenseCadenceKey = keyof typeof FIXED_EXPENSE_CADENCE_LABELS;

export const FIXED_EXPENSE_CADENCE_ORDER: FixedExpenseCadenceKey[] = [
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'annual',
];

export const FIXED_EXPENSE_CADENCE_ACCENT = {
  weekly: 'azure',
  biweekly: 'azure',
  monthly: 'azure',
  quarterly: 'azure',
  annual: 'azure',
} as const satisfies Record<FixedExpenseCadenceKey, HeroAccent>;

export function normalizeFixedExpenseCadence(cadence: string): FixedExpenseCadenceKey | null {
  const key = cadence.trim().toLowerCase();

  if (key in FIXED_EXPENSE_CADENCE_LABELS) {
    return key as FixedExpenseCadenceKey;
  }

  if (key === 'yearly') {
    return 'annual';
  }

  if (key === 'bi-weekly' || key === 'bi_weekly') {
    return 'biweekly';
  }

  return null;
}

export function compareFixedExpensesByFirstDueDateInMonth<
  T extends { cadence: string; first_charged: string; merchant: string },
>(month: Date, left: T, right: T): number {
  const leftDue = listScheduledChargeDatesInMonth(left, month)[0] ?? '9999-12-31';
  const rightDue = listScheduledChargeDatesInMonth(right, month)[0] ?? '9999-12-31';
  const dateCompare = leftDue.localeCompare(rightDue);
  if (dateCompare !== 0) {
    return dateCompare;
  }

  return left.merchant.localeCompare(right.merchant, undefined, { sensitivity: 'base' });
}

export function groupFixedExpensesByCadence<
  T extends { cadence: string; first_charged: string; merchant: string },
>(items: T[], month: Date): Record<FixedExpenseCadenceKey, T[]> {
  const grouped = Object.fromEntries(
    FIXED_EXPENSE_CADENCE_ORDER.map((cadence) => [cadence, [] as T[]])
  ) as Record<FixedExpenseCadenceKey, T[]>;

  for (const item of items) {
    const cadence = normalizeFixedExpenseCadence(item.cadence) ?? 'monthly';
    grouped[cadence].push(item);
  }

  for (const cadence of FIXED_EXPENSE_CADENCE_ORDER) {
    grouped[cadence].sort((left, right) =>
      compareFixedExpensesByFirstDueDateInMonth(month, left, right)
    );
  }

  return grouped;
}
