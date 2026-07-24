import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UpgradeRequiredModal } from '@/features/billing/UpgradeRequiredModal';

describe('UpgradeRequiredModal', () => {
  it('renders the existing modal vocabulary and invokes the primary action', async () => {
    const user = userEvent.setup();
    const onViewPlans = jest.fn();

    render(<UpgradeRequiredModal isOpen onClose={jest.fn()} onViewPlans={onViewPlans} />);

    expect(screen.getByRole('dialog')).toHaveAccessibleName('Paid access required');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Choose a plan to continue using your financial data.'
    );
    await user.click(screen.getByRole('button', { name: 'View plans in Settings' }));
    expect(onViewPlans).toHaveBeenCalledTimes(1);
  });

  it('dismisses through the secondary action and Escape', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();

    render(<UpgradeRequiredModal isOpen onClose={onClose} onViewPlans={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
