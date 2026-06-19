import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TransactionMerchantLabel from '@/features/transactions/components/TransactionMerchantLabel';

describe('TransactionMerchantLabel', () => {
  it('opens the raw merchant popover when the merchant name is clicked on mobile', async () => {
    const user = userEvent.setup();

    render(
      <TransactionMerchantLabel
        merchantName="Coffee Shop"
        originalMerchantName="SQ *COFFEE SHOP 123"
        merchantLineClassName="merchant-line"
        onMerchantActivate={jest.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Show raw merchant for Coffee Shop' }));

    expect(screen.getByText('Raw merchant')).toBeInTheDocument();
    expect(screen.getByText('SQ *COFFEE SHOP 123')).toBeInTheDocument();
  });

  it('activates merchant search from the merchant button when no raw merchant is available', async () => {
    const user = userEvent.setup();
    const onMerchantActivate = jest.fn();

    render(
      <TransactionMerchantLabel
        merchantName="Transfer"
        merchantLineClassName="merchant-line"
        onMerchantActivate={onMerchantActivate}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Transfer' }));

    expect(onMerchantActivate).toHaveBeenCalledTimes(1);
  });

  it('passes pointer events through plain merchant text to the search target', () => {
    render(
      <TransactionMerchantLabel
        merchantName="Transfer"
        className="merchant-line"
        layeredSearchTarget
      />
    );

    expect(screen.getByText('Transfer')).toHaveClass('pointer-events-none');
  });
});
