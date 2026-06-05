import { fireEvent, render, screen } from '@testing-library/react';
import { SubscriptionList } from '@/features/subscriptions/components/SubscriptionList';
import type { SubscriptionSummary } from '@/types/api';

const makeSubscription = (merchant: string, normalized: string): SubscriptionSummary => ({
  merchant,
  normalized_merchant: normalized,
  monthly_cost: '9.99',
  cadence: 'monthly',
  last_charged: '2026-05-01',
  occurrence_count: 3,
});

describe('SubscriptionList', () => {
  const onSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders merchant cards when subscriptions are present', () => {
    render(
      <SubscriptionList
        subscriptions={[
          makeSubscription('Spotify', 'spotify'),
          makeSubscription('Netflix', 'netflix'),
        ]}
        onSelect={onSelect}
      />
    );

    expect(screen.getByText('Spotify')).toBeInTheDocument();
    expect(screen.getByText('Netflix')).toBeInTheDocument();
  });

  it('invokes onSelect with merchant name when a card is clicked', () => {
    render(
      <SubscriptionList
        subscriptions={[makeSubscription('Spotify', 'spotify')]}
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByTestId('subscription-card-spotify'));

    expect(onSelect).toHaveBeenCalledWith('Spotify');
  });

  it('shows empty state when not loading and there are no subscriptions', () => {
    render(<SubscriptionList subscriptions={[]} onSelect={onSelect} />);

    expect(screen.getByTestId('subscriptions-empty-state')).toBeInTheDocument();
  });
});
