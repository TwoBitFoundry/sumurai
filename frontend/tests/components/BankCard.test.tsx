import '../mocks/framerMotionStub';
import { render, screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { BankCard } from '@/components/BankCard';
import { control } from '@/ui/recipes';
import { ThemeTestProvider } from '../utils/ThemeTestProvider';

jest.mock('@/utils/sessionPreferences', () => {
  const actual = jest.requireActual(
    '@/utils/sessionPreferences'
  ) as typeof import('@/utils/sessionPreferences');
  return {
    ...actual,
    getSessionBankExpanded: jest.fn(() => false),
    setSessionBankExpanded: jest.fn(),
  };
});

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
  beforeEach(() => {
    window.sessionStorage.clear();
  });

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
    expect(screen.getByRole('button', { name: 'Export institution data' })).toBeDisabled();
  });

  it('hides the sync action for SimpleFIN banks', () => {
    render(
      <BankCard
        bank={{
          id: 'bank-1',
          name: 'SimpleFIN Bank',
          short: 'SF',
          status: 'connected',
          provider: 'simplefin',
          accounts: [],
        }}
        onSync={jest.fn()}
        onDisconnect={jest.fn()}
        isOnline
      />
    );

    expect(screen.queryByRole('button', { name: 'Sync now' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show accounts' })).toBeVisible();
  });

  it('renders an export menu in the header and exports the institution', async () => {
    const user = userEvent.setup();
    const onExport = jest.fn().mockResolvedValue(undefined);

    renderWithTheme(
      <BankCard
        bank={{
          id: 'bank-1',
          name: 'Chase',
          short: 'CH',
          status: 'connected',
          connectionId: 'conn-1',
          accounts: [],
        }}
        onSync={jest.fn()}
        onDisconnect={jest.fn()}
        onExport={onExport}
        isOnline
      />
    );

    await user.click(screen.getByRole('button', { name: 'Export institution data' }));
    await user.click(screen.getByRole('button', { name: 'Export as CSV' }));

    expect(onExport).toHaveBeenCalledWith('csv', 'conn-1');
  });

  it('sizes institution card glyphs with the shared control scale', async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <BankCard
        bank={{
          id: 'bank-1',
          name: 'Chase',
          short: 'CH',
          status: 'connected',
          accounts: [{ id: 'acc-1', name: 'Checking', mask: '1234', type: 'checking' }],
        }}
        onSync={jest.fn()}
        onDisconnect={jest.fn()}
        isOnline
      />
    );

    const statusIcon = screen.getByRole('status', { name: 'Connected' }).querySelector('svg');
    expect(statusIcon?.parentElement?.className).toContain(control.glyph.lg);

    const syncIcon = screen.getByRole('button', { name: 'Sync now' }).querySelector('svg');
    expect(syncIcon?.parentElement?.className).toContain(control.glyph.md);

    await user.click(screen.getByRole('button', { name: 'Show accounts' }));

    const groupIcon = (
      await screen.findByText('Cash', { exact: true })
    ).parentElement?.querySelector('svg');
    expect(groupIcon?.parentElement?.className).toContain(control.glyph.lg);
  });

  it('places the status icon and bank name on the first header row', () => {
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

    const heading = screen.getByRole('heading', { name: 'Chase' });
    const titleRow = heading.parentElement;
    expect(titleRow).toHaveClass('items-center');
    expect(titleRow).toHaveClass('p-3');
    expect(
      within(titleRow as HTMLElement).getByRole('status', { name: 'Connected' })
    ).toBeVisible();

    const actionRow = screen.getByRole('button', { name: 'Show accounts' }).parentElement;
    expect(actionRow).toHaveClass('items-center');
    expect(
      within(actionRow as HTMLElement).getByRole('button', { name: 'Sync now' })
    ).toBeVisible();
    expect(
      within(actionRow as HTMLElement).getByRole('button', { name: 'Export institution data' })
    ).toBeVisible();
    expect(
      within(actionRow as HTMLElement).queryByRole('button', { name: 'Disconnect' })
    ).not.toBeInTheDocument();

    const disconnectButton = screen.getByRole('button', { name: 'Disconnect' });
    expect(disconnectButton.parentElement).toHaveClass('row-span-2');
    expect(disconnectButton.parentElement).toHaveClass('items-center');
    expect(titleRow).not.toContainElement(disconnectButton);
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
    const onExport = jest.fn().mockResolvedValue(undefined);

    const { container } = renderWithTheme(
      <BankCard
        bank={{
          id: 'bank-1',
          name: 'Chase',
          short: 'CH',
          status: 'connected',
          connectionId: 'conn-1',
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
        onExport={onExport}
        isOnline
      />
    );
    const local = within(container);

    expect(local.getByRole('button', { name: 'Show accounts' })).toBeVisible();
    expect(local.queryByText('Checking')).not.toBeInTheDocument();

    await user.click(local.getByRole('button', { name: 'Show accounts' }));
    await waitFor(() => {
      expect(local.getByText('Checking')).toBeVisible();
      expect(local.getByText('••1234')).toBeVisible();
    });

    await user.click(local.getByRole('button', { name: 'Sync now' }));
    expect(onSync).toHaveBeenCalledWith('bank-1');

    await user.click(local.getByRole('button', { name: 'Export institution data' }));
    await user.click(screen.getByRole('button', { name: 'Export as OFX' }));
    expect(onExport).toHaveBeenCalledWith('ofx', 'conn-1');

    await user.click(local.getByRole('button', { name: 'Hide accounts' }));
    expect(local.getByRole('button', { name: 'Show accounts' })).toBeVisible();

    await user.click(local.getByRole('button', { name: 'Show accounts' }));
    await waitFor(() => {
      expect(local.getByText('Checking')).toBeVisible();
    });

    await user.click(local.getByRole('button', { name: 'Disconnect' }));
    const dialog = await screen.findByRole('dialog', { name: /Disconnect Chase/ });
    await user.click(within(dialog).getByRole('button', { name: 'Disconnect' }));
    expect(onDisconnect).toHaveBeenCalledWith('bank-1');
  });

  it('shows an accessible import button next to each account transaction count', async () => {
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
          ],
        }}
        onSync={jest.fn()}
        onDisconnect={jest.fn()}
        isOnline
      />
    );

    await user.click(screen.getByRole('button', { name: 'Show accounts' }));

    const count = await screen.findByText('7 items');
    const actions = count.parentElement;

    expect(actions).toContainElement(screen.getByRole('button', { name: 'Import transactions' }));
    expect(screen.getByRole('button', { name: 'Import transactions' })).toHaveAttribute(
      'title',
      'Import transactions'
    );
  });

  it('disables account import buttons while offline', async () => {
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
          ],
        }}
        onSync={jest.fn()}
        onDisconnect={jest.fn()}
        isOnline={false}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Show accounts' }));

    expect(await screen.findByRole('button', { name: 'Import transactions' })).toBeDisabled();
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

    await user.click(screen.getByRole('button', { name: 'Show accounts' }));
    await screen.findByText('Savings');
    await user.click(screen.getAllByRole('button', { name: 'Import transactions' })[1]);

    expect(await screen.findByRole('dialog', { name: 'Import modal for acc-2' })).toBeVisible();
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

    await user.click(screen.getByRole('button', { name: 'Show accounts' }));
    await screen.findByText('Checking');
    await user.click(screen.getByRole('button', { name: 'Import transactions' }));
    await user.click(screen.getByRole('button', { name: 'Complete import' }));

    expect(onImportSuccess).toHaveBeenCalledWith(3, '1234');
    expect(
      screen.queryByRole('dialog', { name: 'Import modal for acc-1' })
    ).not.toBeInTheDocument();
  });
});
