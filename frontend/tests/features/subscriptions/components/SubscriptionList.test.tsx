import { render, screen } from '@testing-library/react';
import { FixedExpenseList } from '@/features/fixed-expenses/components/FixedExpenseList';
import type { FixedExpenseSummary } from '@/types/api';

const makeFixed = (
  merchant: string,
  normalized: string,
  cadence = 'monthly',
  firstCharged = '2026-05-01',
  lastCharged = firstCharged,
  category: 'subscription' | 'bill' = 'subscription'
): FixedExpenseSummary => ({
  merchant,
  normalized_merchant: normalized,
  monthly_cost: '9.99',
  cadence,
  category,
  first_charged: firstCharged,
  last_charged: lastCharged,
  occurrence_count: 3,
  account_ids: [],
});

describe('FixedExpenseList', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-01T12:00:00'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders merchant cards grouped by cadence without per-card cadence pills', () => {
    render(
      <FixedExpenseList
        fixedExpenses={[
          makeFixed('Spotify', 'spotify', 'monthly'),
          makeFixed('Adobe', 'adobe', 'quarterly'),
        ]}
      />
    );

    expect(screen.getByText('Spotify')).toBeInTheDocument();
    expect(
      screen.getByTestId('fixed-expense-card-spotify').querySelector('.tabular-nums')
    ).toHaveTextContent('3tx');
    expect(screen.getByText('Adobe')).toBeInTheDocument();
    expect(screen.getByTestId('fixed-expense-cadence-group-monthly')).toBeInTheDocument();
    expect(screen.getByTestId('fixed-expense-cadence-group-quarterly')).toBeInTheDocument();
    expect(screen.queryByTestId('fixed-expense-cadence-group-annual')).not.toBeInTheDocument();
    expect(screen.queryByText('monthly')).not.toBeInTheDocument();
    expect(screen.queryByText('quarterly')).not.toBeInTheDocument();
  });

  it('orders items by since date then merchant name within a cadence group', () => {
    render(
      <FixedExpenseList
        fixedExpenses={[
          makeFixed('Walmart', 'walmart', 'monthly', '2026-06-01', '2026-06-01'),
          makeFixed('Costco', 'costco', 'monthly', '2026-06-01', '2026-06-01'),
          makeFixed('Pdxfit Gym', 'pdxfit-gym', 'monthly', '2026-05-15', '2026-05-15'),
          makeFixed('Netflix', 'netflix', 'monthly', '2026-06-01', '2026-06-01'),
        ]}
      />
    );

    const monthlyGroup = screen.getByTestId('fixed-expense-cadence-group-monthly');
    const merchants = Array.from(
      monthlyGroup.querySelectorAll('[data-testid^="fixed-expense-card-"]')
    ).map((card) => card.querySelector('span.truncate')?.textContent);

    expect(merchants).toEqual(['Pdxfit Gym', 'Costco', 'Netflix', 'Walmart']);
    expect(screen.getByText('Jun, 15th')).toBeInTheDocument();
    expect(screen.queryByText('May, 15th')).not.toBeInTheDocument();
  });

  it('shows empty state when not loading and there are no items', () => {
    render(<FixedExpenseList fixedExpenses={[]} />);

    expect(screen.getByText('No fixed expenses detected')).toBeInTheDocument();
    expect(screen.queryByTestId('fixed-expense-cadence-group-monthly')).not.toBeInTheDocument();
    expect(screen.queryByText('Yearly')).not.toBeInTheDocument();
  });

  it('renders a Subscription badge for subscription items', () => {
    render(
      <FixedExpenseList
        fixedExpenses={[
          makeFixed('Spotify', 'spotify', 'monthly', '2026-05-01', '2026-05-01', 'subscription'),
        ]}
      />
    );

    expect(screen.getByText('Subscription')).toBeInTheDocument();
  });

  it('renders a Bills badge for bill items', () => {
    render(
      <FixedExpenseList
        fixedExpenses={[
          makeFixed('Comcast', 'comcast', 'monthly', '2026-05-01', '2026-05-01', 'bill'),
        ]}
      />
    );

    expect(screen.getByText('Bills')).toBeInTheDocument();
  });
});
