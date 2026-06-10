import type { HeroAccent } from '@/ui/tokens';

export const FIXED_EXPENSE_CADENCE_LABELS = {
  biweekly: 'Biweekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Yearly',
} as const;

export type FixedExpenseCadenceKey = keyof typeof FIXED_EXPENSE_CADENCE_LABELS;

export const FIXED_EXPENSE_CADENCE_ORDER: FixedExpenseCadenceKey[] = [
  'biweekly',
  'monthly',
  'quarterly',
  'annual',
];

export const FIXED_EXPENSE_CADENCE_ACCENT = {
  biweekly: 'sky',
  monthly: 'sky',
  quarterly: 'sky',
  annual: 'sky',
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

export function compareFixedExpensesBySinceDateThenMerchant<
  T extends { first_charged: string; merchant: string },
>(left: T, right: T): number {
  const dateCompare = left.first_charged.localeCompare(right.first_charged);
  if (dateCompare !== 0) {
    return dateCompare;
  }

  return left.merchant.localeCompare(right.merchant, undefined, { sensitivity: 'base' });
}

export function groupFixedExpensesByCadence<
  T extends { cadence: string; first_charged: string; merchant: string },
>(items: T[]): Record<FixedExpenseCadenceKey, T[]> {
  const grouped = Object.fromEntries(
    FIXED_EXPENSE_CADENCE_ORDER.map((cadence) => [cadence, [] as T[]])
  ) as Record<FixedExpenseCadenceKey, T[]>;

  for (const item of items) {
    const cadence = normalizeFixedExpenseCadence(item.cadence) ?? 'monthly';
    grouped[cadence].push(item);
  }

  for (const cadence of FIXED_EXPENSE_CADENCE_ORDER) {
    grouped[cadence].sort(compareFixedExpensesBySinceDateThenMerchant);
  }

  return grouped;
}
