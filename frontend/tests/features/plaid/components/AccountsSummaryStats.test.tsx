import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountsSummaryStats } from '@/features/plaid/components/AccountsSummaryStats';

const defaultSummary = {
  institutions: 3,
  connectedInstitutions: 2,
  accounts: 5,
  latestSync: null,
};

describe('AccountsSummaryStats', () => {
  it('renders an InsightsPanel shell with violet accent', () => {
    render(<AccountsSummaryStats summary={defaultSummary} lastSyncValue="12m ago" />);

    const shell = screen.getByTestId('accounts-summary-shell');
    expect(shell.className).toContain('border-0');
    expect(shell.querySelector('.hero-stat-card__inset-ring')).not.toBeNull();
    expect(screen.getByText('Account summary')).toBeInTheDocument();
  });

  it('renders all stats as InsightCards with budget metric format', () => {
    render(<AccountsSummaryStats summary={defaultSummary} lastSyncValue="12m ago" />);

    const institutionsCard = screen.getByTestId('insight-card-institutions');
    expect(institutionsCard).toBeInTheDocument();
    expect(within(institutionsCard).getByText('out of')).toBeInTheDocument();
    expect(within(institutionsCard).getByText('2')).toBeInTheDocument();
    expect(within(institutionsCard).getByText('3')).toBeInTheDocument();

    const accountsCard = screen.getByTestId('insight-card-accounts');
    expect(within(accountsCard).getByText('5')).toBeInTheDocument();
    expect(within(accountsCard).getByText('accounts')).toBeInTheDocument();

    const lastSyncCard = screen.getByTestId('insight-card-last-sync');
    expect(within(lastSyncCard).getByText('12m ago')).toBeInTheDocument();
  });

  it('flips insight cards to show their questions', async () => {
    render(<AccountsSummaryStats summary={defaultSummary} lastSyncValue="12m ago" />);

    await userEvent.click(screen.getByRole('button', { name: 'Institutions' }));
    await waitFor(() => {
      expect(screen.getByTestId('insight-question')).toBeInTheDocument();
    });
    expect(
      screen.getByText(/how many of your linked institutions are currently connected/i)
    ).toBeInTheDocument();
  });
});
