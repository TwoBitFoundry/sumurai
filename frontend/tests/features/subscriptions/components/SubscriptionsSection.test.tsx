import { render, screen, waitFor } from '@testing-library/react';
import { SubscriptionsSection } from '@/features/subscriptions/components/SubscriptionsSection';
import type { SubscriptionSummary } from '@/types/api';
import { setSessionBudgetsSectionExpanded } from '@/utils/sessionPreferences';

jest.mock('@/utils/sessionPreferences', () => {
  const actual = jest.requireActual(
    '@/utils/sessionPreferences'
  ) as typeof import('@/utils/sessionPreferences');
  return {
    ...actual,
  };
});

const makeSubscription = (merchant: string, normalized: string): SubscriptionSummary => ({
  merchant,
  normalized_merchant: normalized,
  monthly_cost: '9.99',
  cadence: 'monthly',
  first_charged: '2026-05-01',
  last_charged: '2026-05-01',
  occurrence_count: 3,
});

describe('SubscriptionsSection', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    setSessionBudgetsSectionExpanded('subscriptions', true);
  });

  it('shows heading and subtitle without hero metrics', () => {
    render(<SubscriptionsSection subscriptions={[]} isLoading={false} />);

    expect(screen.getByText('Subscriptions')).toBeInTheDocument();
    expect(screen.queryByText('Recurring subscriptions')).not.toBeInTheDocument();
    expect(screen.queryByText('Annualized subscriptions')).not.toBeInTheDocument();
  });

  it('shows empty state when there are no subscriptions', async () => {
    render(<SubscriptionsSection subscriptions={[]} isLoading={false} />);

    await waitFor(() => {
      expect(screen.getByTestId('subscriptions-empty-state')).toBeInTheDocument();
    });
  });

  it('renders subscription cards grouped by cadence', async () => {
    render(
      <SubscriptionsSection
        subscriptions={[makeSubscription('Spotify', 'spotify')]}
        isLoading={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Spotify')).toBeInTheDocument();
    });
    expect(screen.getByText('Monthly')).toBeInTheDocument();
    expect(screen.getByTestId('subscription-cadence-group-monthly')).toBeInTheDocument();
  });
});
