import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { useSubscriptions } from '@/features/subscriptions/hooks/useSubscriptions';
import SubscriptionsPage from '@/views/SubscriptionsPage';

jest.mock('@/features/subscriptions/hooks/useSubscriptions', () => ({
  useSubscriptions: jest.fn(),
}));

jest.mock('@/layouts/PageLayout', () => ({
  PageLayout: ({ children, stats }: { children?: React.ReactNode; stats?: React.ReactNode }) => (
    <div data-testid="page-layout">
      <div data-testid="page-stats">{stats}</div>
      <div data-testid="page-children">{children}</div>
    </div>
  ),
}));

const makeSubscription = (merchant: string, normalized: string) => ({
  merchant,
  normalized_merchant: normalized,
  monthly_cost: '9.99',
  cadence: 'monthly',
  last_charged: '2026-05-01',
  occurrence_count: 3,
});

describe('SubscriptionsPage', () => {
  const onNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows empty state when there are no subscriptions', () => {
    jest.mocked(useSubscriptions).mockReturnValue({
      isLoading: false,
      error: null,
      subscriptions: [],
    });

    render(<SubscriptionsPage onNavigateToTransactions={onNavigate} />);

    expect(screen.getByTestId('subscriptions-empty-state')).toBeInTheDocument();
  });

  it('shows subscription cards when data is present', () => {
    jest.mocked(useSubscriptions).mockReturnValue({
      isLoading: false,
      error: null,
      subscriptions: [
        makeSubscription('Spotify', 'spotify'),
        makeSubscription('Netflix', 'netflix'),
      ],
    });

    render(<SubscriptionsPage onNavigateToTransactions={onNavigate} />);

    expect(screen.getByText('Spotify')).toBeInTheDocument();
    expect(screen.getByText('Netflix')).toBeInTheDocument();
    expect(screen.queryByTestId('subscriptions-empty-state')).not.toBeInTheDocument();
  });

  it('clicking a subscription card calls onNavigateToTransactions with merchant name', () => {
    jest.mocked(useSubscriptions).mockReturnValue({
      isLoading: false,
      error: null,
      subscriptions: [makeSubscription('Spotify', 'spotify')],
    });

    render(<SubscriptionsPage onNavigateToTransactions={onNavigate} />);

    fireEvent.click(screen.getByTestId('subscription-card-spotify'));

    expect(onNavigate).toHaveBeenCalledWith('SUBSCRIPTION', 'Spotify');
  });
});
