import { fireEvent, render } from '@testing-library/react';
import ConnectionsList from '@/features/plaid/components/ConnectionsList';

jest.mock('@/components/BankCard', () => ({
  __esModule: true,
  BankCard: ({ bank, onSync, onDisconnect }: any) => (
    <div data-testid="bank-card">
      <span>{bank.name}</span>
      <button onClick={() => onSync(bank.id)}>sync</button>
      <button onClick={() => onDisconnect(bank.id)}>disconnect</button>
    </div>
  ),
}));

jest.mock('@/features/plaid/components/ConnectButton', () => ({
  __esModule: true,
  default: ({ onClick }: any) => <button onClick={onClick}>Add account</button>,
}));

describe('ConnectionsList', () => {
  const bank = {
    id: 'bank-1',
    name: 'Bank One',
    short: 'BO',
    status: 'connected' as const,
    accounts: [],
    lastSync: null,
  };

  it('renders bank cards when banks exist', () => {
    const onSync = jest.fn();
    const onDisconnect = jest.fn();
    const { getAllByTestId, getByText } = render(
      <ConnectionsList
        banks={[bank]}
        onConnect={jest.fn()}
        onSync={onSync}
        onDisconnect={onDisconnect}
      />
    );

    expect(getAllByTestId('bank-card')).toHaveLength(1);
    fireEvent.click(getByText('sync'));
    expect(onSync).toHaveBeenCalledWith('bank-1');
  });

  it('shows empty state when no banks', () => {
    const onConnect = jest.fn();
    const { getAllByText } = render(
      <ConnectionsList
        banks={[]}
        onConnect={onConnect}
        onSync={jest.fn()}
        onDisconnect={jest.fn()}
      />
    );

    const buttons = getAllByText(/add account/i);
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onConnect).toHaveBeenCalled();
  });
});
