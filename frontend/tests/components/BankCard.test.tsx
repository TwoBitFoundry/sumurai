import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { BankCard } from '@/components/BankCard';
import { ThemeTestProvider } from '../utils/ThemeTestProvider';

jest.mock('@/features/import/components/ImportModal', () => ({
  ImportModal: ({
    account,
    isOpen,
    onClose,
    onImportSuccess,
  }: {
    account: { id: string; mask: string };
    isOpen: boolean;
    onClose: () => void;
    onImportSuccess?: (count: number, mask: string) => void;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label={`Import modal for ${account.id}`}>
        <span>{account.mask}</span>
        <button
          type="button"
          onClick={() => {
            onImportSuccess?.(3, account.mask);
            onClose();
          }}
        >
          Complete import
        </button>
      </div>
    ) : null,
}));

describe('BankCard', () => {
  const renderWithTheme = (ui: React.ReactElement) =>
    render(<ThemeTestProvider>{ui}</ThemeTestProvider>);

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

  it('keeps sync, collapse, disconnect, and account display behavior working', async () => {
    const user = userEvent.setup();
    const onSync = jest.fn().mockResolvedValue(undefined);
    const onDisconnect = jest.fn().mockResolvedValue(undefined);

    renderWithTheme(
      <BankCard
        bank={{
          id: 'bank-1',
          name: 'Chase',
          short: 'CH',
          status: 'connected',
          accounts: [
            {
              id: 'acc-1',
              name: 'Checking',
              mask: '1234',
              type: 'checking',
              transactions: 7,
            },
          ],
        }}
        onSync={onSync}
        onDisconnect={onDisconnect}
        isOnline
      />
    );

    expect(screen.getByText('Checking')).toBeVisible();
    expect(screen.getByText('••1234')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Sync now' }));
    expect(onSync).toHaveBeenCalledWith('bank-1');

    await user.click(screen.getByRole('button', { name: 'Hide accounts' }));
    expect(screen.getByRole('button', { name: 'Show accounts' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Show accounts' }));
    expect(screen.getByText('Checking')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(screen.getByRole('dialog', { name: /Disconnect Chase/ })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(onDisconnect).toHaveBeenCalledWith('bank-1');
  });

  it('shows an accessible import button next to each account transaction count', () => {
    renderWithTheme(
      <BankCard
        bank={{
          id: 'bank-1',
          name: 'Chase',
          short: 'CH',
          status: 'connected',
          accounts: [
            {
              id: 'acc-1',
              name: 'Checking',
              mask: '1234',
              type: 'checking',
              transactions: 7,
            },
          ],
        }}
        onSync={jest.fn()}
        onDisconnect={jest.fn()}
        isOnline
      />
    );

    const count = screen.getByText('7 items');
    const actions = count.parentElement;

    expect(actions).toContainElement(screen.getByRole('button', { name: 'Import transactions' }));
    expect(screen.getByRole('button', { name: 'Import transactions' })).toHaveAttribute(
      'title',
      'Import transactions'
    );
  });

  it('disables account import buttons while offline', () => {
    renderWithTheme(
      <BankCard
        bank={{
          id: 'bank-1',
          name: 'Chase',
          short: 'CH',
          status: 'connected',
          accounts: [
            {
              id: 'acc-1',
              name: 'Checking',
              mask: '1234',
              type: 'checking',
              transactions: 7,
            },
          ],
        }}
        onSync={jest.fn()}
        onDisconnect={jest.fn()}
        isOnline={false}
      />
    );

    expect(screen.getByRole('button', { name: 'Import transactions' })).toBeDisabled();
  });

  it('opens the import modal for the selected account', async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <BankCard
        bank={{
          id: 'bank-1',
          name: 'Chase',
          short: 'CH',
          status: 'connected',
          accounts: [
            {
              id: 'acc-1',
              name: 'Checking',
              mask: '1234',
              type: 'checking',
              transactions: 7,
            },
            {
              id: 'acc-2',
              name: 'Savings',
              mask: '5678',
              type: 'savings',
              transactions: 4,
            },
          ],
        }}
        onSync={jest.fn()}
        onDisconnect={jest.fn()}
        isOnline
      />
    );

    await user.click(screen.getAllByRole('button', { name: 'Import transactions' })[1]);

    expect(screen.getByRole('dialog', { name: 'Import modal for acc-2' })).toBeVisible();
    expect(screen.getByText('5678')).toBeVisible();
  });

  it('threads import success from the selected account', async () => {
    const user = userEvent.setup();
    const onImportSuccess = jest.fn();

    renderWithTheme(
      <BankCard
        bank={{
          id: 'bank-1',
          name: 'Chase',
          short: 'CH',
          status: 'connected',
          accounts: [
            {
              id: 'acc-1',
              name: 'Checking',
              mask: '1234',
              type: 'checking',
              transactions: 7,
            },
          ],
        }}
        onSync={jest.fn()}
        onDisconnect={jest.fn()}
        onImportSuccess={onImportSuccess}
        isOnline
      />
    );

    await user.click(screen.getByRole('button', { name: 'Import transactions' }));
    await user.click(screen.getByRole('button', { name: 'Complete import' }));

    expect(onImportSuccess).toHaveBeenCalledWith(3, '1234');
    expect(
      screen.queryByRole('dialog', { name: 'Import modal for acc-1' })
    ).not.toBeInTheDocument();
  });
});
