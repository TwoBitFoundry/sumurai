import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CancelMembershipModal } from '@/features/settings/CancelMembershipModal';

describe('CancelMembershipModal', () => {
  it('confirms or dismisses through existing modal actions', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    const onClose = jest.fn();

    render(
      <CancelMembershipModal
        isOpen
        isPending={false}
        error={null}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    );

    expect(screen.getByRole('dialog')).toHaveAccessibleName('Cancel membership?');
    await user.click(screen.getByRole('button', { name: 'Keep membership' }));
    await user.click(screen.getByRole('button', { name: 'Cancel membership' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('disables repeated submission and surfaces retryable failure copy', () => {
    render(
      <CancelMembershipModal
        isOpen
        isPending
        error="Cancellation failed. Try again."
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Cancellation failed. Try again.');
    expect(screen.getByRole('button', { name: 'Canceling…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Keep membership' })).toBeDisabled();
  });
});
