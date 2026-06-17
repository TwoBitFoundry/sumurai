import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { TransactionListLauncherProvider } from '@/features/transactions/components/TransactionListLauncherProvider';
import { useTransactionListLauncher } from '@/features/transactions/hooks/useTransactionListLauncher';

jest.mock('@/features/transactions/components/TransactionListPopover', () => ({
  TransactionListPopover: ({
    open,
    context,
  }: {
    open: boolean;
    context: { type: string; merchant?: string };
  }) =>
    open ? (
      <div data-testid="transaction-list-popover">{context.merchant ?? context.type}</div>
    ) : null,
}));

function MerchantLauncherProbe({ merchant }: { merchant: string }) {
  const cardRef = useRef<HTMLButtonElement>(null);
  const { openTransactionList } = useTransactionListLauncher();

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={() => openTransactionList({ type: 'merchant', merchant }, cardRef)}
    >
      {merchant}
    </button>
  );
}

describe('TransactionListLauncherProvider', () => {
  it('closes the popover when the same anchor is clicked again', async () => {
    const user = userEvent.setup();

    render(
      <TransactionListLauncherProvider>
        <MerchantLauncherProbe merchant="Costco" />
      </TransactionListLauncherProvider>
    );

    const card = screen.getByRole('button', { name: 'Costco' });

    await user.click(card);
    expect(screen.getByTestId('transaction-list-popover')).toHaveTextContent('Costco');

    await user.click(card);
    expect(screen.queryByTestId('transaction-list-popover')).toBeNull();
  });

  it('keeps the popover open when a different merchant anchor is clicked', async () => {
    const user = userEvent.setup();

    render(
      <TransactionListLauncherProvider>
        <MerchantLauncherProbe merchant="Costco" />
        <MerchantLauncherProbe merchant="Wholefds Mkt" />
      </TransactionListLauncherProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Costco' }));
    expect(screen.getByTestId('transaction-list-popover')).toHaveTextContent('Costco');

    await user.click(screen.getByRole('button', { name: 'Wholefds Mkt' }));
    expect(screen.getByTestId('transaction-list-popover')).toHaveTextContent('Wholefds Mkt');
  });
});
