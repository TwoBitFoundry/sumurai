import { fireEvent, render, screen } from '@testing-library/react';
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
  const onSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows heading and subtitle without hero metrics', () => {
    render(<SubscriptionsSection subscriptions={[]} isLoading={false} onSelect={onSelect} />);

    expect(screen.getByText('Recurring subscriptions')).toBeInTheDocument();
    expect(screen.queryByText('Monthly recurring')).not.toBeInTheDocument();
    expect(screen.queryByText('Annualized')).not.toBeInTheDocument();
  });

  it('shows empty state when there are no subscriptions', () => {
    render(<SubscriptionsSection subscriptions={[]} isLoading={false} onSelect={onSelect} />);

    expect(screen.getByTestId('subscriptions-empty-state')).toBeInTheDocument();
  });

  it('renders subscription cards and forwards selection', () => {
    render(
      <SubscriptionsSection
        subscriptions={[makeSubscription('Spotify', 'spotify')]}
        isLoading={false}
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByTestId('subscription-card-spotify'));
    expect(onSelect).toHaveBeenCalledWith('Spotify');
  });
});
