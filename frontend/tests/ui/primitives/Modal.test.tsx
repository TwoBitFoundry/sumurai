import { render, screen } from '@testing-library/react';
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

  it('does not blur the backdrop for drawer modals', () => {
    render(
      <Modal isOpen onClose={jest.fn()} presentation="drawer">
        <p>Drawer content</p>
      </Modal>
    );

    expect(screen.getByTestId('modal-backdrop')).toHaveAttribute('data-presentation', 'drawer');
    expect(screen.getByTestId('modal-backdrop').className).not.toContain('backdrop-blur');
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
});
