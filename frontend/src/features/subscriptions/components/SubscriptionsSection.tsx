import type { SubscriptionSummary } from '@/types/api';
import { cn } from '@/ui/primitives';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import { SubscriptionList } from './SubscriptionList';

export interface SubscriptionsSectionProps {
  subscriptions: SubscriptionSummary[];
  isLoading?: boolean;
  onSelect: (merchant: string) => void;
}

export function SubscriptionsSection({
  subscriptions,
  isLoading = false,
  onSelect,
}: SubscriptionsSectionProps) {
  return (
    <section className={cn('space-y-4')} data-testid="subscriptions-section">
      <div className={cn('space-y-1')}>
        <h2 className={cn(uiTypographyRecipes.sectionTitle, uiTextRecipes.primary)}>
          Recurring subscriptions
        </h2>
        <p className={cn(uiTypographyRecipes.body, uiTextRecipes.muted)}>
          Detected from your transaction history, grouped and priced at monthly rate.
        </p>
      </div>
      <SubscriptionList subscriptions={subscriptions} isLoading={isLoading} onSelect={onSelect} />
    </section>
  );
}
