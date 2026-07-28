import * as Dialog from '@radix-ui/react-dialog';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { ControlTooltipProvider } from '@/ui/primitives/ControlHoverLabel';
import { ModalDrawerHeader } from '@/ui/primitives/ModalDrawerHeader';

function renderModalDrawerHeader(ui: React.ReactElement) {
  return render(<ControlTooltipProvider>{ui}</ControlTooltipProvider>);
}

describe('ModalDrawerHeader', () => {
  it('renders the label and closes from the header button', async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();

    renderModalDrawerHeader(
      <ModalDrawerHeader onClose={onClose} closeLabel="Close drawer">
        <p>Change Category</p>
      </ModalDrawerHeader>
    );

    expect(screen.getByText('Change Category')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close drawer' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows a fast hover label on the close button', async () => {
    const user = userEvent.setup();

    renderModalDrawerHeader(
      <ModalDrawerHeader onClose={jest.fn()} closeLabel="Close delete account dialog">
        <p>Delete Account?</p>
      </ModalDrawerHeader>
    );

    const closeButton = screen.getByRole('button', { name: 'Close delete account dialog' });
    expect(closeButton).not.toHaveAttribute('title');

    await user.hover(closeButton);

    await waitFor(() => {
      expect(screen.getByRole('tooltip', { name: 'Close' })).toBeInTheDocument();
    });
  });

  it('closes through Dialog.Close when closeWithDialog is enabled', async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();

    renderModalDrawerHeader(
      <Dialog.Root
        open
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            onClose();
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Content>
            <ModalDrawerHeader closeWithDialog onClose={onClose} closeLabel="Close drawer">
              <p>Change Category</p>
            </ModalDrawerHeader>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );

    await user.click(screen.getByRole('button', { name: 'Close drawer' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
