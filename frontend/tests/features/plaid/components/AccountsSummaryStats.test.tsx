import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountsSummaryStats } from '@/features/plaid/components/AccountsSummaryStats';

const defaultSummary = {
  institutions: 3,
  connectedInstitutions: 2,
  accounts: 5,
  latestSync: null,
};

async function expandAccountInsights(user: ReturnType<typeof userEvent.setup> = userEvent.setup()) {
  const toggle = screen.getByRole('button', { name: /expand account insights/i });
  if (toggle.getAttribute('aria-expanded') !== 'true') {
    await user.click(toggle);
  }
}

describe('AccountsSummaryStats', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('renders an InsightsPanel shell with violet accent', () => {
    render(<AccountsSummaryStats summary={defaultSummary} lastSyncValue="12m ago" />);

    const shell = screen.getByTestId('accounts-summary-shell');
    expect(shell).toHaveClass('sticky');
    expect(shell).toHaveClass('z-30');
    expect(shell.firstElementChild?.className).toContain('backdrop-blur-md');
    expect(shell.firstElementChild?.className).toContain('--color-surface-glass-panel');
    expect(shell.querySelector('.hero-stat-card__inset-ring')).not.toBeNull();
    expect(screen.getByText('Account insights')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /expand account insights/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('renders all stats as InsightCards with budget metric format', async () => {
    const user = userEvent.setup();
    render(<AccountsSummaryStats summary={defaultSummary} lastSyncValue="12m ago" />);
    await expandAccountInsights(user);

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

  it('toggles account insights from the summary header', async () => {
    const user = userEvent.setup();

    render(<AccountsSummaryStats summary={defaultSummary} lastSyncValue="12m ago" />);

    const toggle = screen.getByRole('button', { name: /expand account insights/i });
    expect(toggle).toHaveAttribute('aria-label', 'Expand account insights');
    expect(screen.queryByTestId('accounts-summary-panel-body')).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('accounts-summary-panel-body')).toBeInTheDocument();

    await user.click(toggle);

    expect(screen.getByRole('button', { name: /expand account insights/i })).toBeInTheDocument();
  });

  it('flips insight cards to show their questions', async () => {
    const user = userEvent.setup();
    render(<AccountsSummaryStats summary={defaultSummary} lastSyncValue="12m ago" />);
    await expandAccountInsights(user);

    await user.click(screen.getByRole('button', { name: 'Institutions' }));
    await waitFor(() => {
      expect(screen.getByTestId('insight-question')).toBeInTheDocument();
    });
    expect(
      screen.getByText(/how many of your linked institutions are currently connected/i)
    ).toBeInTheDocument();
  });
});
