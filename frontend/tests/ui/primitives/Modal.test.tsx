import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '@/ui/primitives';

describe('Modal', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders accessible dialog semantics when open', () => {
    render(
      <Modal isOpen={true} labelledBy="modal-title" description="modal-description">
        <h2 id="modal-title">Example modal</h2>
        <p id="modal-description">Example description</p>
      </Modal>
    );

    const dialog = screen.getByRole('dialog', { name: 'Example modal' });
    expect(dialog).toHaveAccessibleDescription('Example description');
  });

  it('focuses the dialog content when opened', async () => {
    render(
      <Modal isOpen={true} labelledBy="modal-title">
        <h2 id="modal-title">Focus modal</h2>
        <button type="button">Confirm</button>
      </Modal>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus();
    });
  });

  it('calls onClose when escape is pressed', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();

    render(
      <Modal isOpen={true} onClose={onClose} labelledBy="modal-title">
        <h2 id="modal-title">Escape modal</h2>
        <button type="button">Confirm</button>
      </Modal>
    );

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();

    render(
      <Modal isOpen={true} onClose={onClose} labelledBy="modal-title">
        <h2 id="modal-title">Backdrop modal</h2>
      </Modal>
    );

    await user.click(screen.getByTestId('modal-backdrop'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the modal open when backdrop dismissal is disabled', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();

    render(
      <Modal isOpen={true} onClose={onClose} preventCloseOnBackdrop labelledBy="modal-title">
        <h2 id="modal-title">Locked modal</h2>
      </Modal>
    );

    await user.click(screen.getByTestId('modal-backdrop'));

    expect(onClose).not.toHaveBeenCalled();
  });
});
