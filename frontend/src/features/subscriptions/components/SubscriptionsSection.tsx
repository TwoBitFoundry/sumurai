import type { SubscriptionSummary } from '@/types/api';
import { cn } from '@/ui/primitives';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
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
    <section className={cn('space-y-4')} data-testid="subscriptions-section">
      <div className={cn('space-y-1')}>
        <h2 className={cn(uiTypographyRecipes.sectionTitle, uiTextRecipes.primary)}>Vows</h2>
        <p className={cn(uiTypographyRecipes.body, uiTextRecipes.muted)}>
          Surfaced recurring vows from transaction history.
        </p>
      </div>
      <SubscriptionList subscriptions={subscriptions} isLoading={isLoading} />
    </section>
  );
}
