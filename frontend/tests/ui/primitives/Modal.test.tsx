import * as Dialog from '@radix-ui/react-dialog';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '@/ui/primitives/Modal';

describe('Modal', () => {
  it('blurs the backdrop for centered modals', () => {
    render(
      <Modal isOpen onClose={jest.fn()} presentation="centered">
        <p>Centered content</p>
      </Modal>
    );

    expect(screen.getByTestId('modal-backdrop')).toHaveAttribute('data-presentation', 'centered');
    expect(screen.getByTestId('modal-backdrop').className).toContain('backdrop-blur-md');
  });

  it('uses the provider backdrop treatment when backdropVariant is provider', () => {
    render(
      <Modal isOpen onClose={jest.fn()} presentation="centered" backdropVariant="provider">
        <p>Provider connect</p>
      </Modal>
    );

    expect(screen.getByTestId('modal-backdrop').className).toContain('backdrop-blur-[6px]');
    expect(screen.getByTestId('modal-backdrop').className).toContain('backdrop-saturate-[92%]');
  });

  it('does not blur or dim the backdrop for drawer modals', () => {
    render(
      <Modal isOpen onClose={jest.fn()} presentation="drawer">
        <p>Drawer content</p>
      </Modal>
    );

    const backdrop = screen.getByTestId('modal-backdrop');
    expect(backdrop).toHaveAttribute('data-presentation', 'drawer');
    expect(backdrop.className).not.toContain('backdrop-blur');
    expect(backdrop.className).toContain('bg-transparent');
    expect(backdrop.className).not.toContain('surface-overlay');
  });

  it('centers dialog content in a full-viewport grid', () => {
    render(
      <Modal isOpen onClose={jest.fn()} presentation="centered" data-testid="centered-panel">
        <p>Centered content</p>
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.parentElement).toHaveClass('place-items-center');
  });

  it('applies slide animations to drawer modals', () => {
    render(
      <Modal isOpen onClose={jest.fn()} presentation="drawer" data-testid="drawer-panel">
        <p>Drawer content</p>
      </Modal>
    );

    expect(screen.getByTestId('modal-backdrop').className).toContain('modal-drawer-overlay');
    expect(screen.getByRole('dialog').className).toContain('modal-drawer-content');
  });

  it('defers drawer onClose until the exit animation finishes', async () => {
    jest.useFakeTimers();
    const onClose = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(
      <Modal isOpen onClose={onClose} presentation="drawer">
        <Dialog.Close asChild>
          <button type="button">Close drawer</button>
        </Dialog.Close>
      </Modal>
    );

    await user.click(screen.getByRole('button', { name: 'Close drawer' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveAttribute('data-exiting', 'true');

    await act(async () => {
      jest.runAllTimers();
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });
});
