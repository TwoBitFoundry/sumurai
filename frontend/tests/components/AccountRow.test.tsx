const openTransactionList = jest.fn();

jest.mock('@/features/transactions/hooks/useTransactionListLauncher', () => ({
  useTransactionListLauncher: () => ({
    openTransactionList,
    close: jest.fn(),
  }),
}));

jest.mock('@/features/import/components/ImportModal', () => ({
  ImportModal: () => null,
}));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountRow } from '@/components/AccountRow';
import { heroAccents } from '@/ui/tokens';
import { ThemeTestProvider } from '../utils/ThemeTestProvider';

function renderAccountRow(transactions?: number) {
  return render(
    <ThemeTestProvider>
      <AccountRow
        account={{
          id: 'acct-1',
          name: 'Everyday Checking',
          mask: '4821',
          type: 'cash',
          balance: 2450.12,
          transactions,
        }}
        isOnline
      />
    </ThemeTestProvider>
  );
}

describe('AccountRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders transaction count with tx suffix', () => {
    renderAccountRow(95);

    expect(screen.getByText('tx').parentElement).toHaveTextContent('95tx');
  });

  it('renders zero transaction count with tx suffix when transactions are missing', () => {
    renderAccountRow();

    expect(screen.getByText('tx').parentElement).toHaveTextContent('0tx');
  });

  it('uses the violet hero inset ring on hover', () => {
    const { container } = renderAccountRow(12);

    const insetRing = container.querySelector('.hero-stat-card__inset-ring');
    expect(insetRing).toHaveClass('group-hover:opacity-100');
    expect((insetRing as HTMLElement).style.boxShadow).toBe(
      `inset 0 0 0 2px ${heroAccents.violet.ringHex}`
    );
  });

  it('opens the transaction list for the account when the card is clicked', async () => {
    const user = userEvent.setup();

    renderAccountRow(12);

    await user.click(screen.getByText('Everyday Checking'));

    expect(openTransactionList).toHaveBeenCalledWith(
      { type: 'account', accountId: 'acct-1' },
      expect.objectContaining({ current: expect.any(HTMLDivElement) })
    );
  });

  it('does not open the transaction list when import is clicked', async () => {
    const user = userEvent.setup();

    renderAccountRow(12);

    await user.click(screen.getByRole('button', { name: 'Import transactions' }));

    expect(openTransactionList).not.toHaveBeenCalled();
  });
});
