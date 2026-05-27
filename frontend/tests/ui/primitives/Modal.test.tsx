import * as Dialog from '@radix-ui/react-dialog';
import { fireEvent, render, screen } from '@testing-library/react';
import { completeExitAnimation, withProgrammaticTimers } from '@tests/utils/programmaticTimers';
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
    const onClose = jest.fn();

    render(
      <Modal isOpen onClose={onClose} presentation="drawer">
        <Dialog.Close asChild>
          <button type="button">Close drawer</button>
        </Dialog.Close>
      </Modal>
    );

    await withProgrammaticTimers(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Close drawer' }));
      expect(onClose).not.toHaveBeenCalled();
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('data-exiting', 'true');
      await completeExitAnimation(dialog);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
