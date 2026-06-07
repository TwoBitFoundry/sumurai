import type { HeroAccent } from '@/ui/tokens';

export const SUBSCRIPTION_CADENCE_LABELS = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Yearly',
} as const;

export type SubscriptionCadenceKey = keyof typeof SUBSCRIPTION_CADENCE_LABELS;

export const SUBSCRIPTION_CADENCE_ORDER: SubscriptionCadenceKey[] = [
  'monthly',
  'quarterly',
  'annual',
];

export const SUBSCRIPTION_CADENCE_ACCENT = {
  monthly: 'sky',
  quarterly: 'sky',
  annual: 'sky',
} as const satisfies Record<SubscriptionCadenceKey, HeroAccent>;

export function normalizeSubscriptionCadence(cadence: string): SubscriptionCadenceKey | null {
  const key = cadence.trim().toLowerCase();

  if (key in SUBSCRIPTION_CADENCE_LABELS) {
    return key as SubscriptionCadenceKey;
  }

  if (key === 'yearly') {
    return 'annual';
  }

  return null;
}

export function compareSubscriptionsBySinceDateThenMerchant<
  T extends { first_charged: string; merchant: string },
>(left: T, right: T): number {
  const dateCompare = left.first_charged.localeCompare(right.first_charged);
  if (dateCompare !== 0) {
    return dateCompare;
  }

  return left.merchant.localeCompare(right.merchant, undefined, { sensitivity: 'base' });
}

export function groupSubscriptionsByCadence<
  T extends { cadence: string; first_charged: string; merchant: string },
>(subscriptions: T[]): Record<SubscriptionCadenceKey, T[]> {
  const grouped = Object.fromEntries(
    SUBSCRIPTION_CADENCE_ORDER.map((cadence) => [cadence, [] as T[]])
  ) as Record<SubscriptionCadenceKey, T[]>;

  for (const subscription of subscriptions) {
    const cadence = normalizeSubscriptionCadence(subscription.cadence) ?? 'monthly';
    grouped[cadence].push(subscription);
  }

  for (const cadence of SUBSCRIPTION_CADENCE_ORDER) {
    grouped[cadence].sort(compareSubscriptionsBySinceDateThenMerchant);
  }

  return grouped;
}
