import type { SubscriptionSummary } from '@/types/api';

export const sampleSubscriptions: SubscriptionSummary[] = [
  {
    merchant: 'Spotify',
    normalized_merchant: 'spotify',
    monthly_cost: '9.99',
    cadence: 'Monthly',
    last_charged: '2026-05-01',
    occurrence_count: 6,
  },
  {
    merchant: 'Netflix',
    normalized_merchant: 'netflix',
    monthly_cost: '15.99',
    cadence: 'Monthly',
    last_charged: '2026-05-03',
    occurrence_count: 4,
  },
];
