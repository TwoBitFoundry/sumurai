import { render, screen } from '@testing-library/react';
import AccountsSummaryStats from '@/features/plaid/components/AccountsSummaryStats';

describe('AccountsSummaryStats', () => {
  it('renders summary cards and an error banner when present', () => {
    render(
      <AccountsSummaryStats
        flowError="Connection sync failed"
        summary={{
          institutions: 3,
          connectedInstitutions: 2,
          accounts: 5,
          latestSync: '2025-05-05T15:00:00Z',
        }}
        syncingAll={false}
        lastSyncValue="2h ago"
        lastSyncDetail="Refreshed May 5, 2025, 10:00 AM"
      />
    );

    expect(screen.getByTestId('accounts-flow-error')).toBeInTheDocument();
    expect(screen.getByText('Active institutions')).toBeInTheDocument();
    expect(screen.getByText('Accounts tracked')).toBeInTheDocument();
    expect(screen.getByText('Last sync')).toBeInTheDocument();
  });
});
