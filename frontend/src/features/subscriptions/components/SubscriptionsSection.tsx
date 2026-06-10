import { FixedExpensesSection } from '@/features/fixed-expenses/components/FixedExpensesSection';
import type { FixedExpenseSummary } from '@/types/api';

export type SubscriptionSummary = FixedExpenseSummary;

export interface SubscriptionsSectionProps {
  subscriptions: SubscriptionSummary[];
  isLoading?: boolean;
}

export function SubscriptionsSection({ subscriptions, isLoading }: SubscriptionsSectionProps) {
  return <FixedExpensesSection fixedExpenses={subscriptions} isLoading={isLoading} />;
}
