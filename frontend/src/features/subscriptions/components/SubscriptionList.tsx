import { FixedExpenseList } from '@/features/fixed-expenses/components/FixedExpenseList';
import type { FixedExpenseSummary } from '@/types/api';

export type SubscriptionSummary = FixedExpenseSummary;

export interface SubscriptionListProps {
  subscriptions: SubscriptionSummary[];
  isLoading?: boolean;
}

export function SubscriptionList({ subscriptions, isLoading }: SubscriptionListProps) {
  return <FixedExpenseList fixedExpenses={subscriptions} isLoading={isLoading} />;
}
