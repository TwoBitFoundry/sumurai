import { render, screen } from '@testing-library/react';
import { SubscriptionList } from '@/features/subscriptions/components/SubscriptionList';
import type { SubscriptionSummary } from '@/types/api';

const makeSubscription = (
  merchant: string,
  normalized: string,
  cadence = 'monthly',
  firstCharged = '2026-05-01',
  lastCharged = firstCharged
): SubscriptionSummary => ({
  merchant,
  normalized_merchant: normalized,
  monthly_cost: '9.99',
  cadence,
  first_charged: firstCharged,
  last_charged: lastCharged,
  occurrence_count: 3,
  account_ids: [],
});

describe('SubscriptionList', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-01T12:00:00'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });
  it('renders merchant cards grouped by cadence without per-card cadence pills', () => {
    render(
      <SubscriptionList
        subscriptions={[
          makeSubscription('Spotify', 'spotify', 'monthly'),
          makeSubscription('Adobe', 'adobe', 'quarterly'),
        ]}
      />
    );

    expect(screen.getByText('Spotify')).toBeInTheDocument();
    expect(screen.getByText('Adobe')).toBeInTheDocument();
    expect(screen.getByTestId('subscription-cadence-group-monthly')).toBeInTheDocument();
    expect(screen.getByTestId('subscription-cadence-group-quarterly')).toBeInTheDocument();
    expect(screen.queryByText('monthly')).not.toBeInTheDocument();
    expect(screen.queryByText('quarterly')).not.toBeInTheDocument();
  });

  it('orders subscriptions by since date then merchant name within a cadence group', () => {
    render(
      <SubscriptionList
        subscriptions={[
          makeSubscription('Walmart', 'walmart', 'monthly', '2026-06-01', '2026-06-01'),
          makeSubscription('Costco', 'costco', 'monthly', '2026-06-01', '2026-06-01'),
          makeSubscription('Pdxfit Gym', 'pdxfit-gym', 'monthly', '2026-05-15', '2026-05-15'),
          makeSubscription('Netflix', 'netflix', 'monthly', '2026-06-01', '2026-06-01'),
        ]}
      />
    );

    const monthlyGroup = screen.getByTestId('subscription-cadence-group-monthly');
    const merchants = Array.from(
      monthlyGroup.querySelectorAll('[data-testid^="subscription-card-"]')
    ).map((card) => card.querySelector('span.truncate')?.textContent);

    expect(merchants).toEqual(['Pdxfit Gym', 'Costco', 'Netflix', 'Walmart']);
    expect(screen.getByText('Jun, 15th')).toBeInTheDocument();
    expect(screen.queryByText('May, 15th')).not.toBeInTheDocument();
  });

  it('shows empty state when not loading and there are no subscriptions', () => {
    render(<SubscriptionList subscriptions={[]} />);

    expect(screen.getByTestId('subscriptions-empty-state')).toBeInTheDocument();
    expect(screen.getByText('Yearly')).toBeInTheDocument();
  });
});
