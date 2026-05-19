import { render, screen } from '@testing-library/react';
import { BankCard } from '@/components/BankCard';

describe('BankCard', () => {
  it('disables sync when the app is offline', () => {
    render(
      <BankCard
        bank={{
          id: 'bank-1',
          name: 'Test Bank',
          short: 'TB',
          status: 'connected',
          accounts: [],
        }}
        onSync={jest.fn()}
        onDisconnect={jest.fn()}
        isOnline={false}
      />
    );

    expect(screen.getByRole('button', { name: 'Sync now' })).toBeDisabled();
    expect(screen.getByTitle('Unavailable while offline')).toBeDisabled();
  });

  it('shows connection status before the bank name', () => {
    render(
      <BankCard
        bank={{
          id: 'bank-1',
          name: 'Chase',
          short: 'CH',
          status: 'connected',
          accounts: [],
        }}
        onSync={jest.fn()}
        onDisconnect={jest.fn()}
        isOnline
      />
    );

    expect(screen.getByRole('heading', { name: 'Chase' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Connected' })).toBeInTheDocument();
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
  });

  it('wraps long bank names up to two lines in the card header', () => {
    const longName = 'First National Bank of Very Long Institution Names';
    render(
      <BankCard
        bank={{
          id: 'bank-1',
          name: longName,
          short: 'FN',
          status: 'connected',
          accounts: [],
        }}
        onSync={jest.fn()}
        onDisconnect={jest.fn()}
        isOnline
      />
    );

    const heading = screen.getByRole('heading', { name: longName });
    expect(heading).toHaveClass('line-clamp-2');
    expect(heading).toHaveClass('break-words');
  });

  it('shows a status caption when re-auth is required', () => {
    render(
      <BankCard
        bank={{
          id: 'bank-1',
          name: 'Chase',
          short: 'CH',
          status: 'needs_reauth',
          accounts: [],
        }}
        onSync={jest.fn()}
        onDisconnect={jest.fn()}
        isOnline
      />
    );

    expect(screen.getByText('Re-auth needed')).toBeInTheDocument();
  });
});
