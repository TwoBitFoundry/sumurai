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

    expect(screen.getByRole('button', { name: 'Offline' })).toBeDisabled();
    expect(screen.getByTitle('Unavailable while offline')).toBeDisabled();
  });
});
