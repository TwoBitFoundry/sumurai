jest.mock('@/features/transactions/hooks/useTransactionListLauncher', () => ({
  useTransactionListLauncher: () => ({
    openTransactionList: jest.fn(),
    close: jest.fn(),
  }),
}));

import { render, screen } from '@testing-library/react';
import { FixedExpenseList } from '@/features/fixed-expenses/components/FixedExpenseList';
import type { FixedExpenseSummary } from '@/types/api';
import { heroAccents } from '@/ui/tokens';

const makeFixed = (
  merchant: string,
  normalized: string,
  cadence = 'monthly',
  firstCharged = '2026-05-01',
  lastCharged = firstCharged,
  category: 'subscription' | 'bill' | string = 'subscription',
  occurrenceCount = 3
): FixedExpenseSummary => ({
  merchant,
  normalized_merchant: normalized,
  monthly_cost: '9.99',
  cadence,
  category,
  first_charged: firstCharged,
  last_charged: lastCharged,
  occurrence_count: occurrenceCount,
  account_ids: [],
});

const june2026 = new Date(2026, 5, 1);

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
        month={june2026}
        fixedExpenses={[
          makeFixed('Spotify', 'spotify', 'monthly'),
          makeFixed('Adobe', 'adobe', 'quarterly'),
        ]}
      />
    );

    expect(screen.getByText('Spotify')).toBeInTheDocument();
    expect(screen.getByTestId('fixed-expense-card-spotify').className).not.toContain(
      'drop-shadow-'
    );
    expect(screen.getByTestId('fixed-expense-card-spotify').className).toContain(
      'bg-[color:color-mix(in_srgb,var(--color-surface-card)_70%,transparent)]'
    );
    expect(screen.getByTestId('fixed-expense-card-spotify').className).toContain(
      'border-[var(--color-border-subtle)]'
    );
    const insetRing = screen
      .getByTestId('fixed-expense-card-spotify')
      .querySelector('.hero-stat-card__inset-ring');
    expect(insetRing).toHaveClass('group-hover:opacity-100');
    expect((insetRing as HTMLElement).style.boxShadow).toBe(
      `inset 0 0 0 2px ${heroAccents.azure.ringHex}`
    );
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

  it('orders items by first due date in the month within a cadence group', () => {
    render(
      <FixedExpenseList
        month={june2026}
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
    ).map(
      (card) =>
        card.querySelector('span.font-card-title.truncate')?.textContent ??
        card.querySelector('span.truncate')?.textContent
    );

    expect(merchants).toEqual(['Costco', 'Netflix', 'Walmart', 'Pdxfit Gym']);
    expect(screen.getByTestId('fixed-expense-card-pdxfit-gym')).toHaveTextContent('Jun 15');
    expect(screen.getByTestId('fixed-expense-card-pdxfit-gym')).not.toHaveTextContent('May 15');
  });

  it('lists each due date in the selected month for weekly and biweekly items', () => {
    render(
      <FixedExpenseList
        month={june2026}
        fixedExpenses={[
          makeFixed('Weekly Gym', 'weekly-gym', 'weekly', '2026-06-02', '2026-06-16'),
          makeFixed('Biweekly Club', 'biweekly-club', 'biweekly', '2026-06-02', '2026-06-16'),
        ]}
      />
    );

    expect(screen.getByTestId('fixed-expense-card-weekly-gym')).toHaveTextContent(
      'Jun 2, 9, 16, 23, 30'
    );
    expect(screen.getByTestId('fixed-expense-card-biweekly-club')).toHaveTextContent(
      'Jun 2, 16, 30'
    );
  });

  it('shows empty state when not loading and there are no items', () => {
    render(<FixedExpenseList month={june2026} fixedExpenses={[]} />);

    expect(screen.getByText('No fixed expenses detected')).toBeInTheDocument();
    expect(screen.queryByTestId('fixed-expense-cadence-group-monthly')).not.toBeInTheDocument();
    expect(screen.queryByText('Yearly')).not.toBeInTheDocument();
  });

  it('renders a Subscriptions badge for subscription items', () => {
    render(
      <FixedExpenseList
        month={june2026}
        fixedExpenses={[
          makeFixed('Spotify', 'spotify', 'monthly', '2026-05-01', '2026-05-01', 'subscription'),
        ]}
      />
    );

    expect(screen.getByText('Subscriptions')).toBeInTheDocument();
  });

  it('renders paid and due month state icons', () => {
    render(
      <FixedExpenseList
        month={june2026}
        fixedExpenses={[
          makeFixed(
            'Paid Merchant',
            'paid-merchant',
            'monthly',
            '2026-01-15',
            '2026-06-15',
            'subscription',
            6
          ),
          makeFixed('Due Merchant', 'due-merchant', 'monthly', '2026-01-15', '2026-05-15'),
        ]}
      />
    );

    expect(screen.getByLabelText('All payments paid')).toBeInTheDocument();
    expect(screen.getByLabelText('Upcoming payment')).toBeInTheDocument();
  });

  it('renders missed month state icon when the due date passed without a charge', () => {
    jest.setSystemTime(new Date('2026-06-20T12:00:00'));

    render(
      <FixedExpenseList
        month={june2026}
        fixedExpenses={[
          makeFixed('Missed Merchant', 'missed-merchant', 'monthly', '2026-01-15', '2026-05-15'),
        ]}
      />
    );

    expect(screen.getByLabelText('Missing payment')).toBeInTheDocument();
  });

  it('renders a Bills badge for bill items', () => {
    render(
      <FixedExpenseList
        month={june2026}
        fixedExpenses={[
          makeFixed('Comcast', 'comcast', 'monthly', '2026-05-01', '2026-05-01', 'bill'),
        ]}
      />
    );

    expect(screen.getByText('Bills')).toBeInTheDocument();
  });
});
