import { render, screen, waitFor } from '@testing-library/react';
import { FixedExpensesSection } from '@/features/fixed-expenses/components/FixedExpensesSection';
import type { FixedExpenseSummary } from '@/types/api';
import { setSessionBudgetsSectionExpanded } from '@/utils/sessionPreferences';

jest.mock('@/utils/sessionPreferences', () => {
  const actual = jest.requireActual(
    '@/utils/sessionPreferences'
  ) as typeof import('@/utils/sessionPreferences');
  return {
    ...actual,
  };
});

const makeFixed = (merchant: string, normalized: string): FixedExpenseSummary => ({
  merchant,
  normalized_merchant: normalized,
  monthly_cost: '9.99',
  cadence: 'monthly',
  category: 'subscription',
  first_charged: '2026-05-01',
  last_charged: '2026-05-01',
  occurrence_count: 3,
  account_ids: [],
});

const june2026 = new Date(2026, 5, 1);

describe('FixedExpensesSection', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    setSessionBudgetsSectionExpanded('subscriptions', true);
  });

  it('shows Fixed Expenses heading without hero metrics', () => {
    render(<FixedExpensesSection fixedExpenses={[]} month={june2026} isLoading={false} />);

    expect(screen.getByText('Fixed Expenses')).toBeInTheDocument();
    expect(screen.queryByText('Recurring subscriptions')).not.toBeInTheDocument();
    expect(screen.queryByText('Annualized subscriptions')).not.toBeInTheDocument();
  });

  it('shows empty state when there are no items', async () => {
    render(<FixedExpensesSection fixedExpenses={[]} month={june2026} isLoading={false} />);

    await waitFor(() => {
      expect(screen.getByText('No fixed expenses detected')).toBeInTheDocument();
    });
  });

  it('renders cards grouped by cadence', async () => {
    render(
      <FixedExpensesSection
        fixedExpenses={[makeFixed('Spotify', 'spotify')]}
        month={june2026}
        isLoading={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Spotify')).toBeInTheDocument();
    });
    expect(screen.getByText('Monthly')).toBeInTheDocument();
    expect(screen.getByTestId('fixed-expense-cadence-group-monthly')).toBeInTheDocument();
  });

  it('renders Subscriptions and Bills badges when both types are present', async () => {
    render(
      <FixedExpensesSection
        fixedExpenses={[
          makeFixed('Spotify', 'spotify'),
          { ...makeFixed('Comcast', 'comcast'), category: 'bill' },
        ]}
        month={june2026}
        isLoading={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Subscriptions')).toBeInTheDocument();
      expect(screen.getByText('Bills')).toBeInTheDocument();
    });
  });
});
