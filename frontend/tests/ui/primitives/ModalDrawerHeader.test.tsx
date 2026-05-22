import * as Dialog from '@radix-ui/react-dialog';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModalDrawerHeader } from '@/ui/primitives/ModalDrawerHeader';

describe('ModalDrawerHeader', () => {
  it('renders the label and closes from the header button', async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();

    render(
      <ModalDrawerHeader onClose={onClose} closeLabel="Close drawer">
        <p>Customize Category</p>
      </ModalDrawerHeader>
    );

    expect(screen.getByText('Customize Category')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close drawer' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes through Dialog.Close when closeWithDialog is enabled', async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();

    render(
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
              <p>Customize Category</p>
            </ModalDrawerHeader>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );

    await user.click(screen.getByRole('button', { name: 'Close drawer' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
