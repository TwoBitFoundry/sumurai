import { Repeat2 } from 'lucide-react';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import type { SubscriptionSummary } from '@/types/api';
import { heroAccents } from '@/ui/tokens';
import { SubscriptionList } from './SubscriptionList';

export interface SubscriptionsSectionProps {
  subscriptions: SubscriptionSummary[];
  isLoading?: boolean;
}

export function SubscriptionsSection({
  subscriptions,
  isLoading = false,
}: SubscriptionsSectionProps) {
  return (
    <CollapsibleSection
      sectionId="subscriptions"
      title="Subscriptions"
      titleIcon={Repeat2}
      titleIconClassName={heroAccents.sky.icon}
      description="Review subscription cost and renewal dates found in transactions."
      testId="subscriptions-section"
      expandLabel="Show subscriptions"
      collapseLabel="Hide subscriptions"
    >
      <SubscriptionList subscriptions={subscriptions} isLoading={isLoading} />
    </CollapsibleSection>
  );
}
