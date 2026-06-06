import { render, screen } from '@testing-library/react';
import { SubscriptionsSection } from '@/features/subscriptions/components/SubscriptionsSection';
import type { SubscriptionSummary } from '@/types/api';

const makeSubscription = (merchant: string, normalized: string): SubscriptionSummary => ({
  merchant,
  normalized_merchant: normalized,
  monthly_cost: '9.99',
  cadence: 'monthly',
  last_charged: '2026-05-01',
  occurrence_count: 3,
});

describe('SubscriptionsSection', () => {
  it('shows heading and subtitle without hero metrics', () => {
    render(<SubscriptionsSection subscriptions={[]} isLoading={false} />);

    expect(screen.getByText('Subscriptions')).toBeInTheDocument();
    expect(screen.queryByText('Recurring subscriptions')).not.toBeInTheDocument();
    expect(screen.queryByText('Annualized subscriptions')).not.toBeInTheDocument();
  });

  it('shows empty state when there are no subscriptions', () => {
    render(<SubscriptionsSection subscriptions={[]} isLoading={false} />);

    expect(screen.getByTestId('subscriptions-empty-state')).toBeInTheDocument();
  });

  it('renders subscription cards', () => {
    render(
      <SubscriptionsSection
        subscriptions={[makeSubscription('Spotify', 'spotify')]}
        isLoading={false}
      />
    );

    expect(screen.getByText('Spotify')).toBeInTheDocument();
  });
});
